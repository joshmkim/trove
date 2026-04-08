"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import FileUploadStatus from "./FileUploadStatus";
import InvoiceItemDetails from "./InvoiceItemDetails";
import type { EditableInvoiceItem, ParsedInvoiceItem } from "@/lib/types";
import { dispatchInventoryRefresh } from "@/lib/inventoryEvents";

interface UploadedFile {
  file: File;
  status: "uploading" | "completed" | "error";
}

interface InvoicePopupProps {
  open: boolean;
  onClose: () => void;
  file?: File | null;
}

export default function InvoicePopup({ open, onClose, file }: InvoicePopupProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [draftItems, setDraftItems] = useState<EditableInvoiceItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function toEditableItems(items: ParsedInvoiceItem[]) {
    return items.map((item, index) => ({
      id: index + 1,
      productName: item.productName,
      qtyIn: String(item.qtyIn),
      skuId: item.skuId,
      unitPrice:
        item.unitPrice != null && Number.isFinite(item.unitPrice)
          ? String(item.unitPrice)
          : "",
      lineTotal:
        item.lineTotal != null && Number.isFinite(item.lineTotal)
          ? String(item.lineTotal)
          : "",
    }));
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // When a new file is passed in, parse it
  useEffect(() => {
    if (!file) return;
    setDraftItems([]);
    setParseError(null);
    setSaveError(null);
    setUploadedFile({ file, status: "uploading" });

    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/parse-invoice", { method: "POST", body: formData })
      .then(async (res) => {
        if (!res.ok) throw new Error("Parse failed");
        const data = await res.json();
        setDraftItems(toEditableItems(data.items ?? []));
        setUploadedFile({ file, status: "completed" });
      })
      .catch(() => {
        setParseError("Failed to parse invoice. Please enter items manually.");
        setUploadedFile({ file, status: "error" });
      });
  }, [file]);

  function handleClose() {
    setUploadedFile(null);
    setDraftItems([]);
    setParseError(null);
    setSaveError(null);
    setIsSaving(false);
    onClose();
  }

  async function handleAddToInventory() {
    setSaveError(null);

    const items = draftItems
      .map((item) => ({
        productName: item.productName.trim(),
        qtyIn: Number(item.qtyIn),
        skuId: item.skuId.trim(),
        unitPrice: item.unitPrice.trim() ? Number(item.unitPrice) : null,
        lineTotal: item.lineTotal.trim() ? Number(item.lineTotal) : null,
      }))
      .filter(
        (item) =>
          item.productName.length > 0 &&
          Number.isFinite(item.qtyIn) &&
          item.qtyIn > 0 &&
          (item.unitPrice == null || Number.isFinite(item.unitPrice)) &&
          (item.lineTotal == null || Number.isFinite(item.lineTotal))
      );

    if (items.length === 0) {
      setSaveError("Please verify the item rows before adding them to inventory.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/inventory/apply-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          invoice: {
            filename: uploadedFile?.file.name ?? file?.name ?? "invoice.pdf",
            fileSize: uploadedFile?.file.size ?? file?.size ?? null,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add invoice items to inventory.");
      }

      dispatchInventoryRefresh();
      handleClose();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to add invoice items to inventory."
      );
      setIsSaving(false);
    }
  }

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Right-side panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-screen w-[460px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-warm-gray hover:text-charcoal transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6">
          <h2 className="text-[32px] font-bold text-charcoal leading-tight">
            Invoice Upload
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-warm-gray">
            Upload a PDF invoice to automatically extract items into your inventory.
          </p>

          {/* File status */}
          {uploadedFile && (
            <div className="flex flex-col gap-2 mb-6">
              <FileUploadStatus
                filename={uploadedFile.file.name}
                size={formatSize(uploadedFile.file.size)}
                status={uploadedFile.status}
                onRemove={handleClose}
              />
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <p className="mb-4 text-sm text-red-500">{parseError}</p>
          )}

          {saveError && (
            <p className="mb-4 text-sm text-red-500">{saveError}</p>
          )}

          {/* Parsed item details */}
          <InvoiceItemDetails items={draftItems} onChange={setDraftItems} />
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t border-light-gray">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddToInventory}
            disabled={draftItems.length === 0 || isSaving}
          >
            {isSaving ? "Adding..." : "Add to Inventory"}
          </Button>
        </div>
      </div>
    </>
  );
}
