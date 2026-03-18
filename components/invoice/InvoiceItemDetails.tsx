const mockItems = [
  { productName: "All-Purpose Flour", qtyIn: 999, skuId: "SKU-ID-1245" },
  { productName: "Unsalted Butter",   qtyIn: 999, skuId: "SKU-ID-1246" },
  { productName: "Granulated Sugar",  qtyIn: 999, skuId: "SKU-ID-1247" },
  { productName: "Heavy Cream",       qtyIn: 999, skuId: "SKU-ID-1248" },
];

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-3.5 h-3.5 text-warm-gray"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
      />
    </svg>
  );
}

export default function InvoiceItemDetails() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-charcoal mb-2">Item Details</h3>
      <div className="border border-light-gray rounded-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-light-gray bg-cream/50">
              <th className="py-2 px-3 text-left text-[12px] font-medium text-warm-gray">
                Product Name
              </th>
              <th className="py-2 px-3 text-left text-[12px] font-medium text-warm-gray w-20">
                Qty In
              </th>
              <th className="py-2 px-3 text-left text-[12px] font-medium text-warm-gray">
                SKU ID
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {mockItems.map((item, i) => (
              <tr
                key={i}
                className="border-b border-light-gray last:border-0 hover:bg-cream/30 transition-colors"
              >
                <td className="py-2 px-3 text-sm text-charcoal">{item.productName}</td>
                <td className="py-2 px-3 text-sm text-charcoal tabular-nums">{item.qtyIn}</td>
                <td className="py-2 px-3 text-sm font-mono text-warm-gray">{item.skuId}</td>
                <td className="py-2 px-3">
                  <button
                    type="button"
                    aria-label="Edit row"
                    className="hover:text-charcoal transition-colors"
                  >
                    <EditIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
