import Badge from "@/components/ui/Badge";
import type { Order } from "@/lib/types";

interface OrdersTableProps {
  orders: Order[];
}

const headers = [
  { label: "Customer" },
  { label: "Order source" },
  { label: "Type" },
  { label: "Items" },
  { label: "Channel" },
  { label: "Location" },
  { label: "Order date", sortable: true },
];

function SortIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block ml-1 w-3 h-3 text-warm-gray"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <div>
      {/* Table meta row */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-light-gray">
        <span className="text-xs text-warm-gray">
          Last updated: Jan 2, 2025 7:09 am WIB
        </span>
        <button
          type="button"
          className="text-xs text-navy underline underline-offset-2 hover:opacity-75 transition-opacity"
        >
          Edit orders
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-light-gray">
              {headers.map((h) => (
                <th
                  key={h.label}
                  className="py-2.5 px-4 text-left text-[13px] font-medium text-warm-gray whitespace-nowrap"
                >
                  {h.label}
                  {h.sortable && <SortIcon />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-warm-gray">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors"
                >
                  <td className="py-3 px-4 text-sm font-medium text-charcoal">
                    {order.customer}
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal">{order.orderSource}</td>
                  <td className="py-3 px-4 text-sm text-charcoal">{order.type}</td>
                  <td className="py-3 px-4">
                    <Badge label={order.items} color="lavender" />
                  </td>
                  <td className="py-3 px-4 text-sm text-charcoal">{order.channel}</td>
                  <td className="py-3 px-4 text-sm text-charcoal">{order.location}</td>
                  <td className="py-3 px-4 text-sm text-warm-gray">{order.orderDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
