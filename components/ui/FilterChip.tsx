import { ButtonHTMLAttributes } from "react";

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  value: string;
  active?: boolean;
}

export default function FilterChip({
  label,
  value,
  active = false,
  className = "",
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors whitespace-nowrap ${
        active
          ? "bg-navy text-white border-navy"
          : "bg-cream text-charcoal border-light-gray hover:border-warm-gray"
      } ${className}`}
      {...props}
    >
      <span className="text-warm-gray">{label}:</span>
      <span className="font-medium">{value}</span>
    </button>
  );
}
