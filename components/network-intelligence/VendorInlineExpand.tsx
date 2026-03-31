"use client";

import type { Vendor } from "@/lib/vendorNetworkMock";

interface VendorInlineExpandProps {
  vendor: Vendor;
}

export default function VendorInlineExpand({ vendor }: VendorInlineExpandProps) {
  const primaryContact =
    vendor.contact.email ?? vendor.contact.phone ?? "Not provided";

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
                {vendor.contact.email && (
                  <span className="mr-2">{vendor.contact.email}</span>
                )}
                {vendor.contact.phone && (
                  <span className="text-warm-gray">{vendor.contact.phone}</span>
                )}
                {!vendor.contact.email && !vendor.contact.phone && (
                  <span className="text-warm-gray">Not provided</span>
                )}
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

