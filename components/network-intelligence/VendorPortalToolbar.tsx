"use client";

interface VendorPortalToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  productFilter: string;
  onProductFilterChange: (value: string) => void;
  products: string[];
  showingFrom: number;
  showingTo: number;
  totalCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  canPrev: boolean;
  canNext: boolean;
}

function SearchIcon() {
  return (
    <svg className="size-3 shrink-0 text-[#958f84]" fill="none" viewBox="0 0 12 12" aria-hidden>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-5 shrink-0 text-[#2c2b2a]"}
      fill="none"
      viewBox="0 0 20 20"
      aria-hidden
    >
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-5"} fill="none" viewBox="0 0 20 20" aria-hidden>
      <path
        d="M8 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VendorPortalToolbar({
  searchQuery,
  onSearchChange,
  productFilter,
  onProductFilterChange,
  products,
  showingFrom,
  showingTo,
  totalCount,
  onPrevPage,
  onNextPage,
  canPrev,
  canNext,
}: VendorPortalToolbarProps) {
  const showLabel = productFilter ? productFilter : "All";

  return (
    <div className="flex w-full flex-col gap-5 border-b border-[rgba(154,149,139,0.25)] px-5 pb-5">
      <div className="flex w-full items-end justify-between gap-4">
        <h2 className="text-[32px] font-medium leading-[1.5] text-[#2c2b2a]">My Vendors</h2>
        <p className="whitespace-nowrap text-base font-medium leading-[1.11] text-[#958f84]">
          Showing {showingFrom}–{showingTo} of {totalCount}
        </p>
      </div>
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex h-9 max-w-full shrink-0 items-center gap-2 rounded-[10px] border border-[rgba(149,143,132,0.35)] bg-white px-2.5 py-1.5">
            <SearchIcon />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search vendor by item or name"
              title={searchQuery || "Search vendor by item or name"}
              className="w-[8.5rem] shrink-0 truncate bg-transparent font-sans text-sm font-normal leading-5 text-[#958f84] placeholder:text-[#958f84] focus:outline-none sm:w-[9.5rem]"
            />
          </label>
          <div className="relative inline-flex h-9 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgba(149,143,132,0.35)] bg-white px-2.5 py-1.5">
            <span className="inline-flex min-w-0 max-w-[min(10rem,100vw-8rem)] items-baseline gap-1 text-sm font-normal leading-5 tracking-[-0.154px] text-[#958f84]">
              <span className="shrink-0">Show:</span>
              <span
                className="min-w-0 truncate font-medium text-[#2c2b2a]"
                title={showLabel}
              >
                {showLabel}
              </span>
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-[#2c2b2a]" />
            <select
              value={productFilter}
              onChange={(e) => onProductFilterChange(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Filter by product"
            >
              <option value="">All</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-[15px]">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={!canPrev}
            className="flex items-center justify-center rounded-[20px] bg-[rgba(113,141,83,0.25)] p-1.5 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronRightIcon className="size-5 rotate-180 text-[#576e42]" />
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!canNext}
            className="flex items-center justify-center rounded-[20px] bg-[#576e42] p-1.5 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
