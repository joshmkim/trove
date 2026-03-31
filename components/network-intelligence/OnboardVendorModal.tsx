"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export interface NewVendorDraft {
  name: string;
  contactMethod: "phone" | "email" | "website";
  contactValue: string;
  products: Array<{
    productName: string;
    pricePerUnit: number;
    unit: "kg" | "g" | "L" | "count" | "box";
  }>;
  reliabilityScore: number;
  leadTimeDays: number;
  responseTimeHours: number;
  advanceOrderDays: number;
}

interface OnboardVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateVendor: (vendor: NewVendorDraft) => void;
}

export default function OnboardVendorModal({
  isOpen,
  onClose,
  onCreateVendor,
}: OnboardVendorModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [products, setProducts] = useState("");
  const [leadTime, setLeadTime] = useState("3");
  const [reliability, setReliability] = useState("90");
  const [responseHours, setResponseHours] = useState("6");
  const [advanceDays, setAdvanceDays] = useState("3");
  const [pricePerUnit, setPricePerUnit] = useState("1.00");
  const [unit, setUnit] = useState<"kg" | "g" | "L" | "count" | "box">("kg");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError(null);

    if (!name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (!email.trim() && !phone.trim() && !website.trim()) {
      setError("Provide at least one contact method (phone, email, or website).");
      return;
    }

    const parsedLead = Number(leadTime);
    const parsedReliability = Number(reliability);
    const parsedResponse = Number(responseHours);
    const parsedAdvance = Number(advanceDays);
    const parsedPricePerUnit = Number(pricePerUnit);

    if (
      [parsedLead, parsedReliability, parsedResponse, parsedAdvance, parsedPricePerUnit].some(
        (v) => Number.isNaN(v)
      )
    ) {
      setError("Numeric fields must be valid numbers.");
      return;
    }

    const productNames = products
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (productNames.length === 0) {
      setError("Add at least one product this vendor supplies.");
      return;
    }

    const contactMethod = email.trim()
      ? "email"
      : phone.trim()
        ? "phone"
        : "website";
    const contactValue = email.trim() || phone.trim() || website.trim();

    const newVendor: NewVendorDraft = {
      name: name.trim(),
      contactMethod,
      contactValue,
      products: productNames.map((productName) => ({
        productName,
        pricePerUnit: parsedPricePerUnit,
        unit,
      })),
      reliabilityScore: parsedReliability,
      leadTimeDays: parsedLead,
      responseTimeHours: parsedResponse,
      advanceOrderDays: parsedAdvance,
    };

    onCreateVendor(newVendor);
    onClose();

    setName("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setProducts("");
    setLeadTime("3");
    setReliability("90");
    setResponseHours("6");
    setAdvanceDays("3");
    setPricePerUnit("1.00");
    setUnit("kg");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-light-gray px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal">Onboard Vendor</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-warm-gray hover:text-charcoal text-sm"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 text-sm">
          <div>
            <label className="block text-xs text-warm-gray mb-1">Vendor name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-warm-gray mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-warm-gray mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-warm-gray mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://vendor.example.com"
              className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-gray mb-1">
              Products (comma-separated)
            </label>
            <input
              type="text"
              value={products}
              onChange={(e) => setProducts(e.target.value)}
              placeholder="All-Purpose Flour 25kg, Cocoa Powder 1kg"
              className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-warm-gray mb-1">
                Lead time (days)
              </label>
              <input
                type="number"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">
                Reliability (0–100)
              </label>
              <input
                type="number"
                value={reliability}
                onChange={(e) => setReliability(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">
                Response time (hours)
              </label>
              <input
                type="number"
                value={responseHours}
                onChange={(e) => setResponseHours(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">
                Advance order (days)
              </label>
              <input
                type="number"
                value={advanceDays}
                onChange={(e) => setAdvanceDays(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-warm-gray mb-1">
                Price per unit
              </label>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) =>
                  setUnit(e.target.value as "kg" | "g" | "L" | "count" | "box")
                }
                className="w-full rounded-md border border-light-gray px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="count">count</option>
                <option value="box">box</option>
              </select>
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-light-gray px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save vendor</Button>
        </div>
      </div>
    </div>
  );
}

