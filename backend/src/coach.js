// ============================================================================
// Quest coach — a short, encouraging nudge to complete the next card in the
// user's current quest. Powers the coach panel on the Stats page.
// Never throws — falls back to a deterministic nudge.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const useMock = () => process.env.MOCK_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You are an encouraging personal development coach. You are always professional and concise.

You exist within JourneyDex, a personal productivity app that inspires growth across these
categories: Academic, Career, Hobbies, Social & Family, Financial, Health & Wellness.

You are given the next card (a goal the user set) that they need to complete in their current
quest. Write a short encouragement to help them complete it: 1-2 sentences, max ~30 words,
specific to this card, spoken directly to them ("you"). No emojis.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { encouragement: { type: "string" } },
  required: ["encouragement"],
};

/**
 * @param {object} input { quest: {skill, aim, type, deadline} }
 * @returns {Promise<string>}
 */
export async function generateCoach({ quest } = {}) {
  if (!quest || !quest.skill) return "";
  if (useMock()) return mockCoach(quest);

  const userMsg =
    `Next card to complete:\n` +
    `- Title: ${quest.skill}\n` +
    `- What "done" looks like: ${quest.aim || "(not specified)"}\n` +
    `- Category: ${quest.type || "(none)"}\n` +
    (quest.deadline ? `- Finish by: ${quest.deadline}\n` : "") +
    `\nWrite the encouragement.`;

  try {
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 200,
        temperature: 0.8,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );
    const textBlock = res.content.find((b) => b.type === "text");
    const parsed = safeParse(textBlock?.text);
    const enc = clean(parsed?.encouragement, "", 220);
    return enc || mockCoach(quest);
  } catch (err) {
    console.error("[coach] Claude call failed, falling back to mock:", err.message);
    return mockCoach(quest);
  }
}

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

function mockCoach(quest) {
  return `You're closer than you think on "${quest.skill}". Take one small step toward it today and let the momentum carry you.`;
}

export { useMock as coachUseMock };
