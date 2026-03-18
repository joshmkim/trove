import FilterChip from "@/components/ui/FilterChip";
import SearchInput from "@/components/ui/SearchInput";

export default function OrderFilters() {
  return (
    <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b border-light-gray">
      <SearchInput containerClassName="w-48" placeholder="Search orders" />

      <FilterChip label="Date" value="1/4/2024 – 1/2/2025" />
      <FilterChip label="Type" value="All" />
      <FilterChip label="Payment statuses" value="All" />
      <FilterChip label="Channels" value="All" />
      <FilterChip label="Order sources" value="" />
    </div>
  );
}
