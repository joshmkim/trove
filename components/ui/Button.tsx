import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[#718D53] text-white hover:bg-[#5E7645]",
    outline: "bg-white text-charcoal border border-light-gray hover:bg-cream",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
