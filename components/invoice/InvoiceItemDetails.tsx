"use client";

import { useState, useEffect, Fragment } from "react";

interface ItemRow {
  id: number;
  productName: string;
  qtyIn: string;
  skuId: string;
}

interface ParsedItem {
  productName: string;
  qtyIn: number;
  skuId: string;
}

interface InvoiceItemDetailsProps {
  items?: ParsedItem[];
  onChange?: (rows: ItemRow[]) => void;
}

export default function InvoiceItemDetails({ items, onChange }: InvoiceItemDetailsProps) {
  const [rows, setRows] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (items && items.length > 0) {
      const mapped = items.map((item, i) => ({
        id: i + 1,
        productName: item.productName,
        qtyIn: String(item.qtyIn),
        skuId: item.skuId,
      }));
      setRows(mapped);
      onChange?.(mapped);
    }
  }, [items]);

  function updateRow(id: number, field: keyof Omit<ItemRow, "id">, value: string) {
    setRows((prev) => {
      const updated = prev.map((row) => (row.id === id ? { ...row, [field]: value } : row));
      onChange?.(updated);
      return updated;
    });
  }

  if (rows.length === 0) return null;

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
        {rows.map((row) => (
          <Fragment key={row.id}>
            <input
              type="text"
              value={row.productName}
              onChange={(e) => updateRow(row.id, "productName", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors"
            />
            <input
              type="text"
              value={row.qtyIn}
              onChange={(e) => updateRow(row.id, "qtyIn", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors tabular-nums"
            />
            <input
              type="text"
              value={row.skuId}
              onChange={(e) => updateRow(row.id, "skuId", e.target.value)}
              className="px-2.5 py-1.5 text-sm text-charcoal font-mono border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors"
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
