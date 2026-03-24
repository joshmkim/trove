"use client";

import Button from "@/components/ui/Button";
import { vendors } from "@/lib/vendors";
import type { OrderLineItem } from "./CreateOrderModal";

interface AssignVendorsStepProps {
  items: OrderLineItem[];
  vendorAssignments: Record<string, string>;
  onVendorChange: (itemKey: string, vendorId: string) => void;
  deliveryDate: string;
  onDeliveryDateChange: (date: string) => void;
  onBack: () => void;
  onPlaceOrder: () => void;
}

export default function AssignVendorsStep({
  items,
  vendorAssignments,
  onVendorChange,
  deliveryDate,
  onDeliveryDateChange,
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
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{item.name}</p>
                <p className="text-xs text-warm-gray">
                  {item.quantity} {item.unit}
                </p>
              </div>
              <select
                value={vendorAssignments[item.key] ?? ""}
                onChange={(e) => onVendorChange(item.key, e.target.value)}
                className="w-40 px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal focus:outline-none focus:border-lavender bg-white"
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Delivery date */}
        <div>
          <label className="block text-xs font-semibold text-warm-gray uppercase tracking-wide mb-2">
            Delivery by
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => onDeliveryDateChange(e.target.value)}
            className="px-3 py-2 text-sm border border-light-gray rounded-lg text-charcoal focus:outline-none focus:border-lavender"
          />
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
