// ============================================================================
// Express server — the API the 4 teammates build on (build plan §8).
//
//   POST /api/extract   { transcript }          -> Card   (the loop)
//   GET  /api/cards                              -> Card[] (the binder)
//   GET  /api/skills                             -> SkillSeen[]
//   GET  /api/balance?period=week|month|all      -> BalanceSlice[]
//   POST /api/reset                              -> { ok }
//   GET  /health                                 -> { ok, mock }
// ============================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import {
  saveCard,
  getRecentCards,
  getAllCards,
  getSkillsSeen,
  getBalance,
  resetDemo,
} from "./db.js";
import { draftCard, useMock } from "./extract.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, mock: useMock(), model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5" });
});

// The loop: transcript + memory -> AI draft -> deterministic rarity/callback -> save -> Card
app.post("/api/extract", async (req, res) => {
  try {
    const transcript = (req.body?.transcript || "").toString().trim();
    if (!transcript) return res.status(400).json({ error: "transcript is required" });

    // pull memory
    const recentCards = getRecentCards(12);
    const skillsSeen = getSkillsSeen();

    // AI drafts the card fields
    const draft = await draftCard(transcript, { recentCards, skillsSeen });

    // assemble the Card and persist (episodic + semantic, atomic)
    const card = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: draft.type,
      win: draft.win,
      overcame: draft.overcame,
      skill: draft.skill,
    };
    saveCard(card);

    res.json(card);
  } catch (err) {
    console.error("[/api/extract]", err);
    res.status(500).json({ error: "failed to mint card" });
  }
});

app.get("/api/cards", (_req, res) => res.json(getAllCards()));

app.get("/api/skills", (_req, res) => res.json(getSkillsSeen()));

app.get("/api/balance", (req, res) => {
  const period = ["week", "month", "all"].includes(req.query.period) ? req.query.period : "all";
  res.json(getBalance(period));
});

app.post("/api/reset", (_req, res) => {
  resetDemo();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Proof-of-Skill Ledger backend on http://localhost:${PORT}`);
  console.log(`  mode: ${useMock() ? "MOCK (no AI)" : "LIVE (Claude)"}`);
});
