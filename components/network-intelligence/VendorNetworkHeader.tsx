"use client";

import { useMemo } from "react";

interface VendorNetworkHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  products: string[];
}

export default function VendorNetworkHeader({
  searchQuery,
  onSearchChange,
  productFilter,
  onProductFilterChange,
  products,
}: VendorNetworkHeaderProps) {
  const productOptions = useMemo(
    () => ["All products", ...products],
    [products],
  );

  return (
    <div className="px-6 pt-6 pb-4 border-b border-light-gray flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vendors or products"
            className="w-full rounded-xl border border-light-gray bg-white px-3 py-2 pr-8 text-sm text-charcoal placeholder:text-warm-gray focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-warm-gray">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M9 3.5a5.5 5.5 0 104.384 8.808l2.654 2.654"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <select
          value={productFilter}
          onChange={(e) => onProductFilterChange(e.target.value)}
          className="h-9 rounded-xl border border-light-gray bg-white px-3 text-sm text-charcoal"
        >
          {productOptions.map((label) => (
            <option key={label} value={label === "All products" ? "" : label}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

