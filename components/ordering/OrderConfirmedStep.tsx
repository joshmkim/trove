"use client";

import Button from "@/components/ui/Button";

interface OrderConfirmedStepProps {
  itemCount: number;
  vendorCount: number;
  onDone: () => void;
}

export default function OrderConfirmedStep({ itemCount, vendorCount, onDone }: OrderConfirmedStepProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      {/* Checkmark */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-[28px] font-bold text-charcoal mb-2">Order placed successfully</h2>
      <p className="text-sm text-warm-gray mb-1">
        {itemCount} {itemCount === 1 ? "item" : "items"} ordered from{" "}
        {vendorCount} {vendorCount === 1 ? "vendor" : "vendors"}
      </p>
      <p className="text-sm text-warm-gray mb-8">
        A message has been sent to your vendors
      </p>

      <Button variant="primary" onClick={onDone}>
        View in Order History
      </Button>
    </div>
  );
}
