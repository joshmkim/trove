"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import VendorPortalToolbar from "@/components/network-intelligence/VendorPortalToolbar";
import VendorPortalCard from "@/components/network-intelligence/VendorPortalCard";
import VendorNetworkTable from "@/components/network-intelligence/VendorNetworkTable";
import OnboardVendorModal, {
  type NewVendorDraft,
} from "@/components/network-intelligence/OnboardVendorModal";
import { supabase } from "@/lib/supabase";
import {
  compareVendorsByUrgency,
  fetchVendorsWithProducts,
  normalizeProductName,
  type VendorRecord,
} from "@/lib/vendorPortal";

const PAGE_SIZE = 4;

export default function NetworkIntelligencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const loadVendors = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchVendorsWithProducts(supabase);
      setVendors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vendors");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const myVendors = useMemo(
    () => vendors.filter((v) => v.status === "my_vendor"),
    [vendors],
  );

  const onboardingVendors = useMemo(
    () => vendors.filter((v) => v.status === "not_onboarded"),
    [vendors],
  );

  const allProducts = useMemo(() => {
    const set = new Set<string>();
    myVendors.forEach((v) => v.products.forEach((p) => set.add(p.productName)));
    return Array.from(set).sort();
  }, [myVendors]);

  const filteredMyVendors = useMemo(() => {
    const query = normalizeProductName(searchQuery);
    const filtered = myVendors.filter((v) => {
      const matchesSearch =
        !query ||
        normalizeProductName(v.name).includes(query) ||
        v.products.some((p) => normalizeProductName(p.productName).includes(query));
      const matchesProduct =
        !productFilter || v.products.some((p) => p.productName === productFilter);
      return matchesSearch && matchesProduct;
    });
    return [...filtered].sort(compareVendorsByUrgency);
  }, [myVendors, searchQuery, productFilter]);

  const filteredOnboardingVendors = useMemo(() => {
    const query = normalizeProductName(searchQuery);
    return onboardingVendors.filter((v) => {
      const matchesSearch =
        !query ||
        normalizeProductName(v.name).includes(query) ||
        v.products.some((p) => normalizeProductName(p.productName).includes(query));
      const matchesProduct =
        !productFilter || v.products.some((p) => p.productName === productFilter);
      return matchesSearch && matchesProduct;
    });
  }, [onboardingVendors, searchQuery, productFilter]);

  const totalMy = filteredMyVendors.length;
  const pageCount = Math.max(1, Math.ceil(totalMy / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredMyVendors.slice(start, start + PAGE_SIZE);
  }, [filteredMyVendors, safePage]);

  const showingFrom = totalMy === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingTo = totalMy === 0 ? 0 : Math.min((safePage + 1) * PAGE_SIZE, totalMy);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, productFilter]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  async function handleCreateVendor(vendor: NewVendorDraft) {
    const { data: createdVendor, error: vendorError } = await supabase
      .from("vendors")
      .insert({
        name: vendor.name,
        vendor_status: "my_vendor",
        contact_method: vendor.contactMethod,
        contact_value: vendor.contactValue,
        reliability_score: vendor.reliabilityScore,
        lead_time_days: vendor.leadTimeDays,
        response_time_hours: vendor.responseTimeHours,
        advance_order_days: vendor.advanceOrderDays,
        onboarded_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (vendorError || !createdVendor) {
      setError(vendorError?.message ?? "Failed to create vendor");
      return;
    }

    const productNames = vendor.products.map((p) => p.productName);
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id, product_name, purchase_unit")
      .in("product_name", productNames);

    if (itemsError || !items) {
      setError(itemsError?.message ?? "Failed to link products");
      return;
    }

    if (items.length > 0) {
      const rows = items.map((item, idx) => {
        const source = vendor.products.find((p) => p.productName === item.product_name);
        return {
          vendor_id: createdVendor.id,
          item_id: item.id,
          price_per_unit: source?.pricePerUnit ?? 1,
          unit: source?.unit ?? item.purchase_unit ?? "unit",
          is_primary: idx === 0,
          order_cadence: "weekly",
          cadence_days: null,
          next_order_date: new Date(Date.now() + 7 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10),
        };
      });
      const { error: vpError } = await supabase.from("vendor_products").insert(rows);
      if (vpError) {
        setError(vpError.message);
      }
    }

    setOnboardOpen(false);
    void loadVendors();
  }

  return (
    <div className="min-h-full bg-white">
      <PageHeader
        title="Vendor Portal"
        actionButton={
          <Button variant="primary" onClick={() => setOnboardOpen(true)}>
            Onboard Vendor
          </Button>
        }
      />

      <section className="mx-6 mt-2 max-w-[1102px] border-b border-[rgba(154,149,139,0.25)] pb-5">
        <VendorPortalToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          products={allProducts}
          showingFrom={showingFrom}
          showingTo={showingTo}
          totalCount={totalMy}
          onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
          onNextPage={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          canPrev={safePage > 0}
          canNext={safePage < pageCount - 1}
        />
      </section>

      <section className="mx-6 mt-8 w-full max-w-[1102px] overflow-x-auto pb-1">
        {loading ? (
          <p className="text-base text-[#958f84]">Loading vendors...</p>
        ) : pageSlice.length === 0 ? (
          <p className="text-base text-[#958f84]">No vendors match your filters.</p>
        ) : (
          <div className="grid w-full grid-cols-[repeat(4,minmax(250px,1fr))] gap-[25px]">
            {pageSlice.map((v) => (
              <VendorPortalCard key={v.id} vendor={v} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-6 mt-16 max-w-[1102px] border-b border-[rgba(154,149,139,0.25)] pb-5">
        <h2 className="text-[32px] font-medium leading-[1.5] text-[#2c2b2a]">
          Vendor Onboarding ({filteredOnboardingVendors.length})
        </h2>
      </section>

      <section className="mx-6 mt-6 max-w-[1100px]">
        <div className="overflow-x-auto">
          <VendorNetworkTable vendors={filteredOnboardingVendors} />
        </div>
      </section>

      {error && <div className="px-6 py-6 text-sm text-red-600">{error}</div>}

      <OnboardVendorModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCreateVendor={handleCreateVendor}
      />
    </div>
  );
}
