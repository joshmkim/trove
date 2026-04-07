#!/usr/bin/env python3
"""
backtest_forecast.py
────────────────────
Rolling 7-day backtest for the demand forecast model.

This script reads the sales CSV, trains on data available before each forecast
window, predicts the next 7 days, and compares those predictions with the
actual sales observed in the holdout month. It does not read or write
`demand_forecasts`, and it does not affect the UI.

Usage:
    python scripts/backtest_forecast.py
    python scripts/backtest_forecast.py --sales-csv trove_sales_data.csv
    python scripts/backtest_forecast.py --holdout-month 2025-12
"""

import argparse
import math
import sys
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

FORECAST_HORIZON = 7
DEFAULT_SALES_CSV = "trove_sales_data.csv"
CSV_SEARCH_DIRS = ("", "data", "scripts")
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


def resolve_csv_path(explicit_path: str | None, default_name: str) -> Path:
    root = Path(__file__).resolve().parent.parent
    if explicit_path:
        path = Path(explicit_path).expanduser()
        if not path.is_absolute():
            path = root / path
        if not path.exists():
            sys.exit(f"ERROR: CSV file not found: {path}")
        return path

    for rel_dir in CSV_SEARCH_DIRS:
        candidate = root / rel_dir / default_name if rel_dir else root / default_name
        if candidate.exists():
            return candidate

    sys.exit(
        f"ERROR: could not find `{default_name}` in the repo root, `data/`, or `scripts/`."
    )


def find_first_column(df: pd.DataFrame, candidates: list[str], label: str) -> str:
    for name in candidates:
        if name in df.columns:
            return name
    sys.exit(
        f"ERROR: could not infer `{label}` column. Available columns: {list(df.columns)}"
    )


def coerce_string(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().replace({"": None, "nan": None, "None": None})


def load_sales(csv_path: Path) -> pd.DataFrame:
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

    sales = sales[[date_col, product_col, qty_col]].rename(
        columns={
            date_col: "transaction_date",
            product_col: "product_type",
            qty_col: "transaction_qty",
        }
    )
    sales["transaction_date"] = pd.to_datetime(
        sales["transaction_date"], errors="coerce"
    ).dt.normalize()
    sales["product_type"] = coerce_string(sales["product_type"])
    sales["transaction_qty"] = pd.to_numeric(sales["transaction_qty"], errors="coerce")
    sales = sales.dropna(
        subset=["transaction_date", "product_type", "transaction_qty"]
    ).reset_index(drop=True)

    if sales.empty:
        sys.exit("ERROR: no usable sales rows were found after parsing input data.")

    return sales


def build_daily_sales(sales: pd.DataFrame, products: list[str] | None = None) -> pd.DataFrame:
    daily = (
        sales.groupby(["product_type", "transaction_date"])["transaction_qty"]
        .sum()
        .reset_index()
        .rename(columns={"transaction_date": "date", "transaction_qty": "qty"})
    )

    if daily.empty:
        return daily

    all_dates = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    product_list = products or sorted(daily["product_type"].unique().tolist())
    idx = pd.MultiIndex.from_product([product_list, all_dates], names=["product_type", "date"])

    daily = (
        daily.set_index(["product_type", "date"])
        .reindex(idx, fill_value=0)
        .reset_index()
        .sort_values(["product_type", "date"])
        .reset_index(drop=True)
    )
    return daily


def engineer_features(daily: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    daily = daily.copy()
    daily["day_of_week"] = daily["date"].dt.dayofweek
    daily["month"] = daily["date"].dt.month
    daily["days_since_start"] = (daily["date"] - daily["date"].min()).dt.days

    grouped = daily.groupby("product_type")["qty"]
    daily["sales_yesterday"] = grouped.shift(1)
    daily["sales_same_day_last_week"] = grouped.shift(7)
    daily["avg_last_7_days"] = grouped.transform(
        lambda s: s.shift(1).rolling(7, min_periods=1).mean()
    )
    daily["avg_last_14_days"] = grouped.transform(
        lambda s: s.shift(1).rolling(14, min_periods=1).mean()
    )

    daily = daily.dropna(subset=["sales_yesterday"]).reset_index(drop=True)
    if daily.empty:
        sys.exit("ERROR: not enough historical data to build lag features.")

    product_codes = {
        product: idx
        for idx, product in enumerate(sorted(daily["product_type"].unique().tolist()))
    }
    daily["product_code"] = daily["product_type"].map(product_codes)
    return daily, product_codes


def fit_model(train_frame: pd.DataFrame) -> xgb.XGBRegressor:
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
    model.fit(train_frame[FEATURES], train_frame["qty"])
    return model


def forecast_window(
    model: xgb.XGBRegressor,
    history_daily: pd.DataFrame,
    product_codes: dict[str, int],
    start_date: pd.Timestamp,
    window_days: int,
) -> pd.DataFrame:
    history = history_daily[["product_type", "date", "qty"]].copy()
    history_start = history["date"].min()
    forecast_rows = []

    for step in range(window_days):
        fdate = start_date + timedelta(days=step)
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
                    "days_since_start": (fdate - history_start).days,
                    "sales_yesterday": yesterday,
                    "sales_same_day_last_week": sdlw,
                    "avg_last_7_days": float(np.mean(last7)),
                    "avg_last_14_days": float(np.mean(last14)),
                }
            )

        forecast_step = pd.DataFrame(rows)
        forecast_step["predicted_qty"] = np.clip(
            model.predict(forecast_step[FEATURES]),
            0,
            None,
        )
        forecast_rows.append(forecast_step[["product_type", "date", "predicted_qty"]])

        history = pd.concat(
            [
                history,
                forecast_step.rename(columns={"predicted_qty": "qty"})[
                    ["product_type", "date", "qty"]
                ],
            ],
            ignore_index=True,
        )

    return pd.concat(forecast_rows, ignore_index=True)


