#!/usr/bin/env python3
"""
train_forecast.py
─────────────────
ML pipeline: load sales_history → feature engineering → XGBoost global model
→ predict next 7 days → expand via recipe mapping → compute recommended orders
→ write results to demand_forecasts table in Supabase.

Usage:
    python scripts/train_forecast.py

Requirements:
    pip install supabase pandas numpy xgboost scikit-learn python-dotenv
"""

import sys
import os
from pathlib import Path
from datetime import timedelta, datetime, timezone

import numpy as np
import pandas as pd
import xgboost as xgb
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
FORECAST_HORIZON = 7    # days to predict forward
SAFETY_FACTOR    = 1.5  # multiplier on demand std-dev for safety stock
TRAIN_CUTOFF     = "2023-06-01"  # time-based split: train < cutoff, test >= cutoff
STORE_LOCATION   = "Hell's Kitchen"  # options: "Astoria", "Hell's Kitchen", "Lower Manhattan"

# ── Load env ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Helpers ───────────────────────────────────────────────────────────────────
def fetch_all(table: str, select: str = "*") -> list[dict]:
    """Page through a Supabase table (1 000 rows per request)."""
    rows, offset = [], 0
    while True:
        resp = (
            supabase.table(table)
            .select(select)
            .range(offset, offset + 999)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Step A — Load & aggregate to daily sales per product
# ─────────────────────────────────────────────────────────────────────────────
print(f"Loading sales_history for store: {STORE_LOCATION} …", flush=True)
raw = fetch_all("sales_history", "transaction_date,product_type,transaction_qty,store_location")
if not raw:
    sys.exit("ERROR: sales_history is empty — run seed_sales_history.py first.")

sales = pd.DataFrame(raw)
sales = sales[sales["store_location"] == STORE_LOCATION]
if sales.empty:
    sys.exit(f"ERROR: no sales found for store_location='{STORE_LOCATION}'")
sales["transaction_date"] = pd.to_datetime(sales["transaction_date"])

daily = (
    sales.groupby(["product_type", "transaction_date"])["transaction_qty"]
    .sum()
    .reset_index()
    .rename(columns={"transaction_date": "date", "transaction_qty": "qty"})
)

# Fill zero-sale days so every product has a contiguous date range
all_dates = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
products  = daily["product_type"].unique()
idx       = pd.MultiIndex.from_product(
    [products, all_dates], names=["product_type", "date"]
)
daily = (
    daily.set_index(["product_type", "date"])
    .reindex(idx, fill_value=0)
    .reset_index()
    .sort_values(["product_type", "date"])
    .reset_index(drop=True)
)
print(f"  {len(daily):,} product-day rows across {len(products)} products.", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step B — Feature engineering
# ─────────────────────────────────────────────────────────────────────────────
print("Engineering features …", flush=True)

daily["day_of_week"]      = daily["date"].dt.dayofweek   # 0=Mon
daily["month"]            = daily["date"].dt.month
daily["days_since_start"] = (daily["date"] - daily["date"].min()).dt.days

g = daily.groupby("product_type")["qty"]
daily["sales_yesterday"]          = g.shift(1)
daily["sales_same_day_last_week"] = g.shift(7)
daily["avg_last_7_days"]          = g.transform(
    lambda s: s.shift(1).rolling(7,  min_periods=1).mean()
)
daily["avg_last_14_days"] = g.transform(
    lambda s: s.shift(1).rolling(14, min_periods=1).mean()
)

daily = daily.dropna(subset=["sales_yesterday"]).reset_index(drop=True)

# Encode product_type as integer
product_codes = {p: i for i, p in enumerate(sorted(daily["product_type"].unique()))}
daily["product_code"] = daily["product_type"].map(product_codes)

FEATURES = [
    "product_code", "day_of_week", "month", "days_since_start",
    "sales_yesterday", "sales_same_day_last_week",
    "avg_last_7_days", "avg_last_14_days",
]


# ─────────────────────────────────────────────────────────────────────────────
# Step C — Train (time-based split)
# ─────────────────────────────────────────────────────────────────────────────
print("Training XGBoost model …", flush=True)
cutoff = pd.Timestamp(TRAIN_CUTOFF)
train  = daily[daily["date"] <  cutoff]
test   = daily[daily["date"] >= cutoff]

model = xgb.XGBRegressor(
    n_estimators=400,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1,
    verbosity=0,
)
model.fit(train[FEATURES], train["qty"])

# Evaluate on test set
test_pred  = np.clip(model.predict(test[FEATURES]), 0, None)
mae        = float(np.mean(np.abs(test_pred - test["qty"].values)))
naive_mae  = float(np.mean(np.abs(
    test["sales_same_day_last_week"].fillna(0).values - test["qty"].values
)))
skill_score      = max(0.0, 1 - mae / naive_mae) if naive_mae > 0 else 0.5
confidence_score = round(skill_score, 4)
print(f"  MAE={mae:.2f}  RMSE={np.sqrt(np.mean((test_pred - test['qty'].values)**2)):.2f}  skill_score={confidence_score:.4f}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step D — Predict next 7 days (auto-regressive: append preds back to history)
# ─────────────────────────────────────────────────────────────────────────────
print("Generating 7-day forecast …", flush=True)
last_date    = daily["date"].max()
future_dates = [last_date + timedelta(days=d) for d in range(1, FORECAST_HORIZON + 1)]

history       = daily.copy()
forecast_rows = []

for fdate in future_dates:
    rows = []
    for product, code in product_codes.items():
        prod_hist = history[history["product_type"] == product].sort_values("date")
        last7     = prod_hist["qty"].iloc[-7:].values   if len(prod_hist) >= 1 else np.array([0.0])
        last14    = prod_hist["qty"].iloc[-14:].values  if len(prod_hist) >= 1 else np.array([0.0])
        yesterday = float(prod_hist["qty"].iloc[-1])    if len(prod_hist) >= 1 else 0.0

        sdlw_rows = prod_hist[prod_hist["date"] == fdate - timedelta(days=7)]
        sdlw      = float(sdlw_rows["qty"].iloc[0]) if len(sdlw_rows) else float(np.mean(last7))

        rows.append({
            "product_type":             product,
            "date":                     fdate,
            "product_code":             code,
            "day_of_week":              fdate.dayofweek,
            "month":                    fdate.month,
            "days_since_start":         (fdate - daily["date"].min()).days,
            "sales_yesterday":          yesterday,
            "sales_same_day_last_week": sdlw,
            "avg_last_7_days":          float(np.mean(last7)),
            "avg_last_14_days":         float(np.mean(last14)),
        })

    fdf = pd.DataFrame(rows)
    fdf["qty"] = np.clip(model.predict(fdf[FEATURES]), 0, None)
    forecast_rows.append(fdf)

    # Feed predictions back so the next iteration has correct lag features
    history = pd.concat(
        [history, fdf[["product_type", "date", "qty"]]], ignore_index=True
    )

forecast = pd.concat(forecast_rows, ignore_index=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step E — Expand predictions through recipe mapping → ingredient-level demand
# ─────────────────────────────────────────────────────────────────────────────
print("Expanding via recipe mapping …", flush=True)
recipes_raw = fetch_all("recipes")
ingrs_raw   = fetch_all("items", "product_name,quantity_remaining,unit,purchase_unit,purchase_unit_size")

if not recipes_raw:
    sys.exit("ERROR: recipes table is empty — apply migration 003 first.")
if not ingrs_raw:
    sys.exit("ERROR: items table is empty — apply migration 001 first.")

recipes = pd.DataFrame(recipes_raw)
ingrs   = pd.DataFrame(ingrs_raw)
# Normalise column names to match the rest of the pipeline
ingrs = ingrs.rename(columns={"product_name": "name", "quantity_remaining": "current_stock_pu"})
recipes["quantity_per_unit"] = recipes["quantity_per_unit"].astype(float)

# Total predicted qty per product over the forecast window
product_totals = (
    forecast.groupby("product_type")["qty"]
    .sum()
    .reset_index()
    .rename(columns={"qty": "total_predicted_qty"})
)

expanded = product_totals.merge(recipes, on="product_type", how="inner")
expanded["ingredient_demand"] = expanded["total_predicted_qty"] * expanded["quantity_per_unit"]

ingr_demand = (
    expanded.groupby(["ingredient_name", "unit"])["ingredient_demand"]
    .sum()
    .reset_index()
    .rename(columns={"ingredient_demand": "predicted_demand"})
)


# ─────────────────────────────────────────────────────────────────────────────
# Step F — Compute safety stock and recommended order quantities
# ─────────────────────────────────────────────────────────────────────────────
print("Computing recommended orders …", flush=True)

# Daily ingredient demand across the forecast window (for std-dev)
daily_ingr = (
    forecast
    .merge(recipes, on="product_type", how="inner")
    .assign(daily_ingr=lambda df: df["qty"] * df["quantity_per_unit"])
    .groupby(["ingredient_name", "date"])["daily_ingr"]
    .sum()
    .reset_index()
)
std_by_ingr = (
    daily_ingr.groupby("ingredient_name")["daily_ingr"]
    .std()
    .fillna(0)
    .reset_index()
    .rename(columns={"daily_ingr": "demand_std"})
)

ingr_demand = ingr_demand.merge(std_by_ingr, on="ingredient_name", how="left")
ingr_demand["safety_stock"] = (ingr_demand["demand_std"] * SAFETY_FACTOR).fillna(0)

ingr_demand = ingr_demand.merge(
    ingrs[["name", "current_stock_pu", "purchase_unit", "purchase_unit_size"]].rename(
        columns={"name": "ingredient_name"}
    ),
    on="ingredient_name",
    how="left",
)
ingr_demand["current_stock_pu"]   = ingr_demand["current_stock_pu"].astype(float).fillna(0)
ingr_demand["purchase_unit_size"] = ingr_demand["purchase_unit_size"].astype(float).fillna(1)

# Convert predicted demand and safety stock to purchase units (ceiling so we never under-order)
import math

def to_purchase_units(val, size):
    return math.ceil(val / size) if size > 0 else val

ingr_demand["predicted_demand_pu"] = ingr_demand.apply(
    lambda r: to_purchase_units(r["predicted_demand"], r["purchase_unit_size"]), axis=1
)
# current_stock_pu already in purchase units — just round up
ingr_demand["current_stock_pu"] = ingr_demand["current_stock_pu"].apply(math.ceil)
ingr_demand["safety_stock_pu"] = ingr_demand.apply(
    lambda r: to_purchase_units(r["safety_stock"], r["purchase_unit_size"]), axis=1
)
ingr_demand["recommended_order_pu"] = (
    ingr_demand["predicted_demand_pu"]
    - ingr_demand["current_stock_pu"]
    + ingr_demand["safety_stock_pu"]
).clip(lower=0).apply(math.ceil)


# ─────────────────────────────────────────────────────────────────────────────
# Write results to demand_forecasts (upsert on ingredient_name + forecast_date)
# ─────────────────────────────────────────────────────────────────────────────
print("Writing to demand_forecasts …", flush=True)
forecast_date = (last_date + timedelta(days=1)).date().isoformat()
retrained_at  = datetime.now(timezone.utc).isoformat()

upsert_rows = [
    {
        "ingredient_name":   row["ingredient_name"],
        "forecast_date":     forecast_date,
        "predicted_demand":  float(row["predicted_demand_pu"]),
        "current_stock":     float(row["current_stock_pu"]),
        "safety_stock":      float(row["safety_stock_pu"]),
        "recommended_order": float(row["recommended_order_pu"]),
        "unit":              row["purchase_unit"],
        "confidence_score":  confidence_score,
        "created_at":        retrained_at,   # overwrite on every upsert so UI timestamp refreshes
    }
    for _, row in ingr_demand.iterrows()
]

BATCH = 100
for i in range(0, len(upsert_rows), BATCH):
    supabase.table("demand_forecasts").upsert(
        upsert_rows[i : i + BATCH],
        on_conflict="ingredient_name,forecast_date",
    ).execute()

print(f"Done — wrote {len(upsert_rows)} rows for forecast_date={forecast_date}.", flush=True)
