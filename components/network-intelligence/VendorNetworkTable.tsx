"use client";

import { useState, useMemo } from "react";
import type { VendorRecord } from "@/lib/vendorPortal";
import VendorInlineExpand from "./VendorInlineExpand";

interface VendorNetworkTableProps {
  vendors: VendorRecord[];
}

export default function VendorNetworkTable({ vendors }: VendorNetworkTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(() => vendors, [vendors]);

  const headers = [
    "Vendor",
    "Products",
    "Lead time",
    "Reliability",
    "Pricing",
    "Response",
    "",
  ];

  const formatPrice = (value: number, unit: string) => {
    return `$${value.toFixed(value < 1 ? 4 : 2)}/${unit}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-light-gray">
            {headers.map((h) => (
              <th
                key={h}
                className="py-2.5 px-4 text-left text-[13px] font-medium text-warm-gray whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="py-12 text-center text-sm text-warm-gray"
              >
                No vendors match your filters.
              </td>
            </tr>
          ) : (
            rows.flatMap((vendor) => {
              const isExpanded = expandedId === vendor.id;
              const productsDisplay = vendor.products
                .map((p) => p.productName)
                .join(", ");

              return [
                <tr
                  key={vendor.id}
                  className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors"
                >
                  <td className="py-3 px-4 text-sm font-semibold text-charcoal whitespace-nowrap">
                    {vendor.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal max-w-xs truncate">
                    {productsDisplay}
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                    {vendor.leadTimeDays} days
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                    {vendor.reliabilityScore}%
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                    {vendor.products.slice(0, 2).map((p, idx) => (
                      <span key={`${vendor.id}-${p.productName}`} className="mr-2">
                        {formatPrice(p.pricePerUnit, p.unit)}
                        {idx < Math.min(vendor.products.length, 2) - 1 ? "," : ""}
                      </span>
                    ))}
                    {vendor.products.length > 2 && <span>…</span>}
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                    {vendor.responseTimeHours}h
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : vendor.id)
                      }
                      className="px-3 py-1.5 text-xs font-medium border border-light-gray rounded-lg text-charcoal hover:bg-cream transition-colors whitespace-nowrap"
                    >
                      {isExpanded ? "Hide details" : "View details"}
                    </button>
                  </td>
                </tr>,
                isExpanded ? (
                  <VendorInlineExpand key={`${vendor.id}-expand`} vendor={vendor} />
                ) : null,
              ];
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

