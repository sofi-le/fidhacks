// ============================================================================
// The extraction brain (build plan §10.4) — powered by Google Gemini.
//
// transcript + memory (recent cards + skills_seen) -> strict JSON Card.
// The model writes the human-sounding fields (win/overcame/type/emotion/skill);
// rarity.js is the deterministic judge that finalizes rarity + callback.
//
// We use Gemini's native responseSchema (JSON mode) so the output is structured
// by the API, not by prompt-begging. MOCK_MODE=1 (or a missing key) skips the
// network entirely and mints a deterministic card, so blocked venue wifi can't
// kill the demo.
// ============================================================================

import { GoogleGenAI, Type } from "@google/genai";

const TYPES = ["Academic", "Technical", "Financial", "Social", "Hobbies"];
const EMOTIONS = ["stuck", "breakthrough", "steady", "proud", "anxious"];
const RARITIES = ["Common", "Rare", "Epic", "Legendary"];

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.GEMINI_API_KEY;

let client = null;
function gemini() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  TEAMMATE INJECTION SEAM — the card-field / voice-bucketing prompt.        ║
// ║  Replace SYSTEM and RESPONSE_SCHEMA below with your engineered versions.   ║
// ║  CONTRACT (do not change): draftCard() must return an object with exactly  ║
// ║  { type, win, overcame, skill, emotion, rarity, callback } — sanitize()    ║
// ║  clamps them to the frozen enums. My memory store + rarity judge consume   ║
// ║  that object and finalize rarity/callback; leave that wiring alone.        ║
// ║  This prompt is a working PLACEHOLDER so the demo runs today.              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const SYSTEM = `You turn a spoken micro-win into one trading card for a "Proof-of-Skill Ledger".
You receive a transcript of someone describing something they just did, plus their memory
(recent cards and skills they've logged before). Fill every field of the card.

Field guidance:
- type:     the domain of the win.
- win:      ONE line, first person, human, specific. What they accomplished.
- overcame: ONE line. The honest struggle behind it. Not corny, no LinkedIn voice.
- skill:    1-3 words. The reusable skill this proves. REUSE the exact wording of a prior
            skill from memory if it's the same skill, so the skill tag stays stable.
- emotion:  how it FELT, not how hard it was. A Technical win can feel "anxious".
- rarity:   your first guess; the server may adjust it against memory.
- callback: if this win echoes a past struggle in their memory, ONE line referencing their
            past self ("3 weeks ago this would've stopped you"); otherwise null.

Write like a supportive friend. No emojis. No exclamation spam.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: TYPES },
    win: { type: Type.STRING },
    overcame: { type: Type.STRING },
    skill: { type: Type.STRING },
    emotion: { type: Type.STRING, enum: EMOTIONS },
    rarity: { type: Type.STRING, enum: RARITIES },
    callback: { type: Type.STRING, nullable: true },
  },
  required: ["type", "win", "overcame", "skill", "emotion", "rarity"],
  propertyOrdering: ["type", "win", "overcame", "skill", "emotion", "rarity", "callback"],
};

/**
 * Ask Gemini to draft a card from the transcript + memory.
 * Returns a partial card: { type, win, overcame, skill, emotion, rarity, callback }.
 * Never throws — falls back to a mock so the endpoint always returns something.
 */
export async function draftCard(transcript, { recentCards = [], skillsSeen = [] } = {}) {
  if (useMock()) return mockDraft(transcript);

  try {
    const memory = buildMemoryBlock(recentCards, skillsSeen);
    const res = await gemini().models.generateContent({
      model: MODEL,
      contents: `MEMORY:\n${memory}\n\nTRANSCRIPT:\n"""${transcript}"""\n\nReturn the card.`,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 800,
        temperature: 0.7,
        // gemini-2.5-flash is a thinking model; left on, reasoning tokens can eat the
        // whole budget and return empty text. This extraction is simple — turn it off
        // for speed + reliable JSON. (Bump the budget instead if you want richer cards.)
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const parsed = safeParse(res.text);
    if (!parsed) {
      console.warn("[extract] empty/unparseable Gemini response, using mock. finish=" +
        res.candidates?.[0]?.finishReason);
      return mockDraft(transcript);
    }
    return sanitize(parsed);
  } catch (err) {
    console.error("[extract] Gemini call failed, falling back to mock:", err.message);
    return mockDraft(transcript);
  }
}

// --- memory injection -------------------------------------------------------

function buildMemoryBlock(recentCards, skillsSeen) {
  const skills = skillsSeen.length
    ? skillsSeen.map((s) => `- ${s.skill} (seen ${s.count}x, since ${s.first_date.slice(0, 10)})`).join("\n")
    : "(no skills logged yet — everything is a first)";
  const recent = recentCards.length
    ? recentCards
        .slice(0, 8)
        .map((c) => `- [${c.timestamp.slice(0, 10)}] ${c.type}/${c.skill} (${c.emotion}, ${c.rarity}): ${c.win}`)
        .join("\n")
    : "(no cards yet)";
  return `Skills seen before:\n${skills}\n\nRecent cards:\n${recent}`;
}

// --- robustness -------------------------------------------------------------

function safeParse(raw) {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Force every field into the contract's allowed range. */
function sanitize(d) {
  const oneLine = (s, fallback) =>
    (typeof s === "string" && s.trim() ? s.trim() : fallback).replace(/\s+/g, " ").slice(0, 240);
  // models sometimes emit the literal word "null"/"none" instead of real null
  const NULLISH = new Set(["null", "none", "n/a", "na", "undefined", ""]);
  const cb = typeof d?.callback === "string" ? d.callback.trim() : "";
  return {
    type: TYPES.includes(d?.type) ? d.type : "Technical",
    win: oneLine(d?.win, "Logged a win."),
    overcame: oneLine(d?.overcame, "Pushed through something tricky."),
    skill: oneLine(d?.skill, "General"),
    emotion: EMOTIONS.includes(d?.emotion) ? d.emotion : "steady",
    rarity: RARITIES.includes(d?.rarity) ? d.rarity : "Common",
    callback: cb && !NULLISH.has(cb.toLowerCase()) ? cb : null,
  };
}

// --- mock (no network) ------------------------------------------------------

function mockDraft(transcript) {
  const t = (transcript || "").toLowerCase();
  const type =
    /code|bug|api|server|deploy|function|database|react/.test(t) ? "Technical" :
    /class|exam|study|proof|math|algebra|read|lecture|homework/.test(t) ? "Academic" :
    /budget|money|invest|save|spend|stock/.test(t) ? "Financial" :
    /pitch|team|talk|present|met|friend|call/.test(t) ? "Social" :
    /draw|paint|guitar|run|cook|game|sketch/.test(t) ? "Hobbies" : "Technical";
  const emotion =
    /finally|clicked|got it|breakthrough/.test(t) ? "breakthrough" :
    /stuck|couldn'?t|failing|frustrat/.test(t) ? "stuck" :
    /nervous|scared|anxious|afraid/.test(t) ? "anxious" :
    /proud|nailed|happy/.test(t) ? "proud" : "steady";
  const firstSentence = (transcript || "Logged a win.").split(/[.!?\n]/)[0].trim().slice(0, 160);
  return sanitize({
    type,
    win: firstSentence || "Logged a win.",
    overcame: "Worked through it step by step.",
    skill: type === "Technical" ? "Debugging" : "General",
    emotion,
    rarity: "Common",
    callback: null,
  });
}

export { TYPES, EMOTIONS, useMock };
