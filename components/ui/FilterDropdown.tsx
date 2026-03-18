import { SelectHTMLAttributes } from "react";

interface FilterDropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export default function FilterDropdown({
  label,
  options,
  className = "",
  ...props
}: FilterDropdownProps) {
  return (
    <div className="relative inline-flex items-center">
      <span className="absolute left-3 text-sm text-warm-gray pointer-events-none select-none whitespace-nowrap">
        {label}:&nbsp;
      </span>
      <select
        className={`appearance-none pl-[calc(0.75rem+var(--label-width,2.5rem))] pr-7 py-2 text-sm text-charcoal bg-white border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors cursor-pointer ${className}`}
        style={{ paddingLeft: `calc(0.75rem + ${(label.length + 2) * 0.5}rem)` }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="absolute right-2 w-4 h-4 text-warm-gray pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
