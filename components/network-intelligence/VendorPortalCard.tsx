"use client";

import type { VendorRecord } from "@/lib/vendorPortal";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

function formatOrderBy(dateStr: string | null): string {
  if (!dateStr) return "Order by TBD";
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "Order by TBD";
  return `Order by ${d.getMonth() + 1}/${d.getDate()}`;
}

function orderDaysAbbrev(vendor: VendorRecord): string {
  const primary = vendor.products.find((p) => p.isPrimary) ?? vendor.products[0];
  if (!primary) return "—";
  const c = primary.orderCadence;
  if (c === "daily") return "Daily";
  if (c === "weekly") return "Weekly";
  if (c === "biweekly") return "Biweekly";
  if (c === "custom_days" && primary.cadenceDays) return `${primary.cadenceDays}d`;
  return "Custom";
}

function formatPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

function MailIcon() {
  return (
    <svg className="size-3 shrink-0 text-[#9a958b]" fill="none" viewBox="0 0 12 12" aria-hidden>
      <rect x="1.5" y="2.5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 3.5 6 7l4.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="size-3 shrink-0 text-[#9a958b]" fill="none" viewBox="0 0 12 12" aria-hidden>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1.5 6h9M6 1.5c1.5 2 1.5 7 0 9M6 1.5c-1.5 2-1.5 7 0 9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="size-3 shrink-0 text-[#9a958b]" fill="none" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M3.2 2.5h1.2l1 2.4-.8.5a5.2 5.2 0 0 0 2.4 2.4l.5-.8 2.4 1v1.2a.8.8 0 0 1-.8.8A8 8 0 0 1 2.4 3.3a.8.8 0 0 1 .8-.8Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface VendorPortalCardProps {
  vendor: VendorRecord;
}

export default function VendorPortalCard({ vendor }: VendorPortalCardProps) {
  const nextDates = vendor.products
    .map((p) => p.nextOrderDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const nextOrder = nextDates[0] ?? null;
  const dLeft = daysUntil(nextOrder);
  const isUrgent = dLeft !== null && dLeft >= 0 && dLeft <= 3;

  const sortedProducts = [...vendor.products].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.productName.localeCompare(b.productName);
  });
  const displayProducts = sortedProducts.slice(0, 4);

  const emailLine = vendor.contactMethod === "email" ? vendor.contactValue : undefined;
  const webLine =
    vendor.contactMethod === "website"
      ? vendor.contactValue.replace(/^https?:\/\//, "")
      : vendor.contactMethod === "email"
        ? (() => {
            const at = vendor.contactValue.indexOf("@");
            if (at === -1) return undefined;
            return vendor.contactValue.slice(at + 1);
          })()
        : undefined;

  return (
    <div
      className="flex h-full min-h-[300px] w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[rgba(154,149,139,0.25)] bg-white px-[30px] py-[25px] shadow-[0px_1px_10px_0px_rgba(44,43,42,0.05)]"
      role="article"
      aria-label={vendor.name}
    >
      <div className="flex w-full shrink-0 flex-col items-stretch gap-2.5">
        <h3 className="w-full text-left text-2xl font-medium leading-[1.11] text-[#2c2b2a]">
          {vendor.name}
        </h3>
        <div className="flex w-full flex-col items-start gap-1 text-left">
          {vendor.contactMethod === "email" && emailLine && (
            <div className="flex items-center gap-1.5">
              <MailIcon />
              <span className="text-xs font-medium tracking-[-0.132px] text-[#9a958b]">
                {emailLine}
              </span>
            </div>
          )}
          {vendor.contactMethod === "website" && webLine && (
            <div className="flex items-center gap-1.5">
              <GlobeIcon />
              <span className="text-xs font-medium tracking-[-0.132px] text-[#9a958b]">
                {webLine}
              </span>
            </div>
          )}
          {vendor.contactMethod === "phone" && (
            <div className="flex items-center gap-1.5">
              <PhoneIcon />
              <span className="text-xs font-medium tracking-[-0.132px] text-[#9a958b]">
                {vendor.contactValue}
              </span>
            </div>
          )}
          {vendor.contactMethod === "email" && webLine && (
            <div className="flex items-center gap-1.5">
              <GlobeIcon />
              <span className="text-xs font-medium tracking-[-0.132px] text-[#9a958b]">
                {webLine}
              </span>
            </div>
          )}
        </div>
        <p className="w-full text-left text-xs font-medium tracking-[-0.132px]">
          <span className="text-[#2c2b2a]">{orderDaysAbbrev(vendor)}</span>
          <span className="text-[#2c2b2a]"> </span>
          <span className="text-[#9a958b]">Order days</span>
        </p>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-5 text-left">
        <div className="flex w-full flex-col gap-1.5 rounded-[10px] border border-[rgba(154,149,139,0.25)] px-[15px] py-2.5">
          {displayProducts.map((p, idx) => (
            <div
              key={p.itemId}
              className="flex w-full items-center justify-between gap-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 text-xs font-medium tracking-[-0.132px] text-[#9a958b]">
                  {idx + 1}
                </span>
                <span className="truncate text-sm font-medium tracking-[-0.154px] text-[#2c2b2a]">
                  {p.productName}
                </span>
              </div>
              <span className="shrink-0 text-xs font-medium tracking-[-0.132px] text-[#718d53]">
                {formatPrice(p.pricePerUnit)}
              </span>
            </div>
          ))}
          {displayProducts.length === 0 && (
            <p className="text-xs text-[#9a958b]">No products linked</p>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-center gap-[15px] text-base font-medium tracking-[-0.176px] text-[#2c2b2a]">
          <p>
            <span className="leading-[1.5]">{vendor.leadTimeDays}d</span>
            <span className="leading-[1.5] text-[#9a958b]"> lead</span>
          </p>
          <p>
            <span className="leading-[1.5]">{vendor.responseTimeHours}h</span>
            <span className="leading-[1.5] text-[#9a958b]"> response</span>
          </p>
        </div>
      </div>

      <div
        className={`mt-auto w-full shrink-0 rounded-[10px] px-2.5 py-1.5 ${
          isUrgent ? "bg-[rgba(197,58,58,0.1)]" : "bg-[rgba(145,176,217,0.25)]"
        }`}
      >
        <p
          className={`text-sm font-medium tracking-[-0.154px] ${
            isUrgent ? "text-[#c53a3a]" : "text-[#576e42]"
          }`}
        >
          {isUrgent && dLeft !== null
            ? `${dLeft} day${dLeft === 1 ? "" : "s"} left to order`
            : formatOrderBy(nextOrder)}
        </p>
      </div>
    </div>
  );
}
