"use client";

import { cadenceLabel, type VendorRecord } from "@/lib/vendorPortal";

interface VendorInlineExpandProps {
  vendor: VendorRecord;
}

export default function VendorInlineExpand({ vendor }: VendorInlineExpandProps) {
  const primaryContact = vendor.contactValue || "Not provided";

  const lines = vendor.products
    .map((p) => `- ${p.productName} @ $${p.pricePerUnit.toFixed(p.pricePerUnit < 1 ? 4 : 2)}/${p.unit}`)
    .join("\n");

  const emailTemplate = `Hi ${vendor.name},

We'd love to get a quote and lead times for:
${lines}

Thank you,
Harucake`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailTemplate);
    } catch {
      // ignore clipboard failures in demo
    }
  };

  return (
    <tr className="bg-cream/40">
      <td colSpan={7} className="px-4 py-4">
        <div className="flex flex-col gap-2 text-sm text-charcoal">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="text-xs text-warm-gray">Primary contact</span>
              <div className="text-sm">
                <span className="mr-2 capitalize">{vendor.contactMethod}:</span>
                <span className="text-warm-gray">{primaryContact}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-warm-gray">Advance order</span>
              <div>{vendor.advanceOrderDays} days</div>
            </div>
            <div>
              <span className="text-xs text-warm-gray">Typical response time</span>
              <div>{vendor.responseTimeHours} hours</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="mb-3">
              <span className="text-xs text-warm-gray">Cadence by product</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {vendor.products.map((p) => (
                  <span
                    key={`${vendor.id}-${p.itemId}`}
                    className="inline-flex rounded border border-light-gray bg-white px-2 py-1 text-xs text-charcoal"
                  >
                    {p.productName}: {cadenceLabel(p.orderCadence, p.cadenceDays)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-warm-gray">
                Outreach template (copy and paste into email or SMS)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium text-navy hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-sm border border-light-gray bg-white px-3 py-2 text-xs text-charcoal max-h-40 overflow-auto">
{emailTemplate}
            </pre>
          </div>
        </div>
      </td>
    </tr>
  );
}

