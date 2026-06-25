// Talks to the Express backend (SQLite memory store + AI extraction brain).
// Default "" = same-origin: calls go to /api/* on the Next server, which proxies
// them to the backend (see next.config.ts rewrites) — so there's only ONE host.
// Override with NEXT_PUBLIC_API_BASE if you want to hit a remote backend directly.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// What the backend stores/returns (the frozen contract, type-only card).
export interface ApiCard {
  id: string;
  timestamp: string; // ISO
  type: string; // "Technical" | "Academic" | ...
  win: string;
  overcame: string;
  skill: string;
}

// What the UI renders (lowercase type for the color map, date as YYYY-MM-DD).
export interface UiCard {
  id: string;
  type: string; // "technical" | "academic" | ...
  skill: string;
  win: string;
  overcame: string;
  date: string; // YYYY-MM-DD
}

const VALID = ["academic", "technical", "social", "hobbies", "financial"];

export function fromApi(a: ApiCard): UiCard {
  const type = (a.type || "Technical").toLowerCase();
  return {
    id: a.id,
    type: VALID.includes(type) ? type : "technical",
    skill: a.skill || "",
    win: a.win || "",
    overcame: a.overcame || "",
    date: (a.timestamp || "").slice(0, 10) || "2026-06-01",
  };
}

export async function getCards(): Promise<UiCard[]> {
  const r = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /api/cards ${r.status}`);
  const data: ApiCard[] = await r.json();
  return data.map(fromApi);
}

// Capture a win: send a transcript, the backend AI + memory mint the card.
export async function extractCard(transcript: string): Promise<UiCard> {
  const r = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!r.ok) throw new Error(`POST /api/extract ${r.status}`);
  return fromApi(await r.json());
}

export async function deleteCardApi(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE /api/cards ${r.status}`);
}
