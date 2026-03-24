"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import OrderFilters from "@/components/ordering/OrderFilters";
import OrdersTable from "@/components/ordering/OrdersTable";
import TabBar from "@/components/ui/TabBar";
import Button from "@/components/ui/Button";
import RecommendedOrders from "@/components/ordering/RecommendedOrders";
import CreateOrderModal from "@/components/ordering/CreateOrderModal";
import { supabase } from "@/lib/supabase";
import {
  orderRowToOrder,
  forecastRowToForecast,
  type Order,
  type OrderRow,
  type DemandForecast,
  type DemandForecastRow,
} from "@/lib/types";

const TABS = ["All", "Pending", "Accepted", "Completed", "Cancelled"];

const mockOrders: Order[] = [
  {
    id: "mock-1",
    customer: "Alex Smith",
    orderSource: "Direct",
    type: "Standard",
    items: "—",
    channel: "Online",
    location: "Jakarta Selatan",
    orderDate: "Jan 2, 2025",
    deliveryBy: null,
    totalVendors: 1,
    status: "pending",
  },
  {
    id: "mock-2",
    customer: "ORDER#01",
    orderSource: "Marketplace",
    type: "Bulk",
    items: "—",
    channel: "In-store",
    location: "Jakarta Pusat",
    orderDate: "Jan 1, 2025",
    deliveryBy: null,
    totalVendors: 2,
    status: "accepted",
  },
];

export default function OrderingPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("order_date", { ascending: false });

      if (error || !data || data.length === 0) {
        setOrders(mockOrders);
      } else {
        setOrders((data as OrderRow[]).map(orderRowToOrder));
      }
      setLoading(false);
    }
    fetchOrders();
  }, []);

  useEffect(() => {
    async function fetchForecasts() {
      const { data, error } = await supabase
        .from("demand_forecasts")
        .select("*")
        .order("recommended_order", { ascending: false });

      if (!error && data && data.length > 0) {
        setForecasts((data as DemandForecastRow[]).map(forecastRowToForecast));
      }
    }
    fetchForecasts();
  }, []);

  const filteredOrders =
    activeTab === "All"
      ? orders
      : orders.filter((o) => o.status === activeTab.toLowerCase());

  return (
    <div>
      <PageHeader
        title="Ordering"
        actionButton={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Create Order
          </Button>
        }
      />

      <RecommendedOrders />

      <hr className="border-light-gray mx-6" />

      <div className="px-6 pt-6">
        <h2 className="text-[20px] font-semibold text-charcoal mb-4">Order History</h2>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <OrderFilters />

      {loading ? (
        <div className="py-12 text-center text-sm text-warm-gray">Loading…</div>
      ) : (
        <OrdersTable orders={filteredOrders} />
      )}

      <CreateOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        forecasts={forecasts}
      />
    </div>
  );
}
