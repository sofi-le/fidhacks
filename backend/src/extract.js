// ============================================================================
// The extraction brain — powered by Claude.
//
// transcript + memory (recent cards + skills_seen) -> strict JSON Card.
// The model writes the human-sounding fields (type/win/overcame/skill).
//
// We use Claude's native structured outputs (JSON mode) so the output is shaped
// by the API, not by prompt-begging. MOCK_MODE=1 (or a missing key) skips the
// network entirely and mints a deterministic card, so blocked venue wifi can't
// kill the demo.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const TYPES = ["Academic", "Technical", "Financial", "Social", "Hobbies"];

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Card-field / voice-bucketing prompt.                                      ║
// ║  CONTRACT: draftCard() returns exactly { type, win, overcame, skill } —    ║
// ║  sanitize() clamps them. The memory store consumes that object.            ║
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

Write like a supportive friend. No emojis. No exclamation spam.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type:     { type: "string", enum: TYPES },
    win:      { type: "string" },
    overcame: { type: "string" },
    skill:    { type: "string" },
  },
  required: ["type", "win", "overcame", "skill"],
};

/**
 * Ask Claude to draft a card from the transcript + memory.
 * Returns a partial card: { type, win, overcame, skill }.
 * Never throws — falls back to a mock so the endpoint always returns something.
 */
export async function draftCard(transcript, { recentCards = [], skillsSeen = [] } = {}) {
  if (useMock()) return mockDraft(transcript);

  try {
    const memory = buildMemoryBlock(recentCards, skillsSeen);
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 800,
        temperature: 0.7,
        system: SYSTEM,
        messages: [
          { role: "user", content: `MEMORY:\n${memory}\n\nTRANSCRIPT:\n"""${transcript}"""\n\nReturn the card.` },
        ],
        // native structured outputs (beta) — guarantees the response matches RESPONSE_SCHEMA
        output_format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );

    const textBlock = res.content.find((b) => b.type === "text");
    const parsed = safeParse(textBlock?.text);
    if (!parsed) {
      console.warn("[extract] empty/unparseable Claude response, using mock. stop=" + res.stop_reason);
      return mockDraft(transcript);
    }
    return sanitize(parsed);
  } catch (err) {
    console.error("[extract] Claude call failed, falling back to mock:", err.message);
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
        .map((c) => `- [${c.timestamp.slice(0, 10)}] ${c.type}/${c.skill}: ${c.win}`)
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
  return {
    type: TYPES.includes(d?.type) ? d.type : "Technical",
    win: oneLine(d?.win, "Logged a win."),
    overcame: oneLine(d?.overcame, "Pushed through something tricky."),
    skill: oneLine(d?.skill, "General"),
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
  const firstSentence = (transcript || "Logged a win.").split(/[.!?\n]/)[0].trim().slice(0, 160);
  return sanitize({
    type,
    win: firstSentence || "Logged a win.",
    overcame: "Worked through it step by step.",
    skill: type === "Technical" ? "Debugging" : "General",
  });
}

export { TYPES, useMock };