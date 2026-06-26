// ============================================================================
// AI server — the ONLY backend left. Data (cards, images, profiles) now lives
// in Supabase and the browser talks to it directly; this server exists solely
// to keep the Anthropic key private. It is stateless: it reads no database.
//
//   POST /api/extract  { transcript, recentCards, skillsSeen } -> { type, win, skill, callback }
//   POST /api/suggest  { period, balance, recentWins }         -> { suggestions[] }
//   POST /api/reflect  { cards }                               -> { reflections[] }
//   POST /api/coach    { quest }                               -> { encouragement }
//   GET  /health                                               -> { ok, mock }
// ============================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";

import { draftCard, useMock } from "./extract.js";
import { generateReflections } from "./reflect.js";
import { generateSuggestions } from "./suggest.js";
import { generateCoach } from "./coach.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, mock: useMock(), model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5" });
});

// Draft a card from a transcript + the user's memory (which the browser pulls
// from Supabase and sends along). Returns ONLY the draft { type, win, skill } —
// the browser applies the user's title/type overrides and writes the card to
// Supabase itself. Never persists anything here.
app.post("/api/extract", async (req, res) => {
  try {
    const b = req.body || {};
    const transcript = (b.transcript || "").toString().trim();
    if (!transcript) return res.status(400).json({ error: "transcript is required" });

    const recentCards = Array.isArray(b.recentCards) ? b.recentCards : [];
    const skillsSeen = Array.isArray(b.skillsSeen) ? b.skillsSeen : [];
    const userSkill = typeof b.skill === "string" ? b.skill : "";

    const draft = await draftCard(transcript, { recentCards, skillsSeen, userSkill });
    res.json(draft);
  } catch (err) {
    console.error("[/api/extract]", err);
    res.status(500).json({ error: "failed to draft card" });
  }
});

// "What to try next" — short forward-looking suggestions for the Stats page.
app.post("/api/suggest", async (req, res) => {
  try {
    const b = req.body || {};
    const period = ["week", "month", "all"].includes(b.period) ? b.period : "all";
    const balance = Array.isArray(b.balance) ? b.balance : [];
    const recentWins = Array.isArray(b.recentWins) ? b.recentWins : [];
    const suggestions = await generateSuggestions({ period, balance, recentWins });
    res.json({ suggestions });
  } catch (err) {
    console.error("[/api/suggest]", err);
    res.status(500).json({ error: "failed to suggest" });
  }
});

// Quest coach — an encouraging nudge to finish the next card in the user's quest.
app.post("/api/coach", async (req, res) => {
  try {
    const quest = (req.body && req.body.quest) || null;
    const encouragement = await generateCoach({ quest });
    res.json({ encouragement });
  } catch (err) {
    console.error("[/api/coach]", err);
    res.status(500).json({ error: "failed to coach" });
  }
});

// Memory reflections — the binder reflects on the whole history. The browser
// sends the user's cards; we return a few "we remember you" lines.
app.post("/api/reflect", async (req, res) => {
  try {
    const b = req.body || {};
    const cards = Array.isArray(b.cards) ? b.cards : [];
    const reflections = await generateReflections({ cards });
    res.json({ reflections });
  } catch (err) {
    console.error("[/api/reflect]", err);
    res.status(500).json({ error: "failed to reflect" });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`JourneyDex AI server on http://localhost:${PORT}`);
  console.log(`  mode: ${useMock() ? "MOCK (no AI)" : "LIVE (Claude)"}`);
});
