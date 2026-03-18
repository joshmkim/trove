"use client";

import { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import InvoicePopup from "@/components/invoice/InvoicePopup";

export default function AppShell({ children }: { children: ReactNode }) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onUploadClick={() => setInvoiceOpen(true)} />
      <main className="flex-1 overflow-y-auto bg-white">
        {children}
      </main>
      <InvoicePopup open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />
    </div>
  );
}
