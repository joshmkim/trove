"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import PageHeader from "@/components/layout/PageHeader";
import { supabase } from "@/lib/supabase";
import { itemRowToInventoryItem, type InventoryItem, type ItemRow } from "@/lib/types";
import { INVENTORY_REFRESH_EVENT, dispatchInventoryRefresh } from "@/lib/inventoryEvents";

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

const PRODUCT_IMAGES: Record<string, string> = {
  "Matcha Powder": "/matcha.webp",
  "Vanilla Syrup":  "/syrup.png",
};

function StockCard({ item }: { item: InventoryItem }) {
  const isLow = item.stockLevel === "Low";
  const imgSrc = PRODUCT_IMAGES[item.productName];
  return (
    <div className="bg-white rounded-xl border border-light-gray p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        {imgSrc && (
          <div className="relative w-14 h-14 shrink-0">
            <Image
              src={imgSrc}
              alt={item.productName}
              fill
              className="rounded-lg object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-charcoal">{item.productName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${isLow ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
              {isLow ? "Low" : "In Stock"}
            </span>
          </div>
          <p className="text-xs text-warm-gray mt-0.5">{item.quantityRemaining.toFixed(0)}g remaining</p>
          <div className="h-2 rounded-full bg-light-gray overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${isLow ? "bg-red-400" : "bg-green-500"}`}
              style={{ width: `${item.stockPercent}%` }}
            />
          </div>
        </div>
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

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function AddStockModal({ open, onClose, onAdded }: AddStockModalProps) {
  const [ingredient, setIngredient] = useState(TRACKED_INGREDIENTS[0]);
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setQty(""); setError(null); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Enter a valid quantity greater than 0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/apply-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productName: ingredient, qtyIn: qtyNum, skuId: "" }],
          invoice: { filename: "manual-add.pdf", fileSize: null },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update inventory.");
      }
      dispatchInventoryRefresh();
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-[360px]">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-light-gray">
            <h2 className="text-lg font-semibold text-charcoal">Add Stock</h2>
            <p className="text-xs text-warm-gray mt-0.5">Manually record received inventory</p>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-warm-gray mb-1.5">Ingredient</label>
                <div className="relative">
                  <select
                    value={ingredient}
                    onChange={(e) => setIngredient(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-sm text-charcoal border border-light-gray rounded-md outline-none focus:border-warm-gray transition-colors bg-white cursor-pointer"
                  >
                    {TRACKED_INGREDIENTS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-warm-gray mb-1.5">
                  Quantity received
                  <span className="ml-1 font-normal text-warm-gray/70">· boxes or bags</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g. 2"
                  autoFocus
                  className="w-full px-3 py-2 text-sm text-charcoal border border-light-gray rounded-md outline-none focus:border-warm-gray transition-colors placeholder:text-warm-gray/40"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2 text-sm text-charcoal border border-light-gray rounded-md hover:bg-cream/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !qty}
                className="flex-1 py-2 text-sm font-medium text-white bg-charcoal rounded-md hover:bg-charcoal/90 disabled:opacity-40 transition-colors"
              >
                {saving ? "Adding…" : "Add to Stock"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function HarucakeInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addStockOpen, setAddStockOpen] = useState(false);
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

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function runSync() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await fetch("/api/clover/sync", { method: "POST" });
      // Refresh both orders and ingredient stock after every sync
      await Promise.all([fetchOrderHistory(), fetchIngredients()]);
      setLastSyncedAt(
        new Date().toLocaleString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        })
      );
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

    // Invoice applied from any page → refresh ingredient stock immediately
    const handleInvoiceApplied = () => { void fetchIngredients(); };
    window.addEventListener(INVENTORY_REFRESH_EVENT, handleInvoiceApplied);

    // Realtime: ingredient stock changes (e.g. from deductions)
    const itemsChannel = supabase
      .channel("clover-ingredients")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () =>
        void fetchIngredients()
      )
      .subscribe();

    // Realtime: new orders inserted by the sync (shows up instantly rather than on next poll)
    const ordersChannel = supabase
      .channel("clover-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clover_processed_orders" }, () =>
        void fetchOrderHistory()
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener(INVENTORY_REFRESH_EVENT, handleInvoiceApplied);
      void supabase.removeChannel(itemsChannel);
      void supabase.removeChannel(ordersChannel);
    };
  }, [fetchIngredients]);

  return (
    <div>
      <AddStockModal
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        onAdded={fetchIngredients}
      />
      <PageHeader
        title="Ingredient Tracking"
        actionButton={
          <button
            onClick={() => setAddStockOpen(true)}
            className="px-4 py-2 rounded-lg bg-charcoal text-white text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            + Add Stock
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* API connection status */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            {verifying ? (
              <><span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" /><span className="text-warm-gray">Checking Clover connection…</span></>
            ) : apiStatus?.ok ? (
              <><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /><span className="text-warm-gray">Connected to Clover{apiStatus.merchantName && <span className="text-charcoal font-medium"> · {apiStatus.merchantName}</span>}</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="text-red-600">Clover not connected{apiStatus?.missing?.length ? ` — missing: ${apiStatus.missing.join(", ")}` : apiStatus?.error ? ` — ${apiStatus.error}` : ""}</span><button onClick={() => void verifyApi()} className="ml-2 text-xs underline text-warm-gray hover:text-charcoal">Retry</button></>
            )}
          </div>
          {lastSyncedAt && (
            <span className="text-xs text-warm-gray">Synced {lastSyncedAt}</span>
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
