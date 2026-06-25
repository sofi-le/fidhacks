// ============================================================================
// Rarity + day-to-day diff logic (build plan §6, §10.5).
//
// The AI proposes a card; THIS file is the judge. Rarity is decided
// deterministically against memory so the "moat" is real, not vibes:
//   - a skill never seen before  -> bump rarity up (it's a first)
//   - a long/painful struggle     -> lean Epic/Legendary
//   - a calm repeat of a routine  -> keep it Common/Rare
//   - a win that echoes a past struggle -> emit a `callback` to the past self
// ============================================================================

const RARITY_ORDER = ["Common", "Rare", "Epic", "Legendary"];

function bump(rarity, steps = 1) {
  const i = RARITY_ORDER.indexOf(rarity);
  const start = i === -1 ? 0 : i;
  return RARITY_ORDER[Math.min(start + steps, RARITY_ORDER.length - 1)];
}

function cap(rarity, max) {
  const i = Math.min(RARITY_ORDER.indexOf(rarity), RARITY_ORDER.indexOf(max));
  return RARITY_ORDER[Math.max(i, 0)];
}

// crude struggle detector over the raw transcript
const STRUGGLE_WORDS = [
  "hours", "all day", "finally", "stuck", "kept failing", "couldn't", "could not",
  "gave up", "almost quit", "frustrat", "broke", "broken", "debug", "error",
  "never", "first time", "scared", "nervous", "afraid", "anxious", "again and again",
];

/**
 * Decide the final rarity and (optionally) a callback line.
 *
 * @param {object} ai            the card the model proposed (type, win, skill, emotion, rarity, overcame)
 * @param {string} transcript    the raw user transcript (struggle signal)
 * @param {object|null} skillMem  getSkillMemory(skill) — null if never seen
 * @param {Array}  recentCards   recent cards for callback matching
 * @returns {{ rarity: string, callback: string|null, isFirst: boolean }}
 */
export function judge(ai, transcript, skillMem, recentCards = []) {
  let rarity = RARITY_ORDER.includes(ai?.rarity) ? ai.rarity : "Common";
  const text = (transcript || "").toLowerCase();

  const isFirst = !skillMem; // skill not in semantic memory yet
  const struggleHits = STRUGGLE_WORDS.filter((w) => text.includes(w)).length;
  const hardEmotion = ai?.emotion === "breakthrough" || ai?.emotion === "stuck";

  // 1) first time seeing this skill → it's a milestone, bump up
  if (isFirst) rarity = bump(rarity, 1);

  // 2) clear sign of a long/painful struggle finally resolved → lean Epic/Legendary
  if (struggleHits >= 3 || (struggleHits >= 2 && hardEmotion)) rarity = bump(rarity, 1);

  // 3) routine repeat, calm emotion, no struggle → don't oversell it
  const routineRepeat =
    !isFirst && skillMem?.count >= 2 && struggleHits === 0 &&
    (ai?.emotion === "steady" || ai?.emotion === "proud");
  if (routineRepeat) rarity = cap(rarity, "Rare");

  return { rarity, callback: makeCallback(ai, skillMem, recentCards), isFirst };
}

/**
 * Generate the past-self callback — the on-screen "no other team has this" beat.
 * Prefers the AI's own callback if it wrote one; otherwise synthesizes from memory:
 * find an earlier card with the SAME skill that felt like a struggle, and contrast it.
 */
function makeCallback(ai, skillMem, recentCards) {
  if (ai?.callback && String(ai.callback).trim()) return String(ai.callback).trim();
  if (!skillMem) return null; // brand-new skill has no past self to reference

  const past = recentCards.find(
    (c) =>
      c.skill === ai.skill &&
      (c.emotion === "stuck" || c.emotion === "anxious" || c.rarity === "Epic" || c.rarity === "Legendary")
  );
  if (!past) return null;

  const when = daysAgoPhrase(past.timestamp);
  return `${when} this same "${past.skill}" left you ${feltLike(past.emotion)}. Today it's a win.`;
}

function feltLike(emotion) {
  switch (emotion) {
    case "stuck": return "stuck";
    case "anxious": return "anxious";
    case "breakthrough": return "fighting for it";
    default: return "working hard";
  }
}

function daysAgoPhrase(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Earlier";
  const days = Math.round((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Earlier today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export { RARITY_ORDER };
