import PageHeader from "@/components/layout/PageHeader";

export default function OrderingPage() {
  return (
    <div>
      <PageHeader
        title="Ordering"
        actionButton={
          <button
            type="button"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Create Order
          </button>
        }
      />
      <div className="px-6 py-6">
        <p className="text-warm-gray text-sm">Ordering content coming soon.</p>
      </div>
    </div>
  );
}
