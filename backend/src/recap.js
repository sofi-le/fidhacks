// ============================================================================
// Weekly recap — the "note to self" reflection (build plan: AI recommendations).
// Reads the period's cards + type balance and writes a short, honest reflection:
// how many wins, which domain led, which was lightest, one gentle nudge.
// Reflection, not coaching. No "how it felt" — type-only.
// Never throws: falls back to a deterministic recap so the demo always renders.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You write a short "note to self" reflecting on someone's week of logged wins
for a "Proof-of-Skill Ledger". You're a supportive friend looking at where their energy went.

You receive the week's win count, the per-type breakdown (counts + percentages), and a few
recent wins for flavor. Write 2-3 sentences:
- Name how many wins they logged and which domain led.
- Reflect the shape honestly — a mirror, not a scoreboard. Never say they're "failing" or
  "losing" at anything.
- End with ONE gentle, optional nudge toward their lightest domain, phrased as a suggestion
  not an assignment ("maybe trade one screen-night for that?").

Only discuss the life DOMAINS (the types). Do NOT mention emotions or how anything felt.
No emojis. No exclamation spam. Warm, plain, a little wry.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    body: { type: "string" },
  },
  required: ["headline", "body"],
};

/**
 * Generate the weekly recap.
 * @param {object} input  { total, balance: BalanceSlice[], recentWins: string[] }
 * @returns {Promise<{ headline: string, body: string }>}
 */
export async function generateRecap({ period = "week", total, balance, recentWins = [] }) {
  if (useMock()) return mockRecap({ period, total, balance });

  const present = balance.filter((b) => b.count > 0);
  const lead = [...present].sort((a, b) => b.count - a.count)[0];
  const lightest = [...balance].sort((a, b) => a.count - b.count)[0];

  const stats = balance.map((b) => `${b.type}: ${b.count} (${b.pct}%)`).join(", ");
  const wins = recentWins.slice(0, 6).map((w) => `- ${w}`).join("\n");

  const userMsg =
    `Period: ${periodLabel(period)}.\n` +
    `${total} wins.\n` +
    `Breakdown: ${stats}.\n` +
    `Led by: ${lead?.type ?? "nothing yet"}. Lightest: ${lightest?.type}.\n\n` +
    `Recent wins:\n${wins || "(none)"}\n\nWrite the note to self.`;

  try {
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 400,
        temperature: 0.8,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        output_format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );
    const textBlock = res.content.find((b) => b.type === "text");
    const parsed = safeParse(textBlock?.text);
    return parsed?.body ? sanitize(parsed) : mockRecap({ period, total, balance });
  } catch (err) {
    console.error("[recap] Claude call failed, falling back to mock:", err.message);
    return mockRecap({ period, total, balance });
  }
}

// --- robustness (same parser shape as extract.js) ---------------------------

function safeParse(raw) {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function sanitize(d) {
  const clean = (s, fb) =>
    (typeof s === "string" && s.trim() ? s.trim() : fb).replace(/\s+/g, " ").slice(0, 400);
  return {
    headline: clean(d?.headline, "note to self"),
    body: clean(d?.body, "You logged some wins this week. Keep going."),
  };
}

// --- mock (no network) ------------------------------------------------------

function mockRecap({ period = "week", total, balance }) {
  const when = periodLabel(period);
  const present = balance.filter((b) => b.count > 0);
  if (!total || present.length === 0) {
    return { headline: "note to self", body: `No wins logged ${when} yet. Catch one and the page fills in.` };
  }
  const lead = [...present].sort((a, b) => b.count - a.count)[0];
  const lightest = [...balance].sort((a, b) => a.count - b.count)[0];
  const nudge =
    lightest && lightest.type !== lead.type
      ? ` Lightest on ${lightest.type} — maybe trade one for that next week?`
      : "";
  return {
    headline: "note to self",
    body: `You logged ${total} ${total === 1 ? "win" : "wins"} ${when}. ${lead.type} took the lead at ${lead.pct}%.${nudge}`,
  };
}

function periodLabel(period) {
  return period === "month" ? "this month" : period === "all" ? "so far" : "this week";
}

export { useMock as recapUseMock };