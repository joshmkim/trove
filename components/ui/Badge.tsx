interface BadgeProps {
  label: string;
  color?: "lavender" | "navy" | "green" | "warm-gray";
  pill?: boolean;
}

const colorMap: Record<NonNullable<BadgeProps["color"]>, string> = {
  lavender: "bg-lavender text-white",
  navy: "bg-navy text-white",
  green: "bg-green-500 text-white",
  "warm-gray": "bg-light-gray text-charcoal",
};

export default function Badge({ label, color = "lavender", pill = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center text-xs font-semibold ${
        pill ? "px-2.5 py-0.5 rounded-full" : "w-7 h-7 rounded-full"
      } ${colorMap[color]}`}
    >
      {label}
    </span>
  );
}
