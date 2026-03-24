"use client";

import { useEffect, useState } from "react";
import type { DemandForecast } from "@/lib/types";
import { vendors } from "@/lib/vendors";
import SelectItemsStep from "./SelectItemsStep";
import AssignVendorsStep from "./AssignVendorsStep";
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

export default function CreateOrderModal({ open, onClose, forecasts }: CreateOrderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedForecastIds, setSelectedForecastIds] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [vendorAssignments, setVendorAssignments] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setStep(1);
    setSelectedForecastIds(new Set());
    setCustomItems([]);
    setVendorAssignments({});
    setDeliveryDate("");
    setPlacing(false);
    setPlaceError(null);
    onClose();
  }

  async function handlePlaceOrder() {
    setPlacing(true);
    setPlaceError(null);
    try {
      const payload = {
        deliveryBy: deliveryDate,
        items: orderItems.map((item) => {
          const vendorId = vendorAssignments[item.key] ?? "";
          const vendor = vendors.find((v) => v.id === vendorId);
          return {
            itemName: item.name,
            quantity: Number(item.quantity) || 1,
            unit: item.unit,
            vendorId,
            vendorName: vendor?.name ?? "",
            vendorPhone: vendor?.phone ?? "",
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

  function toggleForecast(id: string) {
    setSelectedForecastIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Derive combined list for Step 2
  const orderItems: OrderLineItem[] = [
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
  ];

  const uniqueVendorCount = new Set(
    Object.values(vendorAssignments).filter(Boolean)
  ).size;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Right-side panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-screen w-[500px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close button */}
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
              vendorAssignments={vendorAssignments}
              onVendorChange={(key, vendorId) =>
                setVendorAssignments((prev) => ({ ...prev, [key]: vendorId }))
              }
              deliveryDate={deliveryDate}
              onDeliveryDateChange={setDeliveryDate}
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
