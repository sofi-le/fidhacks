// Data layer — talks DIRECTLY to Supabase (Postgres + Storage) from the browser.
// Row-Level Security scopes every row to the signed-in user, so there is no
// app server for data. The only server left is the AI brain (/api/extract,
// /api/recap) which keeps the Anthropic key private — reached via the Next proxy.
//
// The exported function names/types are unchanged from the old REST client, so
// the UI components didn't have to change shape.

import { supabase, cardArtPublicUrl } from "./supabase";
import sampleCards from "../../shared/sampleCards.json";

// AI server (Express) — proxied by Next at /api/* (see next.config.ts).
export const AI_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// What the UI renders (lowercase type for the color map, date as YYYY-MM-DD).
export interface UiCard {
  id: string;
  type: string; // "career" | "academic" | "social & family" | ...
  skill: string;
  win: string;
  date: string; // YYYY-MM-DD
  imageUrl?: string; // card art — now persisted in Supabase Storage
  callback?: string; // AI "growth callback" when the skill is already in memory
}

// A row of the `cards` table.
interface CardRow {
  id: string;
  user_id?: string;
  timestamp: string;
  type: string;
  win: string;
  skill: string;
  image_url: string | null;
  callback?: string | null;
}

const VALID = ["academic", "career", "hobbies", "social & family", "financial", "health & wellness"];

function localDateStr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function rowToUi(r: CardRow): UiCard {
  const type = (r.type || "Career").toLowerCase();
  return {
    id: r.id,
    type: VALID.includes(type) ? type : "career",
    skill: r.skill || "",
    win: r.win || "",
    date: localDateStr(r.timestamp) || "2026-06-01",
    imageUrl: r.image_url || undefined,
    callback: r.callback || undefined,
  };
}

// lowercase UI type -> the capitalized label stored in the DB.
export const TYPE_LABEL: Record<string, string> = {
  academic: "Academic",
  career: "Career",
  hobbies: "Hobbies",
  "social & family": "Social & Family",
  financial: "Financial",
  "health & wellness": "Health & Wellness",
};

// --- auth helper ------------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// --- reads ------------------------------------------------------------------

export async function getCards(): Promise<UiCard[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) throw new Error(`getCards: ${error.message}`);
  return (data ?? []).map(rowToUi);
}

// Episodic + semantic memory for the AI prompt, derived from the user's cards.
async function getMemory() {
  const { data } = await supabase
    .from("cards")
    .select("timestamp,type,skill,win")
    .order("timestamp", { ascending: false });
  const cards = (data ?? []) as Pick<CardRow, "timestamp" | "type" | "skill" | "win">[];

  const recentCards = cards.slice(0, 12);

  // skillsSeen: count per skill + earliest date (oldest-first scan for first_date).
  const seen = new Map<string, { skill: string; count: number; first_date: string }>();
  for (const c of [...cards].reverse()) {
    const prev = seen.get(c.skill);
    if (prev) prev.count += 1;
    else seen.set(c.skill, { skill: c.skill, count: 1, first_date: c.timestamp });
  }
  const skillsSeen = [...seen.values()].sort((a, b) => b.count - a.count);
  return { recentCards, skillsSeen };
}

// --- writes -----------------------------------------------------------------

// Capture a win: the AI server summarizes the transcript into the one-line win;
// the user's typed title (skill) + type override the AI. The assembled card is
// inserted straight into Supabase (user_id defaults to auth.uid() via RLS).
export async function extractCard(
  transcript: string,
  opts?: { skill?: string; type?: string }
): Promise<UiCard> {
  const { recentCards, skillsSeen } = await getMemory();

  let draft: { type: string; win: string; skill: string; callback?: string } = {
    type: "Career",
    win: transcript.slice(0, 160) || "Logged a win.",
    skill: "General",
  };
  try {
    const r = await fetch(`${AI_BASE}/api/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript, recentCards, skillsSeen, skill: opts?.skill || "" }),
    });
    if (r.ok) draft = await r.json();
  } catch {
    // AI server offline — fall back to the raw transcript draft above.
  }

  const t = opts?.type ? opts.type.toLowerCase() : undefined;
  const type = t ? TYPE_LABEL[t] || draft.type : draft.type;
  const skill = opts?.skill && opts.skill.trim() ? opts.skill.trim().slice(0, 80) : draft.skill;
  const callback = draft.callback && draft.callback.trim() ? draft.callback.trim() : null;

  const base = { type, win: draft.win, skill, timestamp: new Date().toISOString() };
  const insertRow = callback ? { ...base, callback } : base;
  let res = await supabase.from("cards").insert(insertRow).select().single();
  // If the `callback` column isn't there yet (migration 0003 not run), retry without it.
  if (res.error && callback) res = await supabase.from("cards").insert(base).select().single();
  if (res.error) throw new Error(`extractCard insert: ${res.error.message}`);
  return rowToUi(res.data);
}

// Suggest a card title (skill) from a description, WITHOUT creating a card.
// Backs the "✨ Title" button in the add-win form — it just drafts and returns
// the skill the AI would pick (reusing prior skill tags from memory).
export async function suggestTitle(description: string): Promise<string> {
  const { recentCards, skillsSeen } = await getMemory();
  const r = await fetch(`${AI_BASE}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript: description, recentCards, skillsSeen }),
  });
  if (!r.ok) throw new Error(`suggestTitle ${r.status}`);
  const draft = await r.json();
  return (draft.skill || "").toString().replace(/\s+/g, " ").trim().slice(0, 80);
}

