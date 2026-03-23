#!/usr/bin/env python3
"""
seed_sales_history.py
─────────────────────
Loads the Kaggle Maven Roasters CSV into the Supabase `sales_history` table.

Usage:
    python scripts/seed_sales_history.py path/to/Coffee_Shop_Sales.csv

Requirements:
    pip install supabase pandas python-dotenv tqdm

The script reads credentials from .env.local (NEXT_PUBLIC_SUPABASE_URL +
NEXT_PUBLIC_SUPABASE_ANON_KEY).  It inserts in batches of 500 rows and
skips rows that are already present (via ON CONFLICT DO NOTHING on the
Supabase upsert).
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
from supabase import create_client
from tqdm import tqdm

# ── Config ────────────────────────────────────────────────────────────────────
BATCH_SIZE = 500

# ── Load env ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY "
        "must be set in .env.local"
    )

# ── CLI arg ───────────────────────────────────────────────────────────────────
if len(sys.argv) < 2:
    sys.exit("Usage: python scripts/seed_sales_history.py <path_to_csv>")

csv_path = Path(sys.argv[1])
if not csv_path.exists():
    sys.exit(f"ERROR: File not found: {csv_path}")

# ── Load CSV ──────────────────────────────────────────────────────────────────
print(f"Reading {csv_path} …")
df = pd.read_csv(csv_path, sep="|", engine="python")

# Normalise column names to lowercase with underscores
df.columns = (
    df.columns
    .str.strip()
    .str.lower()
    .str.replace(r"[\s\-]+", "_", regex=True)
)

print(f"  {len(df):,} rows loaded")
print(f"  Columns: {list(df.columns)}")

# ── Expected columns (Maven Roasters schema) ──────────────────────────────────
COLUMN_MAP = {
    # csv_column_name       : db_column_name
    "transaction_id"        : "transaction_id",
    "transaction_date"      : "transaction_date",
    "transaction_time"      : "transaction_time",
    "transaction_qty"       : "transaction_qty",
    "store_id"              : "store_id",
    "store_location"        : "store_location",
    "product_id"            : "product_id",
    "unit_price"            : "unit_price",
    "product_category"      : "product_category",
    "product_type"          : "product_type",
    "product_detail"        : "product_detail",
}

# Keep only columns that exist in the CSV (some exports omit optional ones)
available = {k: v for k, v in COLUMN_MAP.items() if k in df.columns}
missing_required = {"transaction_date", "transaction_time", "transaction_qty"} - set(available)
if missing_required:
    sys.exit(f"ERROR: Required columns missing from CSV: {missing_required}")

df = df[list(available.keys())].rename(columns=available)

# ── Parse & clean ─────────────────────────────────────────────────────────────
# Maven Roasters uses MM/DD/YYYY; fall back to pandas auto-detect
df["transaction_date"] = pd.to_datetime(
    df["transaction_date"]
).dt.strftime("%Y-%m-%d")

# Ensure time is HH:MM:SS string
df["transaction_time"] = df["transaction_time"].astype(str).str.strip()

# Integer columns — fill NaN with 0
for col in ["transaction_qty", "store_id", "product_id", "transaction_id"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

# Float columns
if "unit_price" in df.columns:
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")

# String columns — strip whitespace, replace NaN with None
for col in ["store_location", "product_category", "product_type", "product_detail"]:
    if col in df.columns:
        df[col] = df[col].astype(str).str.strip().replace("nan", None)

print(f"  Date range: {df['transaction_date'].min()} → {df['transaction_date'].max()}")
print(f"  Product types: {sorted(df['product_type'].dropna().unique().tolist())}")

# ── Connect to Supabase ───────────────────────────────────────────────────────
print("\nConnecting to Supabase …")
client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Optional: clear existing data ────────────────────────────────────────────
if "--replace" in sys.argv:
    print("  --replace flag detected, truncating sales_history …")
    # Delete all rows (Supabase REST doesn't have TRUNCATE; delete with always-true filter)
    client.table("sales_history").delete().neq("id", 0).execute()
    print("  Table cleared.")

# ── Batch insert ──────────────────────────────────────────────────────────────
records = df.where(pd.notna(df), None).to_dict(orient="records")
total_batches = (len(records) + BATCH_SIZE - 1) // BATCH_SIZE
inserted = 0
errors = 0

print(f"\nInserting {len(records):,} rows in {total_batches} batches of {BATCH_SIZE} …")

for i in tqdm(range(0, len(records), BATCH_SIZE), total=total_batches, unit="batch"):
    batch = records[i : i + BATCH_SIZE]
    try:
        # upsert with ignoreDuplicates so re-runs are safe
        client.table("sales_history").upsert(
            batch, ignore_duplicates=True
        ).execute()
        inserted += len(batch)
    except Exception as e:
        errors += len(batch)
        tqdm.write(f"  Batch {i // BATCH_SIZE + 1} failed: {e}")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\nDone.")
print(f"  Attempted : {len(records):,}")
print(f"  Inserted  : {inserted:,}")
if errors:
    print(f"  Errors    : {errors:,}  (rows in failed batches — re-run to retry)")
