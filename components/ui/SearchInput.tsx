import { InputHTMLAttributes } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export default function SearchInput({
  containerClassName = "",
  className = "",
  placeholder = "Search item by name",
  ...props
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${containerClassName}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="absolute left-3 w-4 h-4 text-warm-gray pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
        />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        className={`pl-9 pr-3 py-2 text-sm text-charcoal placeholder:text-warm-gray bg-white border border-light-gray rounded-sm outline-none focus:border-warm-gray transition-colors w-full ${className}`}
        {...props}
      />
    </div>
  );
}
