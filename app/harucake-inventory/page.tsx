"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { supabase } from "@/lib/supabase";
import { itemRowToInventoryItem, type InventoryItem, type ItemRow } from "@/lib/types";

const TRACKED_INGREDIENTS = ["Vanilla Syrup", "Matcha Powder"];
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

interface VerifyResult {
  ok: boolean;
  merchantName?: string;
  error?: string;
  missing?: string[];
}

interface OrderRecord {
  clover_order_id: string;
  order_created_at: string | null;
  line_item_count: number;
  line_items: Array<{ name: string; quantity: number; price: number }> | null;
  deducted: Array<{ ingredient: string; amount: number; unit: string }> | null;
}

function StockCard({ item }: { item: InventoryItem }) {
  const isLow = item.stockLevel === "Low";
  return (
    <div className="bg-white rounded-xl border border-light-gray p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-semibold text-charcoal">{item.productName}</p>
          <p className="text-xs text-warm-gray mt-0.5">{item.quantityRemaining.toFixed(0)}g remaining</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLow ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
          {isLow ? "Low" : "In Stock"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-light-gray overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-green-500"}`}
          style={{ width: `${item.stockPercent}%` }}
        />
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: OrderRecord }) {
  const [expanded, setExpanded] = useState(false);
  const time = order.order_created_at
    ? new Date(order.order_created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

  const itemSummary = order.line_items?.map((li) => li.name).join(", ") ?? "—";

  return (
    <div className="border-b border-light-gray last:border-0">
      <button
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-cream/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4">
          <span className="text-xs text-warm-gray w-28 shrink-0">{time}</span>
          <span className="text-sm text-charcoal truncate max-w-[320px]">{itemSummary}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-warm-gray">{order.line_item_count} item{order.line_item_count !== 1 ? "s" : ""}</span>
          <svg className={`w-4 h-4 text-warm-gray transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="pb-3 px-1 space-y-3">
          {order.line_items && order.line_items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-warm-gray mb-1">Items sold</p>
              <div className="space-y-0.5">
                {order.line_items.map((li, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-charcoal">{li.name}</span>
                    <span className="text-warm-gray">${((li.price ?? 0) / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {order.deducted && order.deducted.length > 0 && (
            <div>
              <p className="text-xs font-medium text-warm-gray mb-1">Ingredients deducted</p>
              <div className="space-y-0.5">
                {order.deducted.map((d, i) => (
                  <div key={i} className="text-sm text-charcoal">
                    {d.ingredient} <span className="text-warm-gray">−{d.amount.toFixed(0)}{d.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!order.deducted || order.deducted.length === 0) && (
            <p className="text-xs text-warm-gray">No tracked ingredients in this order.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HarucakeInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const syncingRef = useRef(false);

  const fetchIngredients = useCallback(async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .in("product_name", TRACKED_INGREDIENTS);
    if (!error && data) setItems((data as ItemRow[]).map(itemRowToInventoryItem));
    setLoading(false);
  }, []);

  async function fetchOrderHistory() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 2);
    since.setUTCHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("clover_processed_orders")
      .select("clover_order_id, order_created_at, line_item_count, line_items, deducted")
      .gte("order_created_at", since.toISOString())
      .order("order_created_at", { ascending: false })
      .limit(50);

    if (data) setOrders(data as OrderRecord[]);
  }

  async function verifyApi() {
    setVerifying(true);
    try {
      const res = await fetch("/api/clover/verify");
      setApiStatus((await res.json()) as VerifyResult);
    } catch {
      setApiStatus({ ok: false, error: "Could not reach verify endpoint" });
    } finally {
      setVerifying(false);
    }
  }

  async function runSync() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await fetch("/api/clover/sync", { method: "POST" });
      await fetchOrderHistory();
    } finally {
      syncingRef.current = false;
    }
  }

  useEffect(() => {
    void fetchIngredients();
    void fetchOrderHistory();
    void verifyApi();
    void runSync();

    const pollInterval = setInterval(() => { void runSync(); }, POLL_INTERVAL_MS);

    const channel = supabase
      .channel("clover-ingredients")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () =>
        void fetchIngredients()
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      void supabase.removeChannel(channel);
    };
  }, [fetchIngredients]);

  return (
    <div>
      <PageHeader title="Ingredient Tracking" />

      <div className="px-6 py-6 space-y-4">
        {/* API connection status */}
        <div className="flex items-center gap-2 text-sm">
          {verifying ? (
            <><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span className="text-warm-gray">Checking Clover connection…</span></>
          ) : apiStatus?.ok ? (
            <><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /><span className="text-warm-gray">Connected to Clover{apiStatus.merchantName && <span className="text-charcoal font-medium"> · {apiStatus.merchantName}</span>}</span></>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="text-red-600">Clover not connected{apiStatus?.missing?.length ? ` — missing: ${apiStatus.missing.join(", ")}` : apiStatus?.error ? ` — ${apiStatus.error}` : ""}</span><button onClick={() => void verifyApi()} className="ml-2 text-xs underline text-warm-gray hover:text-charcoal">Retry</button></>
          )}
        </div>

        {/* Ingredient cards */}
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-3">Tracked Ingredients</h2>
          {loading ? (
            <div className="py-8 text-center text-sm text-warm-gray">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-warm-gray">No tracked ingredients found. Run the migration to seed inventory.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => <StockCard key={item.id} item={item} />)}
            </div>
          )}
        </div>

        {/* Order history */}
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-3">
            Recent Orders
            {orders.length > 0 && <span className="ml-2 font-normal normal-case text-warm-gray">({orders.length})</span>}
          </h2>
          <div className="bg-white border border-light-gray rounded-xl px-4">
            {orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-warm-gray">No orders in the last 2 days.</p>
            ) : (
              orders.map((o) => <OrderRow key={o.clover_order_id} order={o} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
