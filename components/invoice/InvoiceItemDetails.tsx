"use client";

import { useState } from "react";

interface ItemRow {
  id: number;
  productName: string;
  qtyIn: string;
  skuId: string;
}

const defaultRows: ItemRow[] = [
  { id: 1, productName: "Item Name", qtyIn: "999", skuId: "SKU-ID-1245" },
  { id: 2, productName: "Item Name", qtyIn: "999", skuId: "SKU-ID-1245" },
  { id: 3, productName: "Item Name", qtyIn: "999", skuId: "SKU-ID-1245" },
  { id: 4, productName: "Item Name", qtyIn: "999", skuId: "SKU-ID-1245" },
];

export default function InvoiceItemDetails() {
  const [rows, setRows] = useState<ItemRow[]>(defaultRows);

  function updateRow(id: number, field: keyof Omit<ItemRow, "id">, value: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  return (
    <div>
      <h3 className="text-2xl font-bold text-charcoal mb-4">Item Details</h3>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_120px] gap-x-3 mb-1.5 px-0.5">
        <span className="text-xs text-warm-gray font-medium">Product Name</span>
        <span className="text-xs text-warm-gray font-medium">Qty In</span>
        <span className="text-xs text-warm-gray font-medium">SKU ID</span>
      </div>

      {/* Editable rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_80px_120px] gap-x-3">
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
          </div>
        ))}
      </div>
    </div>
  );
}