// Mint a card straight from explicit fields (e.g. a completed Quest), skipping
// the AI rewrite. `type` may be lowercase; it's mapped to the stored label here.
export interface NewCardInput {
  type: string;
  skill: string;
  win: string;
  date?: string;
}

export async function createCard(input: NewCardInput): Promise<UiCard> {
  const t = (input.type || "career").toLowerCase();
  const { data, error } = await supabase
    .from("cards")
    .insert({
      type: TYPE_LABEL[t] || "Career",
      skill: (input.skill || "General").slice(0, 80),
      win: input.win || "Logged a win.",
      timestamp: input.date ? `${input.date}T12:00:00.000Z` : new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`createCard: ${error.message}`);
  return rowToUi(data);
}

export interface CardPatch {
  skill?: string;
  win?: string;
  type?: string; // "Career" | "Academic" | ... (capitalized label)
}

export async function updateCardApi(id: string, patch: CardPatch): Promise<UiCard> {
  const fields: Record<string, string> = {};
  if (typeof patch.skill === "string") fields.skill = patch.skill.slice(0, 80);
  if (typeof patch.win === "string") fields.win = patch.win;
  if (typeof patch.type === "string") fields.type = patch.type;

  const { data, error } = await supabase.from("cards").update(fields).eq("id", id).select().single();
  if (error) throw new Error(`updateCard: ${error.message}`);
  return rowToUi(data);
}

export async function deleteCardApi(id: string): Promise<void> {
  const uid = await currentUserId();
  if (uid) {
    // Best-effort: drop the card's uploaded art (seed art lives under seed/ and is shared).
    await supabase.storage.from("card-art").remove([`${uid}/${id}.jpg`]).catch(() => {});
  }
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw new Error(`deleteCard: ${error.message}`);
}

// --- card art (Supabase Storage) --------------------------------------------

// Upload a card's art (a JPEG data URL) to the user's folder and save the public
// URL on the row. Returns the URL (cache-busted so a replaced image reloads).
export async function uploadCardImage(id: string, dataUrl: string): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("not signed in");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${uid}/${id}.jpg`;
  const { error } = await supabase.storage
    .from("card-art")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(`uploadCardImage: ${error.message}`);
  const url = `${cardArtPublicUrl(path)}?v=${new Date().getTime()}`;
  await supabase.from("cards").update({ image_url: url }).eq("id", id);
  return url;
}

// --- per-user seeding -------------------------------------------------------

// On first sign-in, give the user the demo binder so Balance/Share have history.
// Seed art is shared, served from card-art/seed/*.jpg (uploaded once by the
// service-role script). No-op if the user already has cards.
export async function seedSampleCardsIfEmpty(): Promise<boolean> {
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`seed check: ${error.message}`);
  if ((count ?? 0) > 0) return false;

  const uid = await currentUserId();
  if (!uid) return false;

  // No explicit id — the DB generates a unique one per row, so seeding works for
  // every user (the fixed c1..c14 ids would collide on the second account). The
  // seed art is still addressed by the sample's key (seed/c1.jpg …).
  const rows = (sampleCards as Array<{ id: string; timestamp: string; type: string; win: string; skill: string }>).map(
    (c) => ({
      user_id: uid,
      timestamp: c.timestamp,
      type: c.type,
      win: c.win,
      skill: c.skill,
      image_url: cardArtPublicUrl(`seed/${c.id}.jpg`),
    })
  );
  const { error: insErr } = await supabase.from("cards").insert(rows);
  if (insErr) throw new Error(`seed insert: ${insErr.message}`);
  return true;
}

// --- suggestions ("what to try next") ---------------------------------------

export interface Suggestion {
  tag: string;
  text: string;
}

export interface BalanceSlice {
  type: string;
  count: number;
  pct: number;
}

export async function getSuggestions(input: {
  period: string;
  balance: BalanceSlice[];
  recentWins: string[];
}): Promise<Suggestion[]> {
  const r = await fetch(`${AI_BASE}/api/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`getSuggestions ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.suggestions) ? j.suggestions : [];
}

// --- quest coach ------------------------------------------------------------

// A short encouragement to complete the next card in the user's quest.
export async function getCoach(quest: {
  skill: string;
  aim?: string;
  type?: string;
  deadline?: string;
}): Promise<string> {
  const r = await fetch(`${AI_BASE}/api/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quest }),
  });
  if (!r.ok) throw new Error(`getCoach ${r.status}`);
  const j = await r.json();
  return (j?.encouragement || "").toString();
}

