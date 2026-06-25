// ============================================================================
// SQLite memory store — the core of the project (build plan §6).
//
//   cards        = EPISODIC memory  (every micro-win, timestamped)
//   skills_seen  = SEMANTIC memory  (skill, first_date, count) -> powers RARITY
//
// Single local file, no cloud, no accounts. Synchronous better-sqlite3 keeps
// the code dead simple for a hackathon.
// ============================================================================

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "memory.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // safer concurrent reads during the demo

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id        TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    type      TEXT NOT NULL,
    win       TEXT NOT NULL,
    overcame  TEXT NOT NULL,
    skill     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills_seen (
    skill      TEXT PRIMARY KEY,
    first_date TEXT NOT NULL,
    count      INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_cards_timestamp ON cards(timestamp);
`);

// --- prepared statements ----------------------------------------------------

const insertCard = db.prepare(`
  INSERT INTO cards (id, timestamp, type, win, overcame, skill)
  VALUES (@id, @timestamp, @type, @win, @overcame, @skill)
`);

const upsertSkill = db.prepare(`
  INSERT INTO skills_seen (skill, first_date, count)
  VALUES (@skill, @timestamp, 1)
  ON CONFLICT(skill) DO UPDATE SET count = count + 1
`);

const selectRecentCards = db.prepare(`
  SELECT * FROM cards ORDER BY timestamp DESC LIMIT ?
`);

const selectAllCards = db.prepare(`
  SELECT * FROM cards ORDER BY timestamp DESC
`);

const selectAllSkills = db.prepare(`
  SELECT skill, first_date, count FROM skills_seen ORDER BY count DESC, first_date ASC
`);

const selectSkill = db.prepare(`
  SELECT skill, first_date, count FROM skills_seen WHERE skill = ?
`);

// --- public API -------------------------------------------------------------

/**
 * Look up what we already know about a skill BEFORE minting a card.
 * Returns the SkillSeen row, or null if this skill is brand new.
 * The rarity logic uses this to decide "is this a first?".
 */
export function getSkillMemory(skill) {
  return selectSkill.get(skill) ?? null;
}

/**
 * Insert a card AND bump its skill in semantic memory, atomically.
 * If either write fails, neither lands — episodic and semantic memory
 * never drift apart. (build plan §10.3)
 */
export const saveCard = db.transaction((card) => {
  insertCard.run(card);
  upsertSkill.run({ skill: card.skill, timestamp: card.timestamp });
  return card;
});

/** Most recent N cards — fed into the AI prompt as episodic memory. */
export function getRecentCards(limit = 12) {
  return selectRecentCards.all(limit);
}

/** Full binder, newest first. */
export function getAllCards() {
  return selectAllCards.all();
}

/** Semantic memory: every distinct skill ever logged. */
export function getSkillsSeen() {
  return selectAllSkills.all();
}

/**
 * Life-balance view: counts + percentages per card type over a period.
 * period = "week" | "month" | "all". Always returns all 5 types (count 0 if none),
 * so the radar/stacked-bar never has missing axes.
 */
export function getBalance(period = "all") {
  const ALL_TYPES = ["Academic", "Technical", "Financial", "Social", "Hobbies"];
  const since = periodStartISO(period);

  const rows = since
    ? db.prepare(`SELECT type, COUNT(*) AS count FROM cards WHERE timestamp >= ? GROUP BY type`).all(since)
    : db.prepare(`SELECT type, COUNT(*) AS count FROM cards GROUP BY type`).all();

  const counts = Object.fromEntries(ALL_TYPES.map((t) => [t, 0]));
  for (const r of rows) if (r.type in counts) counts[r.type] = r.count;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return ALL_TYPES.map((type) => ({
    type,
    count: counts[type],
    pct: total ? Math.round((counts[type] / total) * 100) : 0,
  }));
}

/** Wipe everything for a clean demo do-over. */
export const resetDemo = db.transaction(() => {
  db.prepare("DELETE FROM cards").run();
  db.prepare("DELETE FROM skills_seen").run();
});

// --- helpers ----------------------------------------------------------------

function periodStartISO(period) {
  if (period === "all" || !period) return null;
  const now = new Date();
  const d = new Date(now);
  if (period === "week") d.setDate(now.getDate() - 7);
  else if (period === "month") d.setMonth(now.getMonth() - 1);
  else return null;
  return d.toISOString();
}

export default db;
