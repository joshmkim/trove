export const INVENTORY_REFRESH_EVENT = "trove:inventory-refresh";

export function dispatchInventoryRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INVENTORY_REFRESH_EVENT));
}
