"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { PurchaseOrder } from "@/lib/types";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onStatusChange: (orderId: string, newStatus: string) => Promise<void>;
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   className: "bg-amber-100 text-amber-700" },
  accepted:  { label: "Accepted",  className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-600" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function shortId(id: string): string {
  return "ORD-" + id.slice(0, 8).toUpperCase();
}

export default function OrderDetailModal({
  open,
  onClose,
  order,
  onStatusChange,
}: OrderDetailModalProps) {
  const [saving, setSaving] = useState(false);

  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status];

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      await onStatusChange(order!.id, newStatus);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={shortId(order.id)}>
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-warm-gray">
          Delivery by: <span className="text-charcoal">{fmtDate(order.deliveryBy)}</span>
        </span>
        <span className="text-xs text-warm-gray">
          Created: <span className="text-charcoal">{fmtDate(order.createdAt)}</span>
        </span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border border-light-gray mb-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-light-gray bg-cream/50">
              {["Item", "Qty", "Unit", "Vendor", "SMS"].map((h) => (
                <th
                  key={h}
                  className="py-2 px-3 text-left text-[12px] font-medium text-warm-gray whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-warm-gray">
                  No items.
                </td>
              </tr>
            ) : (
              order.items.map((item) => (
                <tr key={item.id} className="border-b border-light-gray last:border-0">
                  <td className="py-2.5 px-3 font-medium text-charcoal">{item.itemName}</td>
                  <td className="py-2.5 px-3 text-charcoal">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-charcoal">{item.unit}</td>
                  <td className="py-2.5 px-3 text-charcoal">{item.vendorName ?? "—"}</td>
                  <td className="py-2.5 px-3">
                    {item.smsSent ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {item.smsSentAt ? fmtDate(item.smsSentAt) : "Sent"}
                      </span>
                    ) : (
                      <span className="text-xs text-warm-gray">Not sent</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {order.status === "pending" && (
          <>
            <Button
              variant="outline"
              onClick={() => handleStatusChange("cancelled")}
              disabled={saving}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              Cancel Order
            </Button>
            <Button
              variant="primary"
              onClick={() => handleStatusChange("accepted")}
              disabled={saving}
              className="text-xs"
            >
              {saving ? "Saving…" : "Mark as Accepted"}
            </Button>
          </>
        )}
        {order.status === "accepted" && (
          <Button
            variant="primary"
            onClick={() => handleStatusChange("completed")}
            disabled={saving}
            className="text-xs"
          >
            {saving ? "Saving…" : "Mark as Completed"}
          </Button>
        )}
        {(order.status === "completed" || order.status === "cancelled") && (
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
}
