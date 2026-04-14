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
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
FORECAST_HORIZON = 7
TEST_DAYS = 7               # hold-out window for evaluation
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
print("Done.", flush=True)
