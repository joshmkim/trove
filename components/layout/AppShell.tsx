"use client";

import { ReactNode, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import InvoicePopup from "@/components/invoice/InvoicePopup";

export default function AppShell({ children }: { children: ReactNode }) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setInvoiceOpen(true);
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  function handleClose() {
    setInvoiceOpen(false);
    setSelectedFile(null);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <Sidebar onUploadClick={handleUploadClick} />
      <main className="flex-1 overflow-y-auto bg-white">
        {children}
      </main>
      <InvoicePopup
        open={invoiceOpen}
        onClose={handleClose}
        file={selectedFile}
      />
    </div>
  );
}
