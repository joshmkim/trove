import { InventoryItem } from "@/lib/mockData";
import StockLevelBadge from "./StockLevelBadge";

interface InventoryLineItemProps {
  item: InventoryItem;
}

export default function InventoryLineItem({ item }: InventoryLineItemProps) {
  return (
    <tr className="border-b border-light-gray last:border-0 hover:bg-cream/40 transition-colors">
      {/* Product Name */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-cream shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-charcoal leading-snug">
              {item.productName}
            </span>
            <span className="text-xs text-warm-gray">
              {item.quantityRemaining} remaining
            </span>
          </div>
        </div>
      </td>

      {/* Stock Level */}
      <td className="py-3 px-4">
        <StockLevelBadge level={item.stockLevel} percent={item.stockPercent} />
      </td>

      {/* Qty In */}
      <td className="py-3 px-4 text-sm text-charcoal tabular-nums">{item.qtyIn}</td>

      {/* Qty Out */}
      <td className="py-3 px-4 text-sm text-charcoal tabular-nums">{item.qtyOut}</td>

      {/* Qty Balance */}
      <td className="py-3 px-4 text-sm font-semibold text-charcoal tabular-nums">
        {item.qtyBalance}
      </td>

      {/* SKU ID */}
      <td className="py-3 px-4 text-sm text-warm-gray font-mono">{item.skuId}</td>
    </tr>
  );
}
