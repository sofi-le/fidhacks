// ============================================================================
// FROZEN SHARED CONTRACT — all 5 of us depend on this. Do NOT rename fields.
// Add OPTIONAL fields only. (See build plan §7.)
// ============================================================================

export type CardType = "Academic" | "Technical" | "Financial" | "Social" | "Hobbies";

export interface Card {
  id: string;             // uuid
  timestamp: string;      // ISO 8601
  type: CardType;         // domain → base color + icon
  win: string;            // one-line accomplishment (AI-written, human-sounding)
  overcame: string;       // the struggle behind it (AI-written)
  skill: string;          // what it proves (tag) — also the semantic-memory key
}

// Semantic memory: one row per distinct skill ever seen.
export interface SkillSeen {
  skill: string;
  first_date: string;     // ISO — when this skill first appeared
  count: number;          // how many times it has been logged
}

// Shape returned by GET /api/balance
export interface BalanceSlice {
  type: CardType;
  count: number;
  pct: number;            // 0–100, rounded
}

// ----------------------------------------------------------------------------
// API surface (the backend exposes these — build plan §8)
//   POST /api/extract   body { transcript }            -> Card
//   GET  /api/cards                                     -> Card[]   (newest first)
//   GET  /api/skills                                    -> SkillSeen[]
//   GET  /api/balance?period=week|month|all             -> BalanceSlice[]
//   POST /api/reset                                     -> { ok: true }
//   GET  /health                                        -> { ok: true }
// ----------------------------------------------------------------------------