"use client";

import { useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FileUploadStatus from "./FileUploadStatus";
import InvoiceItemDetails from "./InvoiceItemDetails";

interface InvoicePopupProps {
  open: boolean;
  onClose: () => void;
}

export default function InvoicePopup({ open, onClose }: InvoicePopupProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
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
          onClick={onClose}
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
          {/* Title */}
          <h2 className="text-[32px] font-bold text-charcoal leading-tight">
            Invoice Upload
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-warm-gray">
            Insert description to guide user: upload and preview changes
          </p>

          {/* File upload entries */}
          <div className="flex flex-col gap-2 mb-6">
            <FileUploadStatus
              filename="Invoice_691.pdf"
              size="20 MB / 20 MB"
              status="completed"
            />
            <FileUploadStatus
              filename="Invoice_237.pdf"
              size="20 MB / 20 MB"
              status="uploading"
              progress={75}
            />
          </div>

          {/* Item Details */}
          <InvoiceItemDetails />
        </div>

        {/* Sticky footer actions */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t border-light-gray">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onClose}>
            Add to Inventory
          </Button>
        </div>
      </div>
    </>
  );
}
