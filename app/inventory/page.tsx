"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import AllItemsHeader from "@/components/inventory/AllItemsHeader";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryGrid from "@/components/inventory/InventoryGrid";
import Button from "@/components/ui/Button";
import { mockInventory } from "@/lib/mockData";

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredItems = useMemo(() => {
    return mockInventory.filter((item) => {
      const matchesSearch = item.productName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "low" && item.stockLevel === "Low") ||
        (filter === "high" && item.stockLevel === "High");

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filter]);

  return (
    <div>
      <PageHeader
        title="Inventory Management"
        actionButton={
          <Button variant="primary">+ Add Item</Button>
        }
      />

      <AllItemsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={viewMode}
        onViewToggle={setViewMode}
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="px-6 py-4">
        {viewMode === "list" ? (
          <InventoryTable items={filteredItems} />
        ) : (
          <InventoryGrid items={filteredItems} />
        )}
      </div>
    </div>
  );
}
