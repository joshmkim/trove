"use client";

import { useState } from "react";
import { InventoryItem } from "@/lib/mockData";
import { dispatchInventoryRefresh } from "@/lib/inventoryEvents";
import StockLevelBadge from "./StockLevelBadge";
import TrashIcon from "./TrashIcon";
import EditSaveIconButton from "./EditSaveIconButton";
import EditableNameField from "./EditableNameField";
import EditableQuantityField from "./EditableQuantityField";
import EditableSkuField from "./EditableSkuField";

interface InventoryLineItemProps {
  item: InventoryItem;
}

export default function InventoryLineItem({ item }: InventoryLineItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editedName, setEditedName] = useState(item.productName);
  const [editedQtyIn, setEditedQtyIn] = useState(String(item.qtyIn));
  const [editedQtyOut, setEditedQtyOut] = useState(String(item.qtyOut));
  const [editedQtyBalance, setEditedQtyBalance] = useState(String(item.qtyBalance));
  const [editedSkuId, setEditedSkuId] = useState(item.skuId);

  const saveEdits = async () => {
    setValidationError(null);
    const skuPattern = /^SKU-\d+$/;
    if (!skuPattern.test(editedSkuId.trim())) {
      setValidationError("SKU must be formatted as SKU-<number>.");
      return;
    }

    const qtyIn = Number(editedQtyIn);
    const qtyOut = Number(editedQtyOut);
    const qtyBalance = Number(editedQtyBalance);

    if (
      [qtyIn, qtyOut, qtyBalance].some(
        (value) => Number.isNaN(value) || !Number.isFinite(value)
      )
    ) {
      setValidationError("Quantities must be numeric values.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: editedName.trim(),
          qtyIn,
          qtyOut,
          qtyBalance,
          skuId: editedSkuId.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setValidationError(payload?.error ?? "Failed to save item.");
        return;
      }

      setIsEditing(false);
      setValidationError(null);
      dispatchInventoryRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <tr
      className={`last:border-0 transition-colors ${
        isEditing
          ? "bg-[#FFFCED] border-t border-[rgba(142,140,135,0.35)]"
          : "border-b border-light-gray hover:bg-cream/40"
      }`}
    >
      <td className="py-[15px] px-5">
        <EditSaveIconButton
          isEditing={isEditing}
          isSaving={isSaving}
          ariaLabel={isEditing ? `Save ${item.productName}` : `Edit ${item.productName}`}
          onClick={() => {
            if (isEditing) {
              void saveEdits();
              return;
            }
            setValidationError(null);
            setIsEditing(true);
          }}
        />
      </td>

      <td className="py-[15px] px-5">
        <div className="flex items-center gap-5">
          <div className="h-[50px] w-[50px] shrink-0 rounded-[12px] border border-light-gray bg-cream" />
          <div className="flex flex-col">
            <EditableNameField
              isEditing={isEditing}
              value={editedName}
              onChange={setEditedName}
              ariaLabel={`Edit name for ${item.productName}`}
            />
            <span className="text-xs text-warm-gray">
              {item.quantityRemaining} remaining
            </span>
            {validationError && (
              <span className="mt-1 text-xs text-red-600">{validationError}</span>
            )}
          </div>
        </div>
      </td>

      <td className="py-[15px] px-5">
        <StockLevelBadge level={item.stockLevel} percent={item.stockPercent} />
      </td>

      <td className={`py-[15px] text-sm text-charcoal tabular-nums ${isEditing ? "px-2" : "px-5"}`}>
        <EditableQuantityField
          isEditing={isEditing}
          value={editedQtyIn}
          onChange={setEditedQtyIn}
          ariaLabel={`Edit quantity in for ${item.productName}`}
        />
      </td>

      <td className={`py-[15px] text-sm text-charcoal tabular-nums ${isEditing ? "px-2" : "px-5"}`}>
        <EditableQuantityField
          isEditing={isEditing}
          value={editedQtyOut}
          onChange={setEditedQtyOut}
          ariaLabel={`Edit quantity out for ${item.productName}`}
        />
      </td>

      <td className={`py-[15px] text-sm font-semibold text-charcoal tabular-nums ${isEditing ? "px-2" : "px-5"}`}>
        <EditableQuantityField
          isEditing={isEditing}
          value={editedQtyBalance}
          onChange={setEditedQtyBalance}
          ariaLabel={`Edit quantity balance for ${item.productName}`}
          emphasize
        />
      </td>

      <td className={`py-[15px] ${isEditing ? "px-2" : "px-5"}`}>
        <EditableSkuField
          isEditing={isEditing}
          value={editedSkuId}
          onChange={setEditedSkuId}
          ariaLabel={`Edit SKU for ${item.productName}`}
        />
      </td>

      <td className="py-[15px] px-5 text-right">
        <button
          type="button"
          className="text-warm-gray hover:text-charcoal transition-colors"
          aria-label={`Delete ${item.productName}`}
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}
