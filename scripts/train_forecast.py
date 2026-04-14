#!/usr/bin/env python3
"""
train_forecast.py
─────────────────
ML pipeline: load Clover POS sales from Supabase → feature engineering →
XGBoost global model → time-based train/test evaluation → print accuracy metrics.

No CSV inputs. No DB writes. Demand forecast writes are handled separately.

Usage:
    python scripts/train_forecast.py

Requirements:
    pip install supabase pandas numpy xgboost scikit-learn python-dotenv
"""

import math
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
FORECAST_HORIZON = 7
TEST_DAYS = 7               # hold-out window for evaluation
SAFETY_FACTOR   = 1.5       # safety stock = std_dev(daily_usage) × SAFETY_FACTOR
STORE_UTC_OFFSET_HOURS = -7  # PDT (UTC-7)

# ── Load env ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
        "(or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set in .env.local"
    )

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


def coerce_string(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().replace({"": None, "nan": None, "None": None})


def safe_float(val, default: float = 0.0) -> float:
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────────────────────────────────────
# Step A — Load sales from clover_processed_orders
# ─────────────────────────────────────────────────────────────────────────────
print("Loading sales from Supabase: clover_processed_orders …", flush=True)

raw_orders = fetch_all("clover_processed_orders", "order_created_at,line_items")
if not raw_orders:
    sys.exit(
        "ERROR: clover_processed_orders is empty.\n"
        "Run POST /api/clover/backfill to load historical order data first."
    )

sales_rows = []
for order in raw_orders:
    ts = order.get("order_created_at")
    line_items = order.get("line_items") or []
    if not ts or not line_items:
        continue
    # Convert UTC → store-local date (PDT = UTC-7)
    utc_dt = pd.to_datetime(ts, utc=True)
    local_date = (utc_dt + pd.Timedelta(hours=STORE_UTC_OFFSET_HOURS)).date()
    for item in line_items:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        sales_rows.append({
            "transaction_date": local_date,
            "product_type": name,
            "transaction_qty": item.get("quantity") or 1,
        })

if not sales_rows:
    sys.exit("ERROR: no usable line items found in clover_processed_orders.")

sales = pd.DataFrame(sales_rows)
sales["transaction_date"] = pd.to_datetime(sales["transaction_date"])
sales["transaction_qty"] = pd.to_numeric(sales["transaction_qty"], errors="coerce").fillna(1)
sales["product_type"] = coerce_string(sales["product_type"])
sales = sales.dropna(subset=["transaction_date", "product_type"]).reset_index(drop=True)

print(
    f"  {len(sales):,} line-item rows  |  "
    f"{sales['product_type'].nunique()} products  |  "
    f"{sales['transaction_date'].nunique()} days "
    f"({sales['transaction_date'].min().date()} → {sales['transaction_date'].max().date()})",
    flush=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step B — Aggregate to daily sales per product
# ─────────────────────────────────────────────────────────────────────────────
print("Aggregating to daily product sales …", flush=True)

daily = (
    sales.groupby(["product_type", "transaction_date"])["transaction_qty"]
    .sum()
    .reset_index()
    .rename(columns={"transaction_date": "date", "transaction_qty": "qty"})
)

all_dates = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
products = daily["product_type"].unique()
idx = pd.MultiIndex.from_product([products, all_dates], names=["product_type", "date"])

daily = (
    daily.set_index(["product_type", "date"])
    .reindex(idx, fill_value=0)
    .reset_index()
    .sort_values(["product_type", "date"])
    .reset_index(drop=True)
)

print(
    f"  {len(daily):,} product-day rows after zero-filling gaps.",
    flush=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step C — Feature engineering
# ─────────────────────────────────────────────────────────────────────────────
print("Engineering features …", flush=True)

daily["day_of_week"] = daily["date"].dt.dayofweek
daily["month"] = daily["date"].dt.month
daily["days_since_start"] = (daily["date"] - daily["date"].min()).dt.days

g = daily.groupby("product_type")["qty"]
daily["sales_yesterday"] = g.shift(1)
daily["sales_same_day_last_week"] = g.shift(7)
daily["avg_last_7_days"] = g.transform(
    lambda s: s.shift(1).rolling(7, min_periods=1).mean()
)
daily["avg_last_14_days"] = g.transform(
    lambda s: s.shift(1).rolling(14, min_periods=1).mean()
)

daily = daily.dropna(subset=["sales_yesterday"]).reset_index(drop=True)
if daily.empty:
    sys.exit("ERROR: not enough historical data to build lag features.")

product_codes = {p: i for i, p in enumerate(sorted(daily["product_type"].unique()))}
daily["product_code"] = daily["product_type"].map(product_codes)

FEATURES = [
    "product_code",
    "day_of_week",
    "month",
    "days_since_start",
    "sales_yesterday",
    "sales_same_day_last_week",
    "avg_last_7_days",
    "avg_last_14_days",
]


# ─────────────────────────────────────────────────────────────────────────────
# Step D — Train / test split (hold out last TEST_DAYS days)
# ─────────────────────────────────────────────────────────────────────────────
print(f"Splitting train/test (hold-out last {TEST_DAYS} days) …", flush=True)

unique_dates = sorted(daily["date"].drop_duplicates().tolist())
if len(unique_dates) < TEST_DAYS + 2:
    sys.exit(
        f"ERROR: need at least {TEST_DAYS + 2} distinct days of data to train and evaluate; "
        f"only {len(unique_dates)} available. Run the backfill first."
    )

cutoff = pd.Timestamp(unique_dates[-TEST_DAYS])
train = daily[daily["date"] < cutoff].copy()
test  = daily[daily["date"] >= cutoff].copy()

print(
    f"  Train: {train['date'].min().date()} → {train['date'].max().date()} "
    f"({len(train):,} rows)",
    flush=True,
)
print(
    f"  Test:  {test['date'].min().date()} → {test['date'].max().date()} "
    f"({len(test):,} rows)",
    flush=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step E — Train XGBoost on training split
# ─────────────────────────────────────────────────────────────────────────────
print("Training XGBoost model …", flush=True)

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
print("  Model trained.", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step F — Evaluate on hold-out test set
# ─────────────────────────────────────────────────────────────────────────────
print(f"Evaluating on {TEST_DAYS}-day hold-out …", flush=True)

test = test.copy()
test["predicted"] = np.clip(model.predict(test[FEATURES]), 0, None)


def compute_metrics(df: pd.DataFrame) -> dict:
    actuals      = df["qty"].values
    preds        = df["predicted"].values
    mae          = float(np.mean(np.abs(preds - actuals)))
    rmse         = float(np.sqrt(np.mean((preds - actuals) ** 2)))
    mean_actual  = float(np.mean(actuals))
    accuracy_pct = max(0.0, (1 - mae / mean_actual) * 100) if mean_actual > 0 else 0.0
    return dict(
        mae=mae,
        rmse=rmse,
        accuracy_pct=round(accuracy_pct, 1),
        total_actual=float(df["qty"].sum()),
        total_pred=float(df["predicted"].sum()),
    )


per_product = (
    test.groupby("product_type")
    .apply(compute_metrics)
    .apply(pd.Series)
    .reset_index()
    .sort_values("total_actual", ascending=False)
)

overall = compute_metrics(test)


# ── Print accuracy table ──────────────────────────────────────────────────────
COL = 32
print(flush=True)
print("=" * 80, flush=True)
print("  ACCURACY REPORT — hold-out test set", flush=True)
print("=" * 80, flush=True)
print(
    f"  {'Product':<{COL}} {'Actual':>8} {'Pred':>8} {'MAE':>7} {'Acc%':>7}",
    flush=True,
)
print("-" * 80, flush=True)

for _, row in per_product.iterrows():
    print(
        f"  {str(row['product_type']):<{COL}} "
        f"{row['total_actual']:>8.0f} "
        f"{row['total_pred']:>8.1f} "
        f"{row['mae']:>7.2f} "
        f"{row['accuracy_pct']:>6.1f}%",
        flush=True,
    )

print("-" * 80, flush=True)
print(
    f"  {'OVERALL':<{COL}} "
    f"{overall['total_actual']:>8.0f} "
    f"{overall['total_pred']:>8.1f} "
    f"{overall['mae']:>7.2f} "
    f"{overall['accuracy_pct']:>6.1f}%",
    flush=True,
)
print("=" * 80, flush=True)
print(flush=True)
print(
    "  Acc% = max(0, 1 - MAE / mean_daily_actual) × 100",
    flush=True,
)
print(
    f"  Train: {train['date'].min().date()} → {train['date'].max().date()}  |  "
    f"Test:  {test['date'].min().date()} → {test['date'].max().date()}",
    flush=True,
)
print(flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step E — Re-train on full dataset, generate 7-day forward forecast
# ─────────────────────────────────────────────────────────────────────────────
print("Re-training on full dataset for forward forecast …", flush=True)

model_final = xgb.XGBRegressor(
    n_estimators=400,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1,
    verbosity=0,
)
model_final.fit(daily[FEATURES], daily["qty"])

last_date = daily["date"].max()
future_dates = [last_date + timedelta(days=d) for d in range(1, FORECAST_HORIZON + 1)]
history = daily.copy()
forecast_rows = []

for fdate in future_dates:
    rows = []
    for product, code in product_codes.items():
        prod_hist = history[history["product_type"] == product].sort_values("date")
        last7  = prod_hist["qty"].iloc[-7:].values  if len(prod_hist) >= 1 else np.array([0.0])
        last14 = prod_hist["qty"].iloc[-14:].values if len(prod_hist) >= 1 else np.array([0.0])
        yesterday = float(prod_hist["qty"].iloc[-1]) if len(prod_hist) >= 1 else 0.0
        sdlw_rows = prod_hist[prod_hist["date"] == fdate - timedelta(days=7)]
        sdlw = float(sdlw_rows["qty"].iloc[0]) if len(sdlw_rows) else float(np.mean(last7))
        rows.append({
            "product_type":            product,
            "date":                    fdate,
            "product_code":            code,
            "day_of_week":             fdate.dayofweek,
            "month":                   fdate.month,
            "days_since_start":        (fdate - daily["date"].min()).days,
            "sales_yesterday":         yesterday,
            "sales_same_day_last_week": sdlw,
            "avg_last_7_days":         float(np.mean(last7)),
            "avg_last_14_days":        float(np.mean(last14)),
        })
    fdf = pd.DataFrame(rows)
    fdf["qty"] = np.clip(model_final.predict(fdf[FEATURES]), 0, None)
    forecast_rows.append(fdf)
    history = pd.concat([history, fdf[["product_type", "date", "qty"]]], ignore_index=True)

forecast = pd.concat(forecast_rows, ignore_index=True)
print(
    f"  Forecast covers {future_dates[0].date()} → {future_dates[-1].date()}  "
    f"({len(forecast)} product-day rows)",
    flush=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step F — Expand forecast through recipes → ingredient gram demand
# ─────────────────────────────────────────────────────────────────────────────
print("Loading recipes from Supabase …", flush=True)
raw_recipes = fetch_all("recipes", "product_type,ingredient_name,quantity_per_unit,unit")
if not raw_recipes:
    sys.exit("ERROR: recipes table is empty.")

recipes_df = pd.DataFrame(raw_recipes)
recipes_df["product_type"]     = coerce_string(recipes_df["product_type"])
recipes_df["ingredient_name"]  = coerce_string(recipes_df["ingredient_name"])
recipes_df["quantity_per_unit"] = pd.to_numeric(recipes_df["quantity_per_unit"], errors="coerce")
recipes_df = recipes_df.dropna(subset=["product_type", "ingredient_name", "quantity_per_unit"])

product_totals = (
    forecast.groupby("product_type")["qty"]
    .sum()
    .reset_index()
    .rename(columns={"qty": "total_qty"})
)

expanded = product_totals.merge(recipes_df, on="product_type", how="inner")
if expanded.empty:
    sys.exit("ERROR: no forecasted products matched any recipe rows.")

expanded["ingredient_demand_g"] = expanded["total_qty"] * expanded["quantity_per_unit"]

# Daily ingredient usage (for safety stock std dev)
daily_ingr = (
    forecast.merge(recipes_df, on="product_type", how="inner")
    .assign(daily_g=lambda df: df["qty"] * df["quantity_per_unit"])
    .groupby(["ingredient_name", "date"])["daily_g"]
    .sum()
    .reset_index()
)

ingr_demand = (
    expanded.groupby("ingredient_name")["ingredient_demand_g"]
    .sum()
    .reset_index()
    .rename(columns={"ingredient_demand_g": "predicted_demand_g"})
)

ingr_std = (
    daily_ingr.groupby("ingredient_name")["daily_g"]
    .std()
    .fillna(0)
    .reset_index()
    .rename(columns={"daily_g": "demand_std_g"})
)
ingr_demand = ingr_demand.merge(ingr_std, on="ingredient_name", how="left")
ingr_demand["safety_stock_g"] = (ingr_demand["demand_std_g"] * SAFETY_FACTOR).fillna(0)

print(f"  Tracked ingredients: {ingr_demand['ingredient_name'].tolist()}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step G — Load live stock, compute recommended order in purchase units
# ─────────────────────────────────────────────────────────────────────────────
print("Loading live inventory …", flush=True)
raw_items = fetch_all(
    "items",
    "product_name,quantity_remaining,unit,purchase_unit,purchase_unit_size",
)
items_df = pd.DataFrame(raw_items).rename(columns={"product_name": "ingredient_name"})
items_df["quantity_remaining"]  = pd.to_numeric(items_df["quantity_remaining"],  errors="coerce").fillna(0)
items_df["purchase_unit_size"]  = pd.to_numeric(items_df["purchase_unit_size"],  errors="coerce").fillna(1)

ingr_demand = ingr_demand.merge(
    items_df[["ingredient_name", "quantity_remaining", "purchase_unit", "purchase_unit_size"]],
    on="ingredient_name",
    how="left",
)

def to_pu(grams: float, size: float) -> float:
    """Convert raw grams to purchase units, rounded to 2 decimal places."""
    return round(grams / size, 2) if size > 0 else grams

def ceil_pu(grams: float, size: float) -> int:
    """Convert raw grams to purchase units, ceil'd (for order quantities)."""
    return math.ceil(grams / size) if size > 0 else math.ceil(grams)

ingr_demand["current_stock_g"]    = ingr_demand["quantity_remaining"].fillna(0)
ingr_demand["net_need_g"]         = (
    ingr_demand["predicted_demand_g"]
    + ingr_demand["safety_stock_g"]
    - ingr_demand["current_stock_g"]
)
ingr_demand["recommended_order"]  = ingr_demand.apply(
    lambda r: max(0, ceil_pu(r["net_need_g"], r["purchase_unit_size"])), axis=1
)
ingr_demand["predicted_demand_pu"] = ingr_demand.apply(
    lambda r: to_pu(r["predicted_demand_g"], r["purchase_unit_size"]), axis=1
)
ingr_demand["current_stock_pu"]   = ingr_demand.apply(
    lambda r: to_pu(r["current_stock_g"], r["purchase_unit_size"]), axis=1
)
ingr_demand["safety_stock_pu"]    = ingr_demand.apply(
    lambda r: to_pu(r["safety_stock_g"], r["purchase_unit_size"]), axis=1
)


# ─────────────────────────────────────────────────────────────────────────────
# Step H — Upsert to demand_forecasts
# ─────────────────────────────────────────────────────────────────────────────
print("Writing to demand_forecasts …", flush=True)

forecast_date   = (last_date + timedelta(days=1)).date().isoformat()
retrained_at    = datetime.now(timezone.utc).isoformat()
confidence      = round(safe_float(overall["accuracy_pct"]) / 100, 4)

supabase.table("demand_forecasts").delete().eq("forecast_date", forecast_date).execute()

upsert_rows = []
for _, row in ingr_demand.iterrows():
    upsert_rows.append({
        "ingredient_name":  str(row["ingredient_name"]),
        "forecast_date":    forecast_date,
        "predicted_demand": safe_float(row["predicted_demand_pu"]),
        "current_stock":    safe_float(row["current_stock_pu"]),
        "safety_stock":     safe_float(row["safety_stock_pu"]),
        "recommended_order": int(row["recommended_order"]),
        "unit":             str(row["purchase_unit"]) if pd.notna(row.get("purchase_unit")) else "unit",
        "confidence_score": confidence,
        "created_at":       retrained_at,
    })

supabase.table("demand_forecasts").upsert(
    upsert_rows, on_conflict="ingredient_name,forecast_date"
).execute()

print(f"  Wrote {len(upsert_rows)} rows for forecast_date={forecast_date}:", flush=True)
for r in upsert_rows:
    print(
        f"    {r['ingredient_name']}: "
        f"predicted={r['predicted_demand']:.2f} {r['unit']}, "
        f"in_stock={r['current_stock']:.2f} {r['unit']}, "
        f"safety={r['safety_stock']:.2f} {r['unit']}, "
        f"order={r['recommended_order']} {r['unit']}",
        flush=True,
    )

print(flush=True)
print("Done.", flush=True)
