"use client";

import SearchInput from "@/components/ui/SearchInput";
import ViewToggle from "@/components/ui/ViewToggle";
import FilterDropdown from "@/components/ui/FilterDropdown";

interface AllItemsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeView: "list" | "grid";
  onViewToggle: (view: "list" | "grid") => void;
  filter: string;
  onFilterChange: (value: string) => void;
}

const filterOptions = [
  { value: "all", label: "All" },
  { value: "low", label: "Low Stock" },
  { value: "high", label: "High Stock" },
];

export default function AllItemsHeader({
  searchQuery,
  onSearchChange,
  activeView,
  onViewToggle,
  filter,
  onFilterChange,
}: AllItemsHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-light-gray">
      <h2 className="text-[20px] font-semibold text-charcoal">All Items</h2>

      <div className="flex items-center gap-2">
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          containerClassName="w-56"
        />
        <ViewToggle activeView={activeView} onToggle={onViewToggle} />
        <FilterDropdown
          label="Show"
          options={filterOptions}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>
    </div>
  );
}
