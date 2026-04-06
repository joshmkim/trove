#!/usr/bin/env python3
"""
train_forecast.py
─────────────────
ML pipeline: load sales + recipe inputs → feature engineering → XGBoost global
model → predict next 7 days → expand via recipe mapping → compute recommended
orders → write results to demand_forecasts in Supabase.

The trainer prefers local CSV files named `trove_sales_data.csv` and
`trove_recipe_data.csv` when present. If either file is missing, it falls back
to the legacy Supabase tables (`sales_history` and `recipes`) for that input.

Usage:
    python scripts/train_forecast.py
    python scripts/train_forecast.py --sales-csv path/to/trove_sales_data.csv --recipe-csv path/to/trove_recipe_data.csv

Requirements:
    pip install supabase pandas numpy xgboost scikit-learn python-dotenv
"""

import argparse
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
SAFETY_FACTOR = 1.5
DEFAULT_TRAIN_RATIO = 0.8
DEFAULT_SALES_CSV = "trove_sales_data.csv"
DEFAULT_RECIPE_CSV = "trove_recipe_data.csv"
CSV_SEARCH_DIRS = ("", "data", "scripts")

# ── Load env ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")
DEFAULT_STORE_LOCATION = os.environ.get("FORECAST_STORE_LOCATION", "Hell's Kitchen")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY "
        "must be set in .env.local"
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


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(r"[%/#()]", "", regex=True)
        .str.replace(r"[\s\-]+", "_", regex=True)
    )
    return df


def resolve_csv_path(explicit_path: str | None, default_name: str) -> Path | None:
    if explicit_path:
        path = Path(explicit_path).expanduser()
        if not path.is_absolute():
            path = ROOT / path
        if not path.exists():
            sys.exit(f"ERROR: CSV file not found: {path}")
        return path

    for rel_dir in CSV_SEARCH_DIRS:
        candidate = ROOT / rel_dir / default_name if rel_dir else ROOT / default_name
        if candidate.exists():
            return candidate
    return None


def find_first_column(df: pd.DataFrame, candidates: list[str], label: str, required: bool = True) -> str | None:
    for name in candidates:
        if name in df.columns:
            return name
    if required:
        sys.exit(
            f"ERROR: could not infer `{label}` column. Available columns: {list(df.columns)}"
        )
    return None


