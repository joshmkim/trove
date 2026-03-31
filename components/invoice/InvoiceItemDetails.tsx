"use client";

import { Fragment } from "react";
import type { EditableInvoiceItem } from "@/lib/types";

interface InvoiceItemDetailsProps {
  items: EditableInvoiceItem[];
  onChange: (rows: EditableInvoiceItem[]) => void;
}

export default function InvoiceItemDetails({ items, onChange }: InvoiceItemDetailsProps) {
  function updateRow(id: number, field: keyof Omit<EditableInvoiceItem, "id">, value: string) {
    const updated = items.map((row) => (row.id === id ? { ...row, [field]: value } : row));
    onChange(updated);
  }

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-2xl font-bold text-charcoal mb-4">Item Details</h3>

      {/* Unified grid — headers + rows share the same columns */}
      <div className="grid grid-cols-[1fr_80px_120px] gap-x-3 gap-y-2">
        {/* Column headers */}
        <span className="text-xs text-warm-gray font-medium px-2.5">Product Name</span>
        <span className="text-xs text-warm-gray font-medium px-2.5">Qty In</span>
        <span className="text-xs text-warm-gray font-medium px-2.5">SKU ID</span>

        {/* Editable rows */}
        {items.map((row) => (
          <Fragment key={row.id}>
            <input
              type="text"
              value={row.productName}
              onChange={(e) => updateRow(row.id, "productName", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors"
            />
            <input
              type="text"
              inputMode="numeric"
              value={row.qtyIn}
              onChange={(e) => updateRow(row.id, "qtyIn", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors tabular-nums"
            />
            <input
              type="text"
              value={row.skuId}
              onChange={(e) => updateRow(row.id, "skuId", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors"
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
