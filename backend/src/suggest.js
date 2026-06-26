// ============================================================================
// Suggestions — short, actionable "what to try next" nudges for the Stats page.
// Replaces the old paragraph "note to self": given where the user's energy went
// (per-domain balance) plus recent wins, return a few one-line suggestions, each
// with a tiny tag. Reflection that points forward, not a wall of text.
//
// Never throws — falls back to deterministic suggestions so the panel always
// has something useful.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const TYPES = ["Academic", "Career", "Hobbies", "Social & Family", "Financial", "Health & Wellness"];

const SYSTEM = `You coach someone on what to focus on next, based on where their energy went across
six life domains and their recent wins. Return 3-4 short suggestions.

Each suggestion:
- ONE line, max ~16 words, concrete and doable this week
- warm and encouraging — a nudge, never a lecture or a guilt-trip
- has a 2-3 word "tag" naming it

Read the balance honestly: celebrate a domain with real momentum, and gently point toward a
light or empty domain with a small, specific first step. Vary the suggestions — not all about
the same domain. No emojis.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { tag: { type: "string" }, text: { type: "string" } },
        required: ["tag", "text"],
      },
    },
  },
  required: ["suggestions"],
};

/**
 * @param {object} input { period, balance: {type,count,pct}[], recentWins: string[] }
 * @returns {Promise<{tag:string,text:string}[]>}
 */
export async function generateSuggestions({ period = "all", balance = [], recentWins = [] } = {}) {
  if (useMock()) return mockSuggestions(balance);

  const stats = balance.map((b) => `${b.type}: ${b.count} (${b.pct}%)`).join(", ");
  const wins = recentWins.slice(0, 6).map((w) => `- ${w}`).join("\n");
  const userMsg =
    `Period: ${period}.\n` +
    `Balance: ${stats || "(nothing yet)"}.\n\n` +
    `Recent wins:\n${wins || "(none)"}\n\nWrite the suggestions.`;

  try {
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 500,
        temperature: 0.85,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );
    const textBlock = res.content.find((b) => b.type === "text");
    const parsed = safeParse(textBlock?.text);
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : null;
    if (!list || !list.length) return mockSuggestions(balance);
    return list
      .map((s) => ({ tag: clean(s?.tag, "try this", 28), text: clean(s?.text, "", 160) }))
      .filter((s) => s.text)
      .slice(0, 4);
  } catch (err) {
    console.error("[suggest] Claude call failed, falling back to mock:", err.message);
    return mockSuggestions(balance);
  }
}

// --- robustness -------------------------------------------------------------

function safeParse(raw) {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

const clean = (s, fb, max) =>
  (typeof s === "string" && s.trim() ? s.trim() : fb).replace(/\s+/g, " ").slice(0, max);

// --- mock (no network) ------------------------------------------------------

function mockSuggestions(balance) {
  const present = balance.filter((b) => b.count > 0);
  const lead = [...present].sort((a, b) => b.count - a.count)[0];
  const lightest = [...balance].sort((a, b) => a.count - b.count)[0];
  const out = [];
  if (lead) out.push({ tag: "keep going", text: `${lead.type} has real momentum — log one more this week and make it a streak.` });
  if (lightest && (!lead || lightest.type !== lead.type)) out.push({ tag: "round it out", text: `Lightest on ${lightest.type} — pick one tiny first step there.` });
  out.push({ tag: "tiny win", text: `Catch one small win today, even a two-minute one — it all counts.` });
  return out.slice(0, 4);
}

export { useMock as suggestUseMock };
