import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywordsParam = searchParams.get("keywords");
  const filterKeywords = keywordsParam
    ? keywordsParam.split(",").map((k) => k.trim()).filter(Boolean)
    : null;

  let query = supabase
    .from("google_trends")
    .select("keyword, date, interest")
    .order("date", { ascending: true });

  if (filterKeywords && filterKeywords.length > 0) {
    query = query.in("keyword", filterKeywords);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by keyword
  const map = new Map<string, { date: string; interest: number }[]>();
  for (const row of data ?? []) {
    if (!map.has(row.keyword)) map.set(row.keyword, []);
    map.get(row.keyword)!.push({ date: row.date, interest: row.interest });
  }

  const trends = Array.from(map.entries()).map(([keyword, data]) => ({
    keyword,
    data,
  }));

  return NextResponse.json({ trends });
}
