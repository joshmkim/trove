"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PendingOrderRequests from "@/components/ordering/PendingOrderRequests";
import OrderFilters from "@/components/ordering/OrderFilters";
import OrdersTable from "@/components/ordering/OrdersTable";
import TabBar from "@/components/ui/TabBar";
import Button from "@/components/ui/Button";

const TABS = ["All", "Active", "Scheduled", "Completed", "Cancelled"];

export default function OrderingPage() {
  const [activeTab, setActiveTab] = useState("Scheduled");

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

      <OrdersTable />
    </div>
  );
}
