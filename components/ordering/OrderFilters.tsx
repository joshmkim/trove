"use client";

import SearchInput from "@/components/ui/SearchInput";

interface OrderFiltersProps {
  vendorQuery: string;
  onVendorChange: (q: string) => void;
  fromDate: string;
  onFromDateChange: (d: string) => void;
  count: number;
}

export default function OrderFilters({
  vendorQuery,
  onVendorChange,
  fromDate,
  onFromDateChange,
  count,
}: OrderFiltersProps) {
  return (
    <div className="px-5 py-3 flex items-center gap-3 border-b border-light-gray">
      <SearchInput
        containerClassName="w-52"
        placeholder="Search by vendor name"
        value={vendorQuery}
        onChange={(e) => onVendorChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-warm-gray whitespace-nowrap">Created from</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          className="px-3 py-2 text-sm border border-light-gray rounded-sm text-charcoal focus:outline-none focus:border-warm-gray transition-colors"
        />
        {fromDate && (
          <button
            type="button"
            onClick={() => onFromDateChange("")}
            className="text-xs text-warm-gray hover:text-charcoal transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <span className="ml-auto text-xs text-warm-gray whitespace-nowrap">
        {count} {count === 1 ? "order" : "orders"}
      </span>
    </div>
  );
}
