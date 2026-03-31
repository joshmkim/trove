"use client";

import { useState, useMemo, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import AllItemsHeader from "@/components/inventory/AllItemsHeader";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryGrid from "@/components/inventory/InventoryGrid";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { itemRowToInventoryItem, type InventoryItem, type ItemRow } from "@/lib/types";
import { INVENTORY_REFRESH_EVENT } from "@/lib/inventoryEvents";
import { mockInventory } from "@/lib/mockData";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let isActive = true;

    async function fetchItems() {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: true });

      if (!isActive) return;

      if (error || !data || data.length === 0) {
        setItems(mockInventory);
      } else {
        setItems((data as ItemRow[]).map(itemRowToInventoryItem));
      }
      setLoading(false);
    }

    void fetchItems();

    const handleInventoryRefresh = () => {
      void fetchItems();
    };

    window.addEventListener(INVENTORY_REFRESH_EVENT, handleInventoryRefresh);

    const channel = supabase
      .channel("inventory-items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
        },
        () => {
          void fetchItems();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      window.removeEventListener(INVENTORY_REFRESH_EVENT, handleInventoryRefresh);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.productName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && item.stockLevel === "Low") ||
        (filter === "high" && item.stockLevel === "High");
      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, filter]);

  return (
    <div
      style={{
        ["--color-charcoal" as any]: "#2C2B2A",
        ["--color-warm-gray" as any]: "#958F84",
      }}
    >
      <PageHeader
        title="Inventory Management"
        actionButton={<Button variant="primary">+ Add Item</Button>}
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
        {loading ? (
          <div className="py-12 text-center text-sm text-warm-gray">Loading…</div>
        ) : viewMode === "list" ? (
          <InventoryTable items={filteredItems} />
        ) : (
          <InventoryGrid items={filteredItems} />
        )}
      </div>
    </div>
  );
}
