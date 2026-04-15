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

  function removeRow(id: number) {
    onChange(items.filter((row) => row.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-2xl font-bold text-charcoal mb-4">Item Details</h3>

      {/*
        Panel content width = 460px - px-8*2 = 396px
        Grid: [1fr  64px  88px  88px  28px] + gap-x-2 (8px × 4 = 32px)
        Fixed cols: 64 + 88 + 88 + 28 = 268px + 32px gaps = 300px
        1fr gets: 396 - 300 = 96px minimum — enough for the name column
      */}
      <div className="grid grid-cols-[minmax(0,1fr)_64px_88px_88px_28px] gap-x-2 gap-y-2 items-center">
        {/* Headers */}
        <span className="text-xs font-medium text-warm-gray px-1">Product Name</span>
        <span className="text-xs font-medium text-warm-gray px-1">Qty</span>
        <span className="text-xs font-medium text-warm-gray px-1">Unit Price</span>
        <span className="text-xs font-medium text-warm-gray px-1">Total</span>
        <span /> {/* delete column */}

        {/* Rows */}
        {items.map((row) => (
          <Fragment key={row.id}>
            <input
              type="text"
              value={row.productName}
              onChange={(e) => updateRow(row.id, "productName", e.target.value)}
              placeholder="Product name"
              className="w-full px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded outline-none focus:border-warm-gray transition-colors truncate"
            />
            <input
              type="text"
              inputMode="numeric"
              value={row.qtyIn}
              onChange={(e) => updateRow(row.id, "qtyIn", e.target.value)}
              className="w-full px-2 py-1.5 text-sm text-charcoal border border-light-gray rounded outline-none focus:border-warm-gray transition-colors tabular-nums text-center"
            />
            <input
              type="text"
              inputMode="decimal"
              value={row.unitPrice}
              onChange={(e) => updateRow(row.id, "unitPrice", e.target.value)}
              placeholder="0.00"
              className="w-full px-2 py-1.5 text-sm text-charcoal border border-light-gray rounded outline-none focus:border-warm-gray transition-colors tabular-nums"
            />
            <input
              type="text"
              inputMode="decimal"
              value={row.lineTotal}
              onChange={(e) => updateRow(row.id, "lineTotal", e.target.value)}
              placeholder="0.00"
              className="w-full px-2 py-1.5 text-sm text-charcoal border border-light-gray rounded outline-none focus:border-warm-gray transition-colors tabular-nums"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label="Remove row"
              className="flex items-center justify-center w-7 h-7 rounded text-warm-gray hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
