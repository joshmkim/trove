"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import FileUploadStatus from "./FileUploadStatus";
import InvoiceItemDetails from "./InvoiceItemDetails";

interface ParsedItem {
  productName: string;
  qtyIn: number;
  skuId: string;
}

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
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

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
    setParsedItems([]);
    setParseError(null);
    setUploadedFile({ file, status: "uploading" });

    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/parse-invoice", { method: "POST", body: formData })
      .then(async (res) => {
        if (!res.ok) throw new Error("Parse failed");
        const data = await res.json();
        setParsedItems(data.items ?? []);
        setUploadedFile({ file, status: "completed" });
      })
      .catch(() => {
        setParseError("Failed to parse invoice. Please enter items manually.");
        setUploadedFile({ file, status: "error" });
      });
  }, [file]);

  function handleClose() {
    setUploadedFile(null);
    setParsedItems([]);
    setParseError(null);
    onClose();
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
                status={uploadedFile.status === "uploading" ? "uploading" : "completed"}
                onRemove={handleClose}
              />
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <p className="mb-4 text-sm text-red-500">{parseError}</p>
          )}

          {/* Parsed item details */}
          <InvoiceItemDetails items={parsedItems} />
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t border-light-gray">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleClose}
            disabled={parsedItems.length === 0}
          >
            Add to Inventory
          </Button>
        </div>
      </div>
    </>
  );
}
