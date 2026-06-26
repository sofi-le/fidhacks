// ============================================================================
// AI server — the ONLY backend left. Data (cards, images, profiles) now lives
// in Supabase and the browser talks to it directly; this server exists solely
// to keep the Anthropic key private. It is stateless: it reads no database.
//
//   POST /api/extract  { transcript, recentCards, skillsSeen } -> { type, win, skill }
//   POST /api/recap    { period, total, balance, recentWins }  -> { headline, body }
//   GET  /health                                               -> { ok, mock }
// ============================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";

import { draftCard, useMock } from "./extract.js";
import { generateRecap } from "./recap.js";
import { generateReflections } from "./reflect.js";
import { generateSuggestions } from "./suggest.js";

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

// Weekly/monthly "note to self" reflection. The browser computes the balance +
// recent wins from Supabase and posts them; we just write the prose.
app.post("/api/recap", async (req, res) => {
  try {
    const b = req.body || {};
    const period = ["week", "month", "all"].includes(b.period) ? b.period : "week";
    const balance = Array.isArray(b.balance) ? b.balance : [];
    const total = typeof b.total === "number" ? b.total : balance.reduce((s, x) => s + (x.count || 0), 0);
    const recentWins = Array.isArray(b.recentWins) ? b.recentWins : [];

    const recap = await generateRecap({ period, total, balance, recentWins });
    res.json(recap);
  } catch (err) {
    console.error("[/api/recap]", err);
    res.status(500).json({ error: "failed to generate recap" });
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
