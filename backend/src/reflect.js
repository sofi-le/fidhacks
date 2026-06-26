// ============================================================================
// Memory reflections — the "your binder remembers you" feature.
//
// Given the user's whole binder (every card), Claude finds the real throughlines
// and speaks them back: a skill they keep returning to, a domain they pour into
// or neglect, growth from a scrappy early win to a bigger one, momentum across
// weeks. This is the callback mechanic as a standalone surface, not tied to the
// moment a card is added.
//
// Never throws — falls back to deterministic reflections so the screen always
// has something to say.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You ARE the user's "binder of small wins", and you remember them. You receive their
logged wins — each with a date, a life domain (type), a short skill/title, and a one-line win.
Write a few short reflections that make them feel SEEN.

Each reflection:
- speaks directly to them ("you ...")
- is SPECIFIC: name the actual skills/wins, connect two real cards, note a streak, or a change
  over time (cite the rough timeframe like "since May" or "three weeks ago")
- is warm and a little proud, occasionally gently challenging — never generic, never a horoscope
- is ONE sentence. No emojis. No exclamation spam.

Look for the real throughlines: a skill they keep returning to, a domain they pour into (or one
they neglect), growth from an early scrappy win to a bigger one, momentum building across weeks,
or two cards that rhyme. Do NOT invent anything that isn't supported by the cards.

Each card is labelled with an id like {id:c7}. For every reflection: give a "tag" of 2-4 words
naming the pattern, and in "refs" list the id(s) of the 1-2 cards it is actually about.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tag: { type: "string" },
          line: { type: "string" },
          refs: { type: "array", items: { type: "string" } },
        },
        required: ["tag", "line", "refs"],
      },
    },
  },
  required: ["reflections"],
};

/**
 * Generate growth reflections over the whole binder.
 * @param {object} input { cards: {date,type,skill,win}[] }
 * @returns {Promise<{tag:string,line:string}[]>}
 */
export async function generateReflections({ cards = [] } = {}) {
  if (!cards.length) return [];
  if (useMock()) return mockReflections(cards);

  const memory = cards
    .map((c) => `- {id:${c.id}} [${(c.date || "").slice(0, 10)}] ${c.type}/${c.skill}: ${c.win}`)
    .join("\n");

  const userMsg =
    `Here is the binder (oldest first):\n${memory}\n\n` +
    `Write 4-6 reflections that make them feel remembered. Prioritise the strongest patterns.`;

  try {
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 700,
        temperature: 0.85,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );
    const textBlock = res.content.find((b) => b.type === "text");
    const parsed = safeParse(textBlock?.text);
    const list = Array.isArray(parsed?.reflections) ? parsed.reflections : null;
    if (!list || !list.length) return mockReflections(cards);
    return list
      .map((r) => ({
        tag: clean(r?.tag, "memory", 40),
        line: clean(r?.line, "", 240),
        refs: Array.isArray(r?.refs) ? r.refs.filter((x) => typeof x === "string").slice(0, 2) : [],
      }))
      .filter((r) => r.line)
      .slice(0, 6);
  } catch (err) {
    console.error("[reflect] Claude call failed, falling back to mock:", err.message);
    return mockReflections(cards);
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

function mockReflections(cards) {
  const out = [];
  const byType = {};
  const firstSkillCard = {};
  for (const c of cards) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    if (!firstSkillCard[c.skill]) firstSkillCard[c.skill] = c;
  }
  const total = cards.length;
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const sorted = [...cards].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const topCard = topType ? cards.find((c) => c.type === topType[0]) : null;

  if (total && last) out.push({ tag: "the tally", line: `You've logged ${total} ${total === 1 ? "win" : "wins"} so far — proof you kept showing up.`, refs: [last.id].filter(Boolean) });
  if (topType && topCard) out.push({ tag: `${topType[0]} leans`, line: `${topType[0]} is where most of your energy went (${topType[1]} ${topType[1] === 1 ? "win" : "wins"}) — that's not an accident.`, refs: [topCard.id].filter(Boolean) });
  if (first && last && first !== last) out.push({ tag: "the arc", line: `It started with "${first.skill}" and got to "${last.skill}" — you're not standing still.`, refs: [first.id, last.id].filter(Boolean) });

  const all = ["Academic", "Career", "Hobbies", "Social & Family", "Financial", "Health & Wellness"];
  const lightest = all.find((t) => !byType[t]);
  if (lightest) out.push({ tag: "the gap", line: `Nothing in ${lightest} yet — maybe the next small win lives there.`, refs: [] });

  return out.slice(0, 6);
}

export { useMock as reflectUseMock };
