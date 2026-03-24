"use client";

import type { PurchaseOrder } from "@/lib/types";

interface OrdersTableProps {
  orders: PurchaseOrder[];
  onViewOrder: (orderId: string) => void;
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   className: "bg-amber-100 text-amber-700" },
  accepted:  { label: "Accepted",  className: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-600" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function shortId(id: string): string {
  return "ORD-" + id.slice(0, 8).toUpperCase();
}

const headers = [
  "Order #",
  "Vendors",
  "Delivery By",
  "Status",
  "Created",
  "",
];

export default function OrdersTable({ orders, onViewOrder }: OrdersTableProps) {
  return (
    <div>
      {/* Table */}
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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-warm-gray">
                  No orders yet — click &ldquo;Create Order&rdquo; to place one.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const vendorNames = [
                  ...new Set(
                    order.items
                      .map((i) => i.vendorName)
                      .filter((n): n is string => !!n)
                  ),
                ];
                const vendorsDisplay =
                  vendorNames.length > 0
                    ? vendorNames.join(", ")
                    : order.totalVendors > 0
                    ? `${order.totalVendors} vendor${order.totalVendors !== 1 ? "s" : ""}`
                    : "—";

                const cfg = STATUS_CONFIG[order.status];

                return (
                  <tr
                    key={order.id}
                    className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-charcoal whitespace-nowrap">
                      {shortId(order.id)}
                    </td>
                    <td className="py-3 px-4 text-sm text-charcoal max-w-[200px] truncate">
                      {vendorsDisplay}
                    </td>
                    <td className="py-3 px-4 text-sm text-charcoal whitespace-nowrap">
                      {fmtDate(order.deliveryBy)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-warm-gray whitespace-nowrap">
                      {fmtDate(order.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onViewOrder(order.id)}
                        className="px-3 py-1.5 text-xs font-medium border border-light-gray rounded-lg text-charcoal hover:bg-cream transition-colors whitespace-nowrap"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
