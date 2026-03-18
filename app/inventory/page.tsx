import PageHeader from "@/components/layout/PageHeader";

export default function InventoryPage() {
  return (
    <div>
      <PageHeader
        title="Inventory Management"
        actionButton={
          <button
            type="button"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            + Add Item
          </button>
        }
      />
      <div className="px-6 py-6">
        <p className="text-warm-gray text-sm">Inventory content coming soon.</p>
      </div>
    </div>
  );
}
