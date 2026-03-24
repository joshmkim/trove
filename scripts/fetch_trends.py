#!/usr/bin/env python3
"""
Ask an LLM for currently trending café/bakery items, then validate each
keyword against Google Trends and upsert the results into Supabase.

Dependencies:
  pip install pytrends supabase openai

Usage:
  python scripts/fetch_trends.py
"""

import json
import os
import time

from openai import OpenAI
from pytrends.request import TrendReq
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
TIMEFRAME      = "today 3-m"   # last 90 days
GEO            = "US"
BATCH_SIZE     = 5             # pytrends max per request
MIN_PEAK       = 10            # drop keywords where max interest < this
TARGET_KEYWORDS = 20           # ask the LLM for this many

SUPABASE_URL            = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY            = os.environ["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]
AZURE_OPENAI_KEY        = os.environ["AZURE_OPENAI_KEY"]
AZURE_OPENAI_ENDPOINT   = os.environ["AZURE_OPENAI_ENDPOINT"]
AZURE_OPENAI_DEPLOYMENT = os.environ["AZURE_OPENAI_DEPLOYMENT"]

# ── Clients ───────────────────────────────────────────────────────────────────
sb  = create_client(SUPABASE_URL, SUPABASE_KEY)
oai = OpenAI(
    api_key=AZURE_OPENAI_KEY,
    base_url=f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}",
    default_query={"api-version": "2024-02-01"},
    default_headers={"api-key": AZURE_OPENAI_KEY},
)
pytrends = TrendReq(hl="en-US", tz=360)


# ── Step 1: Ask OpenAI for trending café/bakery keywords ─────────────────────
print("Asking OpenAI for trending café/bakery keywords…")

prompt = f"""You are a food trend analyst specializing in café and bakery culture.
List exactly {TARGET_KEYWORDS} currently trending café or bakery menu items that
consumers in the US are actively searching for online.

Rules:
- Phrase each keyword exactly as a consumer would type it into Google Search
  (e.g. "pistachio latte", not "latte with pistachio flavoring")
- Prefer specific items over broad categories (e.g. "brown butter croissant" > "pastry")
- Include a mix of drinks, pastries, and food items
- Lean toward items that have been building cultural momentum in 2025-2026

Respond with ONLY a JSON array of strings, no commentary.
Example: ["matcha latte", "croffles", "cheese foam tea"]"""

response = oai.chat.completions.create(
    model=AZURE_OPENAI_DEPLOYMENT,
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"},
    temperature=0.7,
)

raw = response.choices[0].message.content or "{}"
parsed = json.loads(raw)

# The model may wrap the array in a key — find the first list value
keywords: list[str] = []
if isinstance(parsed, list):
    keywords = parsed
else:
    for v in parsed.values():
        if isinstance(v, list):
            keywords = v
            break

if not keywords:
    print("OpenAI returned no keywords. Exiting.")
    exit(1)

# Deduplicate and normalise casing
keywords = list(dict.fromkeys(k.strip().lower() for k in keywords if k.strip()))
print(f"Got {len(keywords)} keywords: {keywords}\n")


# ── Step 2: Fetch Google Trends for each batch ───────────────────────────────
print("Fetching Google Trends data…")
all_rows: list[dict] = []
tracked_keywords: list[str] = []

for i in range(0, len(keywords), BATCH_SIZE):
    batch = keywords[i : i + BATCH_SIZE]
    print(f"  Batch {i // BATCH_SIZE + 1}: {batch}")

    try:
        pytrends.build_payload(batch, timeframe=TIMEFRAME, geo=GEO)
        df = pytrends.interest_over_time()
    except Exception as e:
        print(f"  pytrends error for batch {batch}: {e}")
        time.sleep(5)
        continue

    if df.empty:
        print(f"  No data returned — skipping.")
        if i + BATCH_SIZE < len(keywords):
            time.sleep(2)
        continue

    if "isPartial" in df.columns:
        df = df.drop(columns=["isPartial"])

    for keyword in batch:
        if keyword not in df.columns:
            continue
        col = df[keyword]
        if col.max() < MIN_PEAK:
            print(f"  '{keyword}' peak={col.max()} < {MIN_PEAK} — skipping (not tracked enough)")
            continue

        tracked_keywords.append(keyword)
        for ts, interest in col.items():
            all_rows.append({
                "keyword":  keyword,
                "date":     ts.strftime("%Y-%m-%d"),
                "interest": int(interest),
            })

    # Be polite to the unofficial API
    if i + BATCH_SIZE < len(keywords):
        time.sleep(2)

if not all_rows:
    print("\nNo trend data passed the threshold. Exiting.")
    exit(0)

print(f"\nTracked {len(tracked_keywords)} keywords after filtering: {tracked_keywords}")


# ── Step 3: Delete existing rows, insert fresh data ──────────────────────────
print("\nUpserting into Supabase…")
sb.table("google_trends").delete().in_("keyword", tracked_keywords).execute()

CHUNK = 500
for j in range(0, len(all_rows), CHUNK):
    sb.table("google_trends").insert(all_rows[j : j + CHUNK]).execute()

print(f"Done. Inserted {len(all_rows)} rows for {len(tracked_keywords)} keywords.")
