// Talks to the Express backend (SQLite memory store + AI extraction brain).
// Default "" = same-origin: calls go to /api/* on the Next server, which proxies
// them to the backend (see next.config.ts rewrites) — so there's only ONE host.
// Override with NEXT_PUBLIC_API_BASE if you want to hit a remote backend directly.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// What the backend stores/returns (the frozen contract, type-only card).
export interface ApiCard {
  id: string;
  timestamp: string; // ISO
  type: string; // "Career" | "Academic" | "Hobbies" | "Social & Family" | "Financial" | "Health & Wellness"
  win: string;
  skill: string;
}

// What the UI renders (lowercase type for the color map, date as YYYY-MM-DD).
export interface UiCard {
  id: string;
  type: string; // "career" | "academic" | "social & family" | ...
  skill: string;
  win: string;
  date: string; // YYYY-MM-DD
  imageUrl?: string; // card art — client-side only (localStorage), not persisted
}

const VALID = ["academic", "career", "hobbies", "social & family", "financial", "health & wellness"];

export function fromApi(a: ApiCard): UiCard {
  const type = (a.type || "Career").toLowerCase();
  return {
    id: a.id,
    type: VALID.includes(type) ? type : "career",
    skill: a.skill || "",
    win: a.win || "",
    date: (a.timestamp || "").slice(0, 10) || "2026-06-01",
  };
}

// lowercase UI type -> the capitalized label the backend contract expects.
export const TYPE_LABEL: Record<string, string> = {
  academic: "Academic",
  career: "Career",
  hobbies: "Hobbies",
  "social & family": "Social & Family",
  financial: "Financial",
  "health & wellness": "Health & Wellness",
};

export async function getCards(): Promise<UiCard[]> {
  const r = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /api/cards ${r.status}`);
  const data: ApiCard[] = await r.json();
  return data.map(fromApi);
}

// Capture a win: the backend AI summarizes the transcript into the win. An
// optional `skill` (the user's own title) and `type` override the AI so the
// typed title/type are used verbatim. `type` is capitalized for the contract.
export async function extractCard(
  transcript: string,
  opts?: { skill?: string; type?: string }
): Promise<UiCard> {
  const t = opts?.type ? opts.type.toLowerCase() : undefined;
  const r = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transcript,
      skill: opts?.skill,
      type: t ? TYPE_LABEL[t] : undefined,
    }),
  });
  if (!r.ok) throw new Error(`POST /api/extract ${r.status}`);
  return fromApi(await r.json());
}

// Mint a card straight from explicit fields (e.g. a completed Quest), skipping
// the AI rewrite. `type` may be lowercase ("career") — it's mapped to the
// backend's capitalized label here. `date` is "YYYY-MM-DD"; it becomes the timestamp.
export interface NewCardInput {
  type: string;
  skill: string;
  win: string;
  date?: string;
}

export async function createCard(input: NewCardInput): Promise<UiCard> {
  const t = (input.type || "career").toLowerCase();
  const r = await fetch(`${API_BASE}/api/cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: TYPE_LABEL[t] || "Career",
      skill: input.skill,
      win: input.win,
      timestamp: input.date ? `${input.date}T12:00:00.000Z` : undefined,
    }),
  });
  if (!r.ok) throw new Error(`POST /api/cards ${r.status}`);
  return fromApi(await r.json());
}

export async function deleteCardApi(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE /api/cards ${r.status}`);
}

// Fields the detail modal can edit. `image: null` clears the art.
export interface CardPatch {
  skill?: string;
  win?: string;
  type?: string; // "Career" | "Academic" | ... (capitalized for the contract)
}

export async function updateCardApi(id: string, patch: CardPatch): Promise<UiCard> {
  const r = await fetch(`${API_BASE}/api/cards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`PATCH /api/cards ${r.status}`);
  return fromApi(await r.json());
}