// --- memory reflections -----------------------------------------------------

export interface Reflection {
  tag: string;
  line: string;
  refs: string[]; // ids of the cards this reflection is about
}

// The binder reflects on the user's whole history (the "it remembers you"
// surface). Sends every card to the AI server and returns a few growth lines.
export async function getReflections(): Promise<Reflection[]> {
  const cards = (await getCards())
    .slice()
    .reverse() // oldest first, so the AI reads the arc chronologically
    .map((c) => ({ id: c.id, date: c.date, type: TYPE_LABEL[c.type] || c.type, skill: c.skill, win: c.win }));

  const r = await fetch(`${AI_BASE}/api/reflect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cards }),
  });
  if (!r.ok) throw new Error(`getReflections ${r.status}`);
  const j = await r.json();
  return Array.isArray(j?.reflections) ? j.reflections : [];
}

// --- quests -----------------------------------------------------------------

// The shape the Quest Journey UI works with (a row of public.quests, mapped to
// the field names the component already uses).
export interface ApiQuest {
  id: string;
  type: string;
  skill: string;
  aim: string;
  date: string;
  deadline: string;
  status: string;
  completedDate?: string;
  win?: string;
}

interface QuestRow {
  id: string;
  type: string;
  skill: string;
  aim: string | null;
  quest_date: string | null;
  deadline: string | null;
  status: string;
  completed_date: string | null;
  win: string | null;
}

function questRowToApi(r: QuestRow): ApiQuest {
  return {
    id: r.id,
    type: r.type,
    skill: r.skill,
    aim: r.aim || "",
    date: r.quest_date || "",
    deadline: r.deadline || "",
    status: r.status || "not_started",
    completedDate: r.completed_date || undefined,
    win: r.win || undefined,
  };
}

// Columns for an insert/update (only defined keys are sent).
function questToRow(q: Partial<ApiQuest>): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  if (q.id !== undefined) row.id = q.id;
  if (q.type !== undefined) row.type = q.type;
  if (q.skill !== undefined) row.skill = q.skill;
  if (q.aim !== undefined) row.aim = q.aim;
  if (q.date !== undefined) row.quest_date = q.date;
  if (q.deadline !== undefined) row.deadline = q.deadline;
  if (q.status !== undefined) row.status = q.status;
  if (q.completedDate !== undefined) row.completed_date = q.completedDate ?? null;
  if (q.win !== undefined) row.win = q.win ?? null;
  return row;
}

export async function getQuests(): Promise<ApiQuest[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .order("quest_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getQuests: ${error.message}`);
  return (data ?? []).map(questRowToApi);
}

// Seed the journey on first run (no-op if the user already has quests).
export async function seedQuestsIfEmpty(seed: ApiQuest[]): Promise<ApiQuest[] | null> {
  const { count, error } = await supabase.from("quests").select("id", { count: "exact", head: true });
  if (error) throw new Error(`quest seed check: ${error.message}`);
  if ((count ?? 0) > 0) return null;

  const uid = await currentUserId();
  if (!uid) return null;

  // Drop the fixed q1..q6 ids (global PKs would collide for a second user) and
  // let the DB generate them.
  const rows = seed.map((q) => {
    const row: Record<string, string | null> = { ...questToRow(q), user_id: uid };
    delete row.id;
    return row;
  });
  const { error: insErr } = await supabase.from("quests").insert(rows);
  if (insErr) throw new Error(`quest seed insert: ${insErr.message}`);
  return getQuests();
}

export async function createQuest(q: ApiQuest): Promise<ApiQuest> {
  const { data, error } = await supabase.from("quests").insert(questToRow(q)).select().single();
  if (error) throw new Error(`createQuest: ${error.message}`);
  return questRowToApi(data);
}

export async function updateQuest(id: string, patch: Partial<ApiQuest>): Promise<ApiQuest> {
  const { data, error } = await supabase.from("quests").update(questToRow(patch)).eq("id", id).select().single();
  if (error) throw new Error(`updateQuest: ${error.message}`);
  return questRowToApi(data);
}

export async function deleteQuest(id: string): Promise<void> {
  const { error } = await supabase.from("quests").delete().eq("id", id);
  if (error) throw new Error(`deleteQuest: ${error.message}`);
}

// --- profile ----------------------------------------------------------------

export interface Profile {
  displayName: string;
  avatarUrl?: string;
}

// The signed-in user's profile (from the `profiles` table, created on signup),
// falling back to the Google identity metadata if the row isn't ready yet.
export async function getProfile(): Promise<Profile | null> {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata || {};
  return {
    displayName: data?.display_name || meta.full_name || meta.name || user.email || "You",
    avatarUrl: data?.avatar_url || meta.avatar_url || undefined,
  };
}
