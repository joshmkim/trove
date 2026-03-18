import { InventoryItem } from "@/lib/mockData";

interface InventoryCardProps {
  item: InventoryItem;
}

export default function InventoryCard({ item }: InventoryCardProps) {
  return (
    <div className="flex flex-col bg-white border border-light-gray rounded-sm overflow-hidden hover:shadow-sm transition-shadow">
      {/* SKU ID */}
      <div className="px-3 pt-3 pb-1">
        <span className="text-xs text-warm-gray font-mono">{item.skuId}</span>
      </div>

      {/* Image placeholder */}
      <div className="mx-3 bg-cream rounded-sm aspect-square" />

      {/* Name + quantity */}
      <div className="px-3 pt-2 pb-3 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-charcoal leading-snug">
          {item.productName}
        </span>
        <span className="text-xs text-warm-gray">{item.quantityRemaining} remaining</span>
      </div>
    </div>
  );
}