def build_actual_lookup(full_daily: pd.DataFrame) -> pd.DataFrame:
    return full_daily.rename(columns={"qty": "actual_qty"})[["product_type", "date", "actual_qty"]]


def window_starts_for_month(month_start: pd.Timestamp, month_end: pd.Timestamp) -> list[pd.Timestamp]:
    starts = []
    current = month_start
    while current <= month_end:
        starts.append(current)
        current = current + timedelta(days=FORECAST_HORIZON)
    return starts


def month_bounds(month_str: str | None, sales: pd.DataFrame) -> tuple[pd.Timestamp, pd.Timestamp]:
    if month_str:
        month_start = pd.Timestamp(f"{month_str}-01")
    else:
        month_start = sales["transaction_date"].max().to_period("M").to_timestamp()

    month_end = month_start + pd.offsets.MonthEnd(1)
    return month_start, pd.Timestamp(month_end)


def format_signed(value: float) -> str:
    rounded = round(value, 2)
    return f"+{rounded}" if rounded > 0 else str(rounded)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sales-csv", dest="sales_csv")
    parser.add_argument("--holdout-month", dest="holdout_month")
    args = parser.parse_args()

    csv_path = resolve_csv_path(args.sales_csv, DEFAULT_SALES_CSV)
    sales = load_sales(csv_path)
    full_daily = build_daily_sales(sales)
    actual_lookup = build_actual_lookup(full_daily)

    holdout_start, holdout_end = month_bounds(args.holdout_month, sales)
    if holdout_start < sales["transaction_date"].min() or holdout_end > sales["transaction_date"].max():
        sys.exit(
            f"ERROR: holdout month {holdout_start.strftime('%Y-%m')} is outside the sales date range."
        )

    print(f"Sales source: {csv_path}")
    print(
        f"Date range: {sales['transaction_date'].min().date()} to {sales['transaction_date'].max().date()}"
    )
    print(f"Holdout month: {holdout_start.strftime('%Y-%m')} ({holdout_start.date()} to {holdout_end.date()})")
    print("Backtest mode: rolling 7-day windows, no Supabase writes")
    print("")

    window_results = []
    all_predictions = []

    for window_start in window_starts_for_month(holdout_start, holdout_end):
        train_sales = sales[sales["transaction_date"] < window_start].copy()
        if train_sales.empty:
            sys.exit(f"ERROR: no training data available before {window_start.date()}.")

        training_daily = build_daily_sales(train_sales)
        train_frame, product_codes = engineer_features(training_daily)
        model = fit_model(train_frame)

        window_end = min(window_start + timedelta(days=FORECAST_HORIZON - 1), holdout_end)
        window_days = (window_end - window_start).days + 1
        predictions = forecast_window(
            model=model,
            history_daily=training_daily,
            product_codes=product_codes,
            start_date=window_start,
            window_days=window_days,
        )
        predictions["window_start"] = window_start
        all_predictions.append(predictions)

        actuals = actual_lookup[
            (actual_lookup["date"] >= window_start) & (actual_lookup["date"] <= window_end)
        ]
        comparison = predictions.merge(
            actuals,
            on=["product_type", "date"],
            how="left",
        )
        comparison["actual_qty"] = comparison["actual_qty"].fillna(0)
        comparison["abs_error"] = (comparison["predicted_qty"] - comparison["actual_qty"]).abs()

        window_results.append(
            {
                "window_start": window_start,
                "window_end": window_end,
                "training_start": train_sales["transaction_date"].min(),
                "training_end": train_sales["transaction_date"].max(),
                "predicted_total": float(comparison["predicted_qty"].sum()),
                "actual_total": float(comparison["actual_qty"].sum()),
                "absolute_error": float(comparison["abs_error"].sum()),
            }
        )

    all_predictions_df = pd.concat(all_predictions, ignore_index=True)
    all_actuals = actual_lookup[
        (actual_lookup["date"] >= holdout_start) & (actual_lookup["date"] <= holdout_end)
    ]
    full_comparison = all_predictions_df.merge(
        all_actuals,
        on=["product_type", "date"],
        how="left",
    )
    full_comparison["actual_qty"] = full_comparison["actual_qty"].fillna(0)
    full_comparison["error"] = full_comparison["predicted_qty"] - full_comparison["actual_qty"]
    full_comparison["abs_error"] = full_comparison["error"].abs()

    print("Window totals")
    for row in window_results:
        print(
            f"{row['window_start'].date()} to {row['window_end'].date()} | "
            f"trained on {row['training_start'].date()} to {row['training_end'].date()} | "
            f"predicted {row['predicted_total']:.2f} units | "
            f"actual {row['actual_total']:.2f} units | "
            f"difference {format_signed(row['predicted_total'] - row['actual_total'])} units | "
            f"absolute error {row['absolute_error']:.2f}"
        )

    print("")
    monthly_predicted = float(full_comparison["predicted_qty"].sum())
    monthly_actual = float(full_comparison["actual_qty"].sum())
    print("Month total")
    print(
        f"{holdout_start.strftime('%Y-%m')} | predicted {monthly_predicted:.2f} units | "
        f"actual {monthly_actual:.2f} units | "
        f"difference {format_signed(monthly_predicted - monthly_actual)} units | "
        f"absolute error {float(full_comparison['abs_error'].sum()):.2f}"
    )

    print("")
    print("Largest product-level misses")
    product_rollup = (
        full_comparison.groupby("product_type")[["predicted_qty", "actual_qty", "abs_error"]]
        .sum()
        .reset_index()
        .sort_values("abs_error", ascending=False)
    )
    for _, row in product_rollup.head(10).iterrows():
        diff = row["predicted_qty"] - row["actual_qty"]
        print(
            f"{row['product_type']} | predicted {row['predicted_qty']:.2f} | "
            f"actual {row['actual_qty']:.2f} | difference {format_signed(diff)} | "
            f"absolute error {row['abs_error']:.2f}"
        )


if __name__ == "__main__":
    main()