def coerce_string(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().replace({"": None, "nan": None, "None": None})


def load_sales_source(csv_path: Path | None) -> tuple[pd.DataFrame, str]:
    if csv_path:
        print(f"Loading sales from CSV: {csv_path}", flush=True)
        sales = normalize_columns(pd.read_csv(csv_path, sep=None, engine="python"))

        date_col = find_first_column(
            sales,
            ["transaction_date", "date", "sales_date", "order_date", "purchase_time", "ds", "timestamp"],
            "transaction date",
        )
        product_col = find_first_column(
            sales,
            ["product_type", "product_name", "item_name", "menu_item", "recipe_name", "name", "product", "item", "sku"],
            "product type",
        )
        qty_col = find_first_column(
            sales,
            ["transaction_qty", "qty", "quantity", "quantity_sold", "units_sold", "sales_qty", "demand", "count", "sales", "y"],
            "quantity",
        )
        store_col = find_first_column(
            sales,
            ["store_location", "location", "store", "store_name", "site"],
            "store location",
            required=False,
        )

        keep_cols = [date_col, product_col, qty_col] + ([store_col] if store_col else [])
        sales = sales[keep_cols].rename(
            columns={
                date_col: "transaction_date",
                product_col: "product_type",
                qty_col: "transaction_qty",
                **({store_col: "store_location"} if store_col else {}),
            }
        )
        source = f"csv:{csv_path.name}"
    else:
        print("Loading sales from Supabase table: sales_history", flush=True)
        raw = fetch_all(
            "sales_history",
            "transaction_date,product_type,transaction_qty,store_location",
        )
        if not raw:
            sys.exit(
                "ERROR: sales_history is empty and no local sales CSV was found."
            )
        sales = pd.DataFrame(raw)
        source = "supabase:sales_history"

    sales["transaction_date"] = pd.to_datetime(
        sales["transaction_date"], errors="coerce"
    ).dt.normalize()
    sales["product_type"] = coerce_string(sales["product_type"])
    sales["transaction_qty"] = pd.to_numeric(
        sales["transaction_qty"], errors="coerce"
    )

    if "store_location" in sales.columns:
        sales["store_location"] = coerce_string(sales["store_location"])

    sales = sales.dropna(
        subset=["transaction_date", "product_type", "transaction_qty"]
    ).reset_index(drop=True)
    if sales.empty:
        sys.exit("ERROR: no usable sales rows were found after parsing input data.")

    if "store_location" in sales.columns and sales["store_location"].notna().any():
        available_locations = sorted(
            sales["store_location"].dropna().astype(str).unique().tolist()
        )
        if DEFAULT_STORE_LOCATION in available_locations:
            sales = sales[sales["store_location"] == DEFAULT_STORE_LOCATION]
            print(
                f"  Applied store filter: {DEFAULT_STORE_LOCATION}",
                flush=True,
            )
        else:
            print(
                "  Store filter skipped because the requested location was not found. "
                f"Available locations: {available_locations}",
                flush=True,
            )
    else:
        print(
            "  No store location column detected; forecasting across all rows.",
            flush=True,
        )

    if sales.empty:
        sys.exit(
            f"ERROR: no sales rows available after applying store filter `{DEFAULT_STORE_LOCATION}`."
        )

    return sales, source


def load_recipe_source(csv_path: Path | None) -> tuple[pd.DataFrame, str]:
    if csv_path:
        print(f"Loading recipes from CSV: {csv_path}", flush=True)
        recipes = normalize_columns(pd.read_csv(csv_path, sep=None, engine="python"))

        product_col = find_first_column(
            recipes,
            ["product_type", "product_name", "recipe_name", "menu_item", "item_name", "name", "product", "item"],
            "recipe product",
        )
        ingredient_col = find_first_column(
            recipes,
            ["ingredient_name", "ingredient", "inventory_item", "component_name", "component"],
            "ingredient name",
        )
        qty_col = find_first_column(
            recipes,
            ["quantity_per_unit", "qty_per_unit", "quantity", "amount", "amount_per_unit", "ingredient_qty", "usage_qty", "qty_needed"],
            "quantity per unit",
        )
        unit_col = find_first_column(
            recipes,
            ["unit", "uom", "ingredient_unit"],
            "recipe unit",
            required=False,
        )

        keep_cols = [product_col, ingredient_col, qty_col] + ([unit_col] if unit_col else [])
        recipes = recipes[keep_cols].rename(
            columns={
                product_col: "product_type",
                ingredient_col: "ingredient_name",
                qty_col: "quantity_per_unit",
                **({unit_col: "unit"} if unit_col else {}),
            }
        )
        if "unit" not in recipes.columns:
            recipes["unit"] = "unit"
        source = f"csv:{csv_path.name}"
    else:
        print("Loading recipes from Supabase table: recipes", flush=True)
        raw = fetch_all("recipes")
        if not raw:
            sys.exit(
                "ERROR: recipes table is empty and no local recipe CSV was found."
            )
        recipes = pd.DataFrame(raw)
        source = "supabase:recipes"

    recipes["product_type"] = coerce_string(recipes["product_type"])
    recipes["ingredient_name"] = coerce_string(recipes["ingredient_name"])
    recipes["unit"] = coerce_string(recipes["unit"]).fillna("unit")
    recipes["quantity_per_unit"] = pd.to_numeric(
        recipes["quantity_per_unit"], errors="coerce"
    )
    recipes = recipes.dropna(
        subset=["product_type", "ingredient_name", "quantity_per_unit"]
    ).reset_index(drop=True)

    if recipes.empty:
        sys.exit("ERROR: no usable recipe rows were found after parsing input data.")

    return recipes, source


def build_daily_sales(sales: pd.DataFrame) -> pd.DataFrame:
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
    return daily


def resolve_train_test_split(daily: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.Timestamp]:
    unique_dates = sorted(daily["date"].drop_duplicates().tolist())
    if len(unique_dates) < 2:
        sys.exit("ERROR: need at least 2 distinct sales dates to train the forecast model.")

    cutoff_env = os.environ.get("FORECAST_TRAIN_CUTOFF")
    if cutoff_env:
        cutoff = pd.Timestamp(cutoff_env)
        train = daily[daily["date"] < cutoff]
        test = daily[daily["date"] >= cutoff]
        if not train.empty and not test.empty:
            print(f"Using explicit train cutoff from FORECAST_TRAIN_CUTOFF={cutoff_env}", flush=True)
            return train, test, cutoff
        print(
            f"  Ignoring FORECAST_TRAIN_CUTOFF={cutoff_env} because it produced an empty split.",
            flush=True,
        )

    test_days = max(
        1,
        min(
            len(unique_dates) - 1,
            max(FORECAST_HORIZON, math.ceil(len(unique_dates) * (1 - DEFAULT_TRAIN_RATIO))),
        ),
    )
    cutoff = pd.Timestamp(unique_dates[-test_days])
    train = daily[daily["date"] < cutoff]
    test = daily[daily["date"] >= cutoff]
    return train, test, cutoff


def safe_confidence_score(model: xgb.XGBRegressor, features: list[str], test: pd.DataFrame) -> float:
    if test.empty:
        return 0.5

    test_pred = np.clip(model.predict(test[features]), 0, None)
    actuals = test["qty"].values
    mae = float(np.mean(np.abs(test_pred - actuals)))
    rmse = float(np.sqrt(np.mean((test_pred - actuals) ** 2)))
    naive = test["sales_same_day_last_week"].fillna(0).values
    naive_mae = float(np.mean(np.abs(naive - actuals)))
    skill_score = max(0.0, 1 - mae / naive_mae) if naive_mae > 0 else 0.5
    confidence_score = round(skill_score, 4)
    print(
        f"  MAE={mae:.2f}  RMSE={rmse:.2f}  skill_score={confidence_score:.4f}",
        flush=True,
    )
    return confidence_score


def safe_float(val, default: float = 0.0) -> float:
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return default


def to_purchase_units(val: float, size: float) -> float:
    return math.ceil(val / size) if size > 0 else val


parser = argparse.ArgumentParser()
parser.add_argument("--sales-csv", dest="sales_csv")
parser.add_argument("--recipe-csv", dest="recipe_csv")
args = parser.parse_args()

sales_csv_path = resolve_csv_path(args.sales_csv, DEFAULT_SALES_CSV)
recipe_csv_path = resolve_csv_path(args.recipe_csv, DEFAULT_RECIPE_CSV)


# ─────────────────────────────────────────────────────────────────────────────
# Step A — Load & aggregate to daily sales per product
# ─────────────────────────────────────────────────────────────────────────────
sales, sales_source = load_sales_source(sales_csv_path)
print(f"Sales source: {sales_source}", flush=True)
daily = build_daily_sales(sales)
print(
    f"  {len(daily):,} product-day rows across {daily['product_type'].nunique()} products.",
    flush=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Step B — Feature engineering
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
# Step C — Train (time-based split)
# ─────────────────────────────────────────────────────────────────────────────
print("Training XGBoost model …", flush=True)
train, test, cutoff = resolve_train_test_split(daily)
print(
    f"  Train rows: {len(train):,}  Test rows: {len(test):,}  Cutoff: {cutoff.date()}",
    flush=True,
)

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
confidence_score = safe_confidence_score(model, FEATURES, test)


# ─────────────────────────────────────────────────────────────────────────────
# Step D — Predict next 7 days (auto-regressive: append preds back to history)
# ─────────────────────────────────────────────────────────────────────────────
print("Generating 7-day forecast …", flush=True)
last_date = daily["date"].max()
future_dates = [last_date + timedelta(days=d) for d in range(1, FORECAST_HORIZON + 1)]

history = daily.copy()
forecast_rows = []

for fdate in future_dates:
    rows = []
    for product, code in product_codes.items():
        prod_hist = history[history["product_type"] == product].sort_values("date")
        last7 = prod_hist["qty"].iloc[-7:].values if len(prod_hist) >= 1 else np.array([0.0])
        last14 = prod_hist["qty"].iloc[-14:].values if len(prod_hist) >= 1 else np.array([0.0])
        yesterday = float(prod_hist["qty"].iloc[-1]) if len(prod_hist) >= 1 else 0.0

        sdlw_rows = prod_hist[prod_hist["date"] == fdate - timedelta(days=7)]
        sdlw = float(sdlw_rows["qty"].iloc[0]) if len(sdlw_rows) else float(np.mean(last7))

        rows.append(
            {
                "product_type": product,
                "date": fdate,
                "product_code": code,
                "day_of_week": fdate.dayofweek,
                "month": fdate.month,
                "days_since_start": (fdate - daily["date"].min()).days,
                "sales_yesterday": yesterday,
                "sales_same_day_last_week": sdlw,
                "avg_last_7_days": float(np.mean(last7)),
                "avg_last_14_days": float(np.mean(last14)),
            }
        )

    fdf = pd.DataFrame(rows)
    fdf["qty"] = np.clip(model.predict(fdf[FEATURES]), 0, None)
    forecast_rows.append(fdf)
    history = pd.concat([history, fdf[["product_type", "date", "qty"]]], ignore_index=True)

forecast = pd.concat(forecast_rows, ignore_index=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step E — Expand predictions through recipe mapping → ingredient-level demand
# ─────────────────────────────────────────────────────────────────────────────
recipes, recipe_source = load_recipe_source(recipe_csv_path)
print(f"Recipe source: {recipe_source}", flush=True)

print("Loading live inventory from Supabase items table …", flush=True)
ingrs_raw = fetch_all(
    "items",
    "product_name,quantity_remaining,unit,purchase_unit,purchase_unit_size",
)
if not ingrs_raw:
    sys.exit("ERROR: items table is empty — inventory data is required for ordering forecasts.")

ingrs = pd.DataFrame(ingrs_raw).rename(
    columns={"product_name": "name", "quantity_remaining": "current_stock_pu"}
)
ingrs["name"] = coerce_string(ingrs["name"])

product_totals = (
    forecast.groupby("product_type")["qty"]
    .sum()
    .reset_index()
    .rename(columns={"qty": "total_predicted_qty"})
)

expanded = product_totals.merge(recipes, on="product_type", how="inner")
if expanded.empty:
    missing_products = sorted(product_totals["product_type"].unique().tolist())
    sys.exit(
        "ERROR: recipe input did not match any forecasted products. "
        f"Forecasted products: {missing_products}"
    )

expanded["ingredient_demand"] = (
    expanded["total_predicted_qty"] * expanded["quantity_per_unit"]
)

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

daily_ingr = (
    forecast.merge(recipes, on="product_type", how="inner")
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
ingr_demand["current_stock_pu"] = pd.to_numeric(
    ingr_demand["current_stock_pu"], errors="coerce"
).fillna(0)
ingr_demand["purchase_unit_size"] = pd.to_numeric(
    ingr_demand["purchase_unit_size"], errors="coerce"
).fillna(1)
ingr_demand["purchase_unit"] = coerce_string(ingr_demand["purchase_unit"]).fillna(
    ingr_demand["unit"]
)

ingr_demand["predicted_demand_pu"] = ingr_demand.apply(
    lambda r: to_purchase_units(r["predicted_demand"], r["purchase_unit_size"]),
    axis=1,
)
ingr_demand["current_stock_pu"] = ingr_demand["current_stock_pu"].apply(math.ceil)
ingr_demand["safety_stock_pu"] = ingr_demand.apply(
    lambda r: to_purchase_units(r["safety_stock"], r["purchase_unit_size"]),
    axis=1,
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
retrained_at = datetime.now(timezone.utc).isoformat()

upsert_rows = [
    {
        "ingredient_name": str(row["ingredient_name"])
        if row["ingredient_name"] == row["ingredient_name"]
        else "",
        "forecast_date": forecast_date,
        "predicted_demand": safe_float(row["predicted_demand_pu"]),
        "current_stock": safe_float(row["current_stock_pu"]),
        "safety_stock": safe_float(row["safety_stock_pu"]),
        "recommended_order": safe_float(row["recommended_order_pu"]),
        "unit": str(row["purchase_unit"]) if row["purchase_unit"] == row["purchase_unit"] else "",
        "confidence_score": safe_float(confidence_score),
        "created_at": retrained_at,
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
