"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemandForecast } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { cadenceLabel, normalizeProductName } from "@/lib/vendorPortal";
import SelectItemsStep from "./SelectItemsStep";
import AssignVendorsStep, { type VendorOption } from "./AssignVendorsStep";
import OrderConfirmedStep from "./OrderConfirmedStep";

export interface CustomItem {
  id: number;
  name: string;
  quantity: string;
  unit: string;
}

export interface OrderLineItem {
  key: string;
  name: string;
  quantity: string;
  unit: string;
}

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  forecasts: DemandForecast[];
}

interface VendorCatalogEntry extends VendorOption {
  productName: string;
  productNorm: string;
  isPrimary: boolean;
}

type VendorRow = {
  id: string;
  name: string;
  lead_time_days: number;
  contact_method: "phone" | "email" | "website";
  contact_value: string;
  vendor_status: "my_vendor" | "not_onboarded";
};

type VendorProductRow = {
  vendor_id: string;
  item_id: string;
  is_primary: boolean;
  order_cadence: "daily" | "weekly" | "biweekly" | "custom_days";
  cadence_days: number | null;
  next_order_date: string | null;
};

type ItemRow = {
  id: string;
  product_name: string;
};

export default function CreateOrderModal({ open, onClose, forecasts }: CreateOrderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedForecastIds, setSelectedForecastIds] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<Record<string, string>>({});
  const [vendorCatalog, setVendorCatalog] = useState<VendorCatalogEntry[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    async function loadVendorCatalog() {
      const [{ data: vendorsData, error: vendorsError }, { data: vpData, error: vpError }] =
        await Promise.all([
          supabase
            .from("vendors")
            .select("id, name, lead_time_days, contact_method, contact_value, vendor_status")
            .eq("vendor_status", "my_vendor"),
          supabase
            .from("vendor_products")
            .select("vendor_id, item_id, is_primary, order_cadence, cadence_days, next_order_date"),
        ]);

      if (vendorsError || !vendorsData || vpError || !vpData) {
        setPlaceError(vendorsError?.message ?? vpError?.message ?? "Failed to load vendor catalog");
        setVendorCatalog([]);
        return;
      }

      const vendorRows = vendorsData as VendorRow[];
      const productRows = vpData as VendorProductRow[];
      const itemIds = Array.from(new Set(productRows.map((r) => r.item_id)));
      const { data: itemData, error: itemsError } = await supabase
        .from("items")
        .select("id, product_name")
        .in("id", itemIds);

      if (itemsError || !itemData) {
        setPlaceError(itemsError?.message ?? "Failed to load items for vendors");
        setVendorCatalog([]);
        return;
      }

      const itemsById = new Map((itemData as ItemRow[]).map((i) => [i.id, i.product_name]));
      const vendorsById = new Map(vendorRows.map((v) => [v.id, v]));

      const catalog: VendorCatalogEntry[] = productRows
        .map((row) => {
          const vendor = vendorsById.get(row.vendor_id);
          const productName = itemsById.get(row.item_id);
          if (!vendor || !productName) return null;
          return {
            id: vendor.id,
            name: vendor.name,
            leadTimeDays: vendor.lead_time_days,
            contactMethod: vendor.contact_method,
            contactValue: vendor.contact_value,
            orderCadence: row.order_cadence,
            cadenceDays: row.cadence_days,
            nextOrderDate: row.next_order_date,
            productName,
            productNorm: normalizeProductName(productName),
            isPrimary: row.is_primary,
          };
        })
        .filter((row): row is VendorCatalogEntry => row !== null);

      setVendorCatalog(catalog);
      setPlaceError(null);
    }
    void loadVendorCatalog();
  }, [open]);

  function handleClose() {
    setStep(1);
    setSelectedForecastIds(new Set());
    setCustomItems([]);
    setVendorAssignments({});
    setPlacing(false);
    setPlaceError(null);
    onClose();
  }

  function toggleForecast(id: string) {
    setSelectedForecastIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const orderItems: OrderLineItem[] = useMemo(
    () => [
      ...forecasts
        .filter((f) => selectedForecastIds.has(f.id))
        .map((f) => ({
          key: `forecast-${f.id}`,
          name: f.ingredientName,
          quantity: String(f.recommendedOrder > 0 ? f.recommendedOrder : 1),
          unit: f.unit,
        })),
      ...customItems
        .filter((c) => c.name.trim().length > 0)
        .map((c) => ({
          key: `custom-${c.id}`,
          name: c.name,
          quantity: c.quantity || "1",
          unit: c.unit,
        })),
    ],
    [forecasts, selectedForecastIds, customItems],
  );

  const vendorOptionsByItem = useMemo(() => {
    const map: Record<string, VendorOption[]> = {};
    orderItems.forEach((item) => {
      const itemNorm = normalizeProductName(item.name);
      const matches = vendorCatalog
        .filter((entry) => {
          if (entry.productNorm === itemNorm) return true;
          return entry.productNorm.includes(itemNorm) || itemNorm.includes(entry.productNorm);
        })
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return a.leadTimeDays - b.leadTimeDays;
        })
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          leadTimeDays: entry.leadTimeDays,
          contactMethod: entry.contactMethod,
          contactValue: entry.contactValue,
          orderCadence: entry.orderCadence,
          cadenceDays: entry.cadenceDays,
          nextOrderDate: entry.nextOrderDate,
        }));
      map[item.key] = matches;
    });
    return map;
  }, [orderItems, vendorCatalog]);

  useEffect(() => {
    if (step !== 2) return;
    setVendorAssignments((prev) => {
      const next: Record<string, string> = {};
      orderItems.forEach((item) => {
        const options = vendorOptionsByItem[item.key] ?? [];
        const current = prev[item.key];
        if (current && options.some((o) => o.id === current)) {
          next[item.key] = current;
        } else if (options.length > 0) {
          next[item.key] = options[0].id;
        }
      });
      return next;
    });
  }, [step, orderItems, vendorOptionsByItem]);

  const expectedDeliveryByItem = useMemo(() => {
    const byItem: Record<string, string> = {};
    orderItems.forEach((item) => {
      const selected = (vendorOptionsByItem[item.key] ?? []).find(
        (v) => v.id === vendorAssignments[item.key],
      );
      if (!selected) return;
      const d = new Date();
      d.setDate(d.getDate() + Math.max(0, selected.leadTimeDays));
      byItem[item.key] = d.toISOString().slice(0, 10);
    });
    return byItem;
  }, [orderItems, vendorOptionsByItem, vendorAssignments]);

  async function handlePlaceOrder() {
    setPlacing(true);
    setPlaceError(null);
    try {
      const missingVendor = orderItems.some((item) => !vendorAssignments[item.key]);
      if (missingVendor) {
        throw new Error("Assign a vendor for each item before placing the order.");
      }

      const deliveryDates = orderItems
        .map((item) => expectedDeliveryByItem[item.key])
        .filter(Boolean)
        .sort();

      const payload = {
        deliveryBy: deliveryDates[deliveryDates.length - 1] ?? "",
        items: orderItems.map((item) => {
          const vendorId = vendorAssignments[item.key] ?? "";
          const selected = (vendorOptionsByItem[item.key] ?? []).find(
            (v) => v.id === vendorId,
          );
          return {
            itemName: item.name,
            quantity: Number(item.quantity) || 1,
            unit: item.unit,
            vendorId,
            expectedDeliveryDate: expectedDeliveryByItem[item.key] ?? null,
            cadenceSnapshot: selected
              ? cadenceLabel(selected.orderCadence, selected.cadenceDays)
              : null,
          };
        }),
      };

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to place order");

      setStep(3);
    } catch (e) {
      setPlaceError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPlacing(false);
    }
  }

  const uniqueVendorCount = new Set(Object.values(vendorAssignments).filter(Boolean)).size;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed right-0 top-0 z-50 h-screen w-[500px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-warm-gray hover:text-charcoal transition-colors z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === 1 && (
          <SelectItemsStep
            forecasts={forecasts}
            selectedForecastIds={selectedForecastIds}
            onToggleForecast={toggleForecast}
            customItems={customItems}
            onCustomItemsChange={setCustomItems}
            onNext={() => setStep(2)}
            onCancel={handleClose}
          />
        )}

        {step === 2 && (
          <>
            {placeError && (
              <div className="px-8 pt-6 pb-0">
                <p className="text-sm text-red-500">{placeError}</p>
              </div>
            )}
            <AssignVendorsStep
              items={orderItems}
              vendorOptionsByItem={vendorOptionsByItem}
              vendorAssignments={vendorAssignments}
              onVendorChange={(key, vendorId) =>
                setVendorAssignments((prev) => ({ ...prev, [key]: vendorId }))
              }
              expectedDeliveryByItem={expectedDeliveryByItem}
              onBack={() => setStep(1)}
              onPlaceOrder={placing ? () => {} : handlePlaceOrder}
            />
          </>
        )}

        {step === 3 && (
          <OrderConfirmedStep
            itemCount={orderItems.length}
            vendorCount={uniqueVendorCount}
            onDone={handleClose}
          />
        )}
      </div>
    </>
  );
}
