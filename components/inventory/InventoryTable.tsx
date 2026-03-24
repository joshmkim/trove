import { InventoryItem } from "@/lib/mockData";
import InventoryLineItem from "./InventoryLineItem";

interface InventoryTableProps {
  items: InventoryItem[];
}

const headers = [
  { label: "", className: "w-[4%]" },
  { label: "Product Name", className: "w-[40%]" },
  { label: "Stock Level", className: "w-[14%]" },
  { label: "Qty In", className: "w-[10%]" },
  { label: "Qty Out", className: "w-[10%]" },
  { label: "Qty Balance", className: "w-[12%]" },
  { label: "SKU ID", className: "w-[14%]" },
  { label: "", className: "w-[4%]" },
];

export default function InventoryTable({ items }: InventoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-light-gray">
            {headers.map((h, i) => (
              <th
                key={`${h.label}-${i}`}
                className={`py-2.5 px-4 text-left text-[13px] font-medium text-warm-gray ${h.className}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-warm-gray">
                No items found.
              </td>
            </tr>
          ) : (
            items.map((item) => <InventoryLineItem key={item.id} item={item} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
