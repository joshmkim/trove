"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import VendorNetworkHeader from "@/components/network-intelligence/VendorNetworkHeader";
import VendorNetworkTable from "@/components/network-intelligence/VendorNetworkTable";
import OnboardVendorModal, {
  type NewVendorDraft,
} from "@/components/network-intelligence/OnboardVendorModal";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import {
  fetchVendorsWithProducts,
  normalizeProductName,
  type VendorRecord,
} from "@/lib/vendorPortal";

export default function NetworkIntelligencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    vendors.forEach((v) => v.products.forEach((p) => set.add(p.productName)));
    return Array.from(set).sort();
  }, [vendors]);

  const filteredMyVendors = useMemo(() => {
    const query = normalizeProductName(searchQuery);
    return myVendors.filter((v) => {
      const matchesSearch =
        !query ||
        normalizeProductName(v.name).includes(query) ||
        v.products.some((p) => normalizeProductName(p.productName).includes(query));
      const matchesProduct =
        !productFilter || v.products.some((p) => p.productName === productFilter);
      return matchesSearch && matchesProduct;
    });
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
    <div>
      <PageHeader title="Vendor Portal" />

      <section className="mx-6 mt-6 border border-light-gray rounded-sm bg-white">
        <VendorNetworkHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          products={allProducts}
        />
      </section>

      <section className="mx-6 mt-6 border border-light-gray rounded-sm bg-white">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-charcoal">
              My Vendors ({filteredMyVendors.length})
            </h2>
            <p className="mt-1 text-sm text-warm-gray">
              Vendors that have completed onboarding and are ready to use.
            </p>
          </div>
          <Button variant="primary" onClick={() => setOnboardOpen(true)}>
            Onboard Vendor
          </Button>
        </div>
        <div className="px-6 pb-5">
          <VendorNetworkTable vendors={filteredMyVendors} />
        </div>
      </section>

      <section className="mx-6 my-6 border border-light-gray rounded-sm bg-white">
        <div className="px-6 pt-6 pb-3">
          <div>
            <h2 className="text-[20px] font-semibold text-charcoal">
              Vendor Onboarding ({filteredOnboardingVendors.length})
            </h2>
            <p className="mt-1 text-sm text-warm-gray">
              Vendors in this list are candidates and have not been onboarded yet.
            </p>
          </div>
        </div>
        <div className="px-6 py-4">
          <VendorNetworkTable vendors={filteredOnboardingVendors} />
        </div>
      </section>
      {loading && (
        <div className="px-6 pb-6 text-sm text-warm-gray">Loading vendors...</div>
      )}
      {error && <div className="px-6 pb-6 text-sm text-red-600">{error}</div>}
      <OnboardVendorModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCreateVendor={handleCreateVendor}
      />
    </div>
  );
}
