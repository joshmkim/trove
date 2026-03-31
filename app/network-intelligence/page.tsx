"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { getAllVendorProducts, getVendorNetwork, type Vendor } from "@/lib/vendorNetworkMock";
import VendorNetworkHeader from "@/components/network-intelligence/VendorNetworkHeader";
import VendorNetworkTable from "@/components/network-intelligence/VendorNetworkTable";
import OnboardVendorModal from "@/components/network-intelligence/OnboardVendorModal";
import Button from "@/components/ui/Button";

export default function NetworkIntelligencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [customVendors, setCustomVendors] = useState<Vendor[]>([]);

  const baseVendors = useMemo(() => getVendorNetwork(), []);

  const allProducts = useMemo(() => getAllVendorProducts(), []);

  const applyFilters = (vendors: Vendor[]) =>
    vendors.filter((v) => {
      const matchesSearch =
        !searchQuery ||
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.products.some((p) =>
          p.productName.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      const matchesProduct =
        !productFilter ||
        v.products.some((p) => p.productName === productFilter);

      return matchesSearch && matchesProduct;
    });

  const filteredOnboardingVendors = useMemo(
    () => applyFilters(baseVendors),
    [baseVendors, searchQuery, productFilter],
  );

  return (
    <div>
      <PageHeader title="Vendor Portal" />

      <section className="mx-6 mt-6 border border-light-gray rounded-sm bg-white">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-charcoal">My Vendors</h2>
            <p className="mt-1 text-sm text-warm-gray">
              Vendors that have completed onboarding and are ready to use.
            </p>
            <p className="mt-3 text-sm text-charcoal">
              {customVendors.length === 0
                ? "No vendors onboarded yet."
                : `${customVendors.length} onboarded vendor${customVendors.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <Button variant="primary" onClick={() => setOnboardOpen(true)}>
            Onboard Vendor
          </Button>
        </div>
      </section>

      <section className="mx-6 my-6 border border-light-gray rounded-sm bg-white">
        <div className="px-6 pt-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-charcoal">Vendor Onboarding</h2>
            <p className="mt-1 text-sm text-warm-gray">
              Vendors in this list are candidates and have not been onboarded yet.
            </p>
          </div>
        </div>
        <VendorNetworkHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          products={allProducts}
        />
        <div className="px-6 py-4">
          <VendorNetworkTable vendors={filteredOnboardingVendors} />
        </div>
      </section>
      <OnboardVendorModal
        isOpen={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCreateVendor={(vendor) =>
          setCustomVendors((prev) => [...prev, vendor])
        }
      />
    </div>
  );
}
