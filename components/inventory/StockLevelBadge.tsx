interface StockLevelBadgeProps {
  level: "Low" | "High";
  percent: number; // 0–100
}

export default function StockLevelBadge({ level, percent }: StockLevelBadgeProps) {
  const isLow = level === "Low";

  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <span className={`text-xs font-medium ${isLow ? "text-warm-gray" : "text-charcoal"}`}>
        {level}
      </span>
      <div className="h-1 w-16 bg-light-gray rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isLow ? "bg-lavender" : "bg-navy"}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
