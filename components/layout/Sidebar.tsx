"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/inventory", label: "Inventory" },
  { href: "/ordering", label: "Ordering" },
  { href: "/network-intelligence", label: "Network Intelligence" },
];

interface SidebarProps {
  onUploadClick: () => void;
}

export default function Sidebar({ onUploadClick }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-[230px] h-screen sticky top-0 bg-white border-r border-light-gray shrink-0">
      {/* Logo / Business Name */}
      <div className="px-6 py-5 border-b border-light-gray">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-charcoal font-semibold text-sm">Harucake</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "font-semibold text-charcoal bg-cream"
                  : "font-normal text-warm-gray hover:text-charcoal hover:bg-cream/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Invoice Upload Zone */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onUploadClick}
          className="w-full border-2 border-dashed border-light-gray rounded-sm py-5 px-3 flex flex-col items-center gap-1.5 hover:border-warm-gray transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-warm-gray"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V18"
            />
          </svg>
          <span className="text-charcoal text-sm font-medium">Upload Invoice</span>
          <span className="text-warm-gray text-xs">Drag and drop</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-light-gray">
        <span className="text-warm-gray text-xs">Harucake</span>
      </div>
    </aside>
  );
}
