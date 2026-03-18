"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PendingOrderRequests from "@/components/ordering/PendingOrderRequests";
import OrderFilters from "@/components/ordering/OrderFilters";
import OrdersTable from "@/components/ordering/OrdersTable";
import TabBar from "@/components/ui/TabBar";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { orderRowToOrder, type Order, type OrderRow } from "@/lib/types";

const TABS = ["All", "Active", "Scheduled", "Completed", "Cancelled"];

const mockOrders: Order[] = [
  {
    id: "mock-1",
    customer: "Alex Smith",
    orderSource: "Direct",
    type: "Standard",
    items: "Cu",
    channel: "Online",
    location: "Jakarta Selatan",
    orderDate: "Jan 2, 2025",
    status: "scheduled",
  },
  {
    id: "mock-2",
    customer: "ORDER#01",
    orderSource: "Marketplace",
    type: "Bulk",
    items: "Cu",
    channel: "In-store",
    location: "Jakarta Pusat",
    orderDate: "Jan 1, 2025",
    status: "active",
  },
];

export default function OrderingPage() {
  const [activeTab, setActiveTab] = useState("Scheduled");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filteredOrders =
    activeTab === "All"
      ? orders
      : orders.filter((o) => o.status === activeTab.toLowerCase());

  return (
    <div>
      <PageHeader
        title="Ordering"
        actionButton={<Button variant="primary">Create Order</Button>}
      />

      <PendingOrderRequests />

      <div className="px-6 pt-4">
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <OrderFilters />

      {loading ? (
        <div className="py-12 text-center text-sm text-warm-gray">Loading…</div>
      ) : (
        <OrdersTable orders={filteredOrders} />
      )}
    </div>
  );
}
