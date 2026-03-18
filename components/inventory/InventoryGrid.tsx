import { InventoryItem } from "@/lib/mockData";
import InventoryCard from "./InventoryCard";

interface InventoryGridProps {
  items: InventoryItem[];
}

export default function InventoryGrid({ items }: InventoryGridProps) {
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-warm-gray">No items found.</p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {items.map((item) => (
        <InventoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}
