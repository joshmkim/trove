"use client";

import { useState } from "react";
import { InventoryItem } from "@/lib/mockData";
import { dispatchInventoryRefresh } from "@/lib/inventoryEvents";
import TrashIcon from "./TrashIcon";
import EditSaveIconButton from "./EditSaveIconButton";
import EditableNameField from "./EditableNameField";
import EditableQuantityField from "./EditableQuantityField";
import EditableSkuField from "./EditableSkuField";

interface InventoryCardProps {
  item: InventoryItem;
}

export default function InventoryCard({ item }: InventoryCardProps) {
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
    if ([qtyIn, qtyOut, qtyBalance].some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
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
    <div className="flex flex-col bg-white border border-light-gray rounded-sm overflow-hidden hover:shadow-sm transition-shadow">
      {/* SKU ID */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <EditableSkuField
          isEditing={isEditing}
          value={editedSkuId}
          onChange={setEditedSkuId}
          ariaLabel={`Edit SKU for ${item.productName}`}
        />
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            className="text-warm-gray hover:text-charcoal transition-colors"
            aria-label={`Delete ${item.productName}`}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Image placeholder */}
      <div className="mx-3 bg-cream rounded-sm aspect-square" />

      {/* Name + quantity */}
      <div className="px-3 pt-2 pb-3 flex flex-col gap-0.5">
        <EditableNameField
          isEditing={isEditing}
          value={editedName}
          onChange={setEditedName}
          ariaLabel={`Edit name for ${item.productName}`}
        />
        <div className="flex items-center gap-1">
          <EditableQuantityField
            isEditing={isEditing}
            value={editedQtyBalance}
            onChange={setEditedQtyBalance}
            ariaLabel={`Edit quantity balance for ${item.productName}`}
          />
          <span className="text-xs text-warm-gray">remaining</span>
        </div>
        {validationError && <span className="mt-1 text-xs text-red-600">{validationError}</span>}
      </div>
    </div>
  );
}
