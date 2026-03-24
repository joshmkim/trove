"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { forecastStatus, type DemandForecast } from "@/lib/types";
import type { CustomItem } from "./CreateOrderModal";

const UNITS = ["kg", "lbs", "cartons", "pcs", "liters"];

const STATUS_CONFIG = {
  critical: { label: "Will run out", className: "bg-red-100 text-red-700" },
  tight:    { label: "Tight",        className: "bg-amber-100 text-amber-700" },
  ok:       { label: "Covered",      className: "bg-green-100 text-green-700" },
};

interface SelectItemsStepProps {
  forecasts: DemandForecast[];
  selectedForecastIds: Set<string>;
  onToggleForecast: (id: string) => void;
  customItems: CustomItem[];
  onCustomItemsChange: (items: CustomItem[]) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function SelectItemsStep({
  forecasts,
  selectedForecastIds,
  onToggleForecast,
  customItems,
  onCustomItemsChange,
  onNext,
  onCancel,
}: SelectItemsStepProps) {
  const [nextId, setNextId] = useState(1);

  function addCustomItem() {
    onCustomItemsChange([...customItems, { id: nextId, name: "", quantity: "", unit: "kg" }]);
    setNextId((n) => n + 1);
  }

  function updateCustomItem(id: number, field: keyof Omit<CustomItem, "id">, value: string) {
    onCustomItemsChange(
      customItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeCustomItem(id: number) {
    onCustomItemsChange(customItems.filter((item) => item.id !== id));
  }

  const hasSelections =
    selectedForecastIds.size > 0 || customItems.some((i) => i.name.trim().length > 0);

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6">
        <h2 className="text-[32px] font-bold text-charcoal leading-tight">Create Order</h2>
        <p className="mt-1.5 mb-6 text-sm text-warm-gray">
          Select items to order or add custom items
        </p>

        {/* Recommended section */}
        {forecasts.length > 0 ? (
          <div className="mb-6">
            <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">
              Recommended
            </p>
            <div className="flex flex-col gap-0.5">
              {forecasts.map((f) => {
                const status = forecastStatus(f);
                const cfg = STATUS_CONFIG[status];
                const checked = selectedForecastIds.has(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-cream cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleForecast(f.id)}
                      className="w-4 h-4 rounded accent-navy shrink-0"
                    />
                    <span className="flex-1 text-sm text-charcoal">{f.ingredientName}</span>
                    <span className="text-sm text-warm-gray whitespace-nowrap">
                      {f.recommendedOrder > 0
                        ? `${f.recommendedOrder.toLocaleString()} ${f.unit}s`
                        : "—"}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 py-6 text-center text-sm text-warm-gray border border-dashed border-light-gray rounded-lg">
            No forecast data — train the model first or add custom items below.
          </div>
        )}

        {/* Custom items section */}
        <div>
          <p className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-3">
            Custom Items
          </p>
          {customItems.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {customItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateCustomItem(item.id, "name", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal placeholder:text-warm-gray focus:outline-none focus:border-lavender"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    min="0"
                    onChange={(e) => updateCustomItem(item.id, "quantity", e.target.value)}
                    className="w-20 px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal placeholder:text-warm-gray focus:outline-none focus:border-lavender"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateCustomItem(item.id, "unit", e.target.value)}
                    className="px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal focus:outline-none focus:border-lavender bg-white"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCustomItem(item.id)}
                    aria-label="Remove item"
                    className="p-1.5 text-warm-gray hover:text-charcoal transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addCustomItem}
            className="flex items-center gap-1.5 text-sm text-navy font-medium hover:opacity-75 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t border-light-gray">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onNext} disabled={!hasSelections}>Next</Button>
      </div>
    </>
  );
}
