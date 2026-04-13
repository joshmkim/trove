// Clover REST API client (read-only)

const CLOVER_BASE = "https://api.clover.com";

function getMerchantId(): string {
  const id = process.env.CLOVER_MERCHANT_ID;
  if (!id) throw new Error("CLOVER_MERCHANT_ID env var is not set");
  return id;
}

function getApiToken(): string {
  const token = process.env.CLOVER_API_TOKEN;
  if (!token) throw new Error("CLOVER_API_TOKEN env var is not set");
  return token;
}

function cloverHeaders() {
  return {
    Authorization: `Bearer ${getApiToken()}`,
    "Content-Type": "application/json",
  };
}

export interface CloverLineItem {
  id: string;
  name: string;
  price: number;
  quantity?: number; // Clover sends one line item entry per unit, so this is often absent
}

export interface CloverOrder {
  id: string;
  state?: string;
  createdTime?: number;
  modifiedTime?: number;
  lineItems?: { elements: CloverLineItem[] };
}

/**
 * Fetch paid orders created since sinceMs (Unix milliseconds).
 * Expands lineItems in one call to avoid N+1 requests.
 */
export async function fetchRecentOrders(sinceMs: number): Promise<CloverOrder[]> {
  const mid = getMerchantId();
  const PAGE_SIZE = 100;
  const all: CloverOrder[] = [];
  let offset = 0;

  while (true) {
    // Build URL manually — URLSearchParams encodes >= as %3E%3D which Clover rejects
    const url = `${CLOVER_BASE}/v3/merchants/${mid}/orders?filter=createdTime>=${sinceMs}&expand=lineItems&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers: cloverHeaders() });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Clover fetchRecentOrders failed ${res.status}: ${text}`);
    }

    const body = (await res.json()) as { elements?: CloverOrder[] };
    const page = body.elements ?? [];
    all.push(...page);

    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  // Only return paid/locked orders (Clover uses 'locked' for paid in v3)
  return all.filter((o) => o.state === "locked" || o.state === "paid");
}
