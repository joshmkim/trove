"use client";

import Button from "@/components/ui/Button";
import type { OrderLineItem } from "./CreateOrderModal";
import { cadenceLabel, type OrderCadence } from "@/lib/vendorPortal";

export interface VendorOption {
  id: string;
  name: string;
  leadTimeDays: number;
  contactMethod: "phone" | "email" | "website";
  contactValue: string;
  orderCadence: OrderCadence;
  cadenceDays: number | null;
  nextOrderDate: string | null;
}

interface AssignVendorsStepProps {
  items: OrderLineItem[];
  vendorOptionsByItem: Record<string, VendorOption[]>;
  vendorAssignments: Record<string, string>;
  onVendorChange: (itemKey: string, vendorId: string) => void;
  expectedDeliveryByItem: Record<string, string>;
  onBack: () => void;
  onPlaceOrder: () => void;
}

export default function AssignVendorsStep({
  items,
  vendorOptionsByItem,
  vendorAssignments,
  onVendorChange,
  expectedDeliveryByItem,
  onBack,
  onPlaceOrder,
}: AssignVendorsStepProps) {
  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6">
        <h2 className="text-[32px] font-bold text-charcoal leading-tight">Assign Vendors</h2>
        <p className="mt-1.5 mb-6 text-sm text-warm-gray">
          Choose which vendor to order from for each item
        </p>

        {/* Item rows */}
        <div className="flex flex-col gap-3 mb-8">
          {items.map((item) => {
            const options = vendorOptionsByItem[item.key] ?? [];
            const selected = options.find((o) => o.id === vendorAssignments[item.key]);
            return (
              <div key={item.key} className="rounded-lg border border-light-gray p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{item.name}</p>
                    <p className="text-xs text-warm-gray">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <select
                    value={vendorAssignments[item.key] ?? ""}
                    onChange={(e) => onVendorChange(item.key, e.target.value)}
                    className="w-48 px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal focus:outline-none focus:border-lavender bg-white"
                  >
                    <option value="">Select vendor</option>
                    {options.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selected && (
                  <p className="mt-2 text-xs text-warm-gray">
                    Cadence: {cadenceLabel(selected.orderCadence, selected.cadenceDays)} · Lead
                    time: {selected.leadTimeDays} days · Expected delivery:{" "}
                    {expectedDeliveryByItem[item.key] || "TBD"}
                  </p>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-sm text-warm-gray">Add at least one item to continue.</div>
          )}
          {items.length > 0 && items.some((i) => (vendorOptionsByItem[i.key] ?? []).length === 0) && (
            <div className="text-xs text-red-600">
              Some items have no onboarded vendor yet. Add vendor-product mappings in Vendor
              Portal.
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t border-light-gray">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onPlaceOrder}>Place Order</Button>
      </div>
    </>
  );
}
