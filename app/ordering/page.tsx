"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import OrderFilters from "@/components/ordering/OrderFilters";
import OrdersTable from "@/components/ordering/OrdersTable";
import OrderDetailModal from "@/components/ordering/OrderDetailModal";
import TabBar from "@/components/ui/TabBar";
import Button from "@/components/ui/Button";
import RecommendedOrders from "@/components/ordering/RecommendedOrders";
import CreateOrderModal from "@/components/ordering/CreateOrderModal";
import { supabase } from "@/lib/supabase";
import {
  orderRowToPurchaseOrder,
  forecastRowToForecast,
  type PurchaseOrder,
  type PurchaseOrderRow,
  type DemandForecast,
  type DemandForecastRow,
} from "@/lib/types";

const TABS = ["All", "Pending", "Accepted", "Completed", "Cancelled"];

export default function OrderingPage() {
  const [activeTab, setActiveTab]                     = useState("All");
  const [orders, setOrders]                           = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [forecasts, setForecasts]                     = useState<DemandForecast[]>([]);
  const [createOpen, setCreateOpen]                   = useState(false);
  const [selectedOrderId, setSelectedOrderId]         = useState<string | null>(null);
  const [vendorQuery, setVendorQuery]                 = useState("");
  const [fromDate, setFromDate]                       = useState("");
  const [forecastRefreshTrigger, setForecastRefreshTrigger] = useState(0);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  // ── Fetch orders (with items join) ──────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("order_date", { ascending: false });

    if (!error && data) {
      setOrders((data as PurchaseOrderRow[]).map(orderRowToPurchaseOrder));
    } else {
      setOrders([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Re-fetch live stock in RecommendedOrders every time the page mounts
  useEffect(() => { setForecastRefreshTrigger((n) => n + 1); }, []);

  // ── Fetch forecasts for Create Order modal ──────────────────────────────────
  useEffect(() => {
    async function fetchForecasts() {
      const { data: latestForecast, error: latestErr } = await supabase
        .from("demand_forecasts")
        .select("forecast_date")
        .order("forecast_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr || !latestForecast?.forecast_date) {
        setForecasts([]);
        return;
      }

      const { data, error } = await supabase
        .from("demand_forecasts")
        .select("*")
        .eq("forecast_date", latestForecast.forecast_date)
        .in("ingredient_name", ["Matcha Powder", "Vanilla Syrup"])
        .order("ingredient_name", { ascending: true });

      if (!error && data && data.length > 0) {
        setForecasts((data as DemandForecastRow[]).map(forecastRowToForecast));
      } else {
        setForecasts([]);
      }
    }
    fetchForecasts();
  }, [forecastRefreshTrigger]);


  // ── Status change + stock update ─────────────────────────────────────────────
  async function handleStatusChange(orderId: string, newStatus: string) {
    // Update order status
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);

    // On accepted: increment current_stock in ingredients + demand_forecasts
    if (newStatus === "accepted") {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        for (const item of order.items) {
          const { data: inv } = await supabase
            .from("items")
            .select("quantity_remaining")
            .eq("product_name", item.itemName)
            .single();

          if (inv) {
            const newStock = Number(inv.quantity_remaining) + item.quantity;
            await supabase
              .from("items")
              .update({ quantity_remaining: newStock, qty_balance: newStock })
              .eq("product_name", item.itemName);
          }
        }
      }
      setForecastRefreshTrigger((n) => n + 1);
    }

    await fetchOrders();
    setSelectedOrderId(null);
  }

  // ── Filter logic ─────────────────────────────────────────────────────────────
  const filteredOrders = orders
    .filter((o) => activeTab === "All" || o.status === activeTab.toLowerCase())
    .filter((o) => {
      if (!vendorQuery.trim()) return true;
      const q = vendorQuery.toLowerCase();
      return o.items.some((i) => i.vendorName?.toLowerCase().includes(q));
    })
    .filter((o) => {
      if (!fromDate) return true;
      return new Date(o.createdAt) >= new Date(fromDate);
    });

  return (
    <div>
      <PageHeader
        title="Ordering"
        actionButton={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Create Order
          </Button>
        }
      />

      <RecommendedOrders refreshTrigger={forecastRefreshTrigger} />

      <div className="mx-6 my-6 border border-light-gray rounded-sm">
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold text-charcoal mb-4">Order History</h2>
          <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <OrderFilters
          vendorQuery={vendorQuery}
          onVendorChange={setVendorQuery}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          count={filteredOrders.length}
        />

        {loading ? (
          <div className="py-12 text-center text-sm text-warm-gray">Loading…</div>
        ) : (
          <OrdersTable
            orders={filteredOrders}
            onViewOrder={(id) => setSelectedOrderId(id)}
          />
        )}
      </div>

      <CreateOrderModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); fetchOrders(); }}
        forecasts={forecasts}
      />

      <OrderDetailModal
        open={selectedOrderId !== null}
        onClose={() => setSelectedOrderId(null)}
        order={selectedOrder}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
