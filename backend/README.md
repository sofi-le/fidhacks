# Backend — Proof-of-Skill Ledger (Sofi's lane)

Express + SQLite memory store + the AI extraction brain (Google Gemini). The
frontend never sees the Gemini key — all AI calls happen here.

## Run it

```bash
cd backend
npm install
cp .env.example .env        # add GEMINI_API_KEY (or leave MOCK_MODE=1 to skip AI)
npm run seed                # load the sample binder into memory.db (optional)
npm run dev                 # http://localhost:8787
```

Get a Gemini key at https://aistudio.google.com/apikey. If the venue wifi blocks
Gemini, set `MOCK_MODE=1` in `.env` — the loop still mints cards from a
deterministic mock so the demo survives. Extraction uses Gemini's native JSON
schema mode (`responseSchema`), so the model output is structured by the API.

## The memory model (the moat — plan §6)

- **`cards`** = episodic memory: every micro-win, timestamped.
- **`skills_seen`** = semantic memory: `(skill, first_date, count)`. Powers rarity.

`saveCard` writes both in one transaction, so episodic and semantic memory never
drift apart. Rarity is decided in [`src/rarity.js`](src/rarity.js) **deterministically
against memory** (a never-seen skill bumps rarity; a long struggle leans Epic/Legendary;
a win echoing a past struggle emits a `callback` line referencing the past self).

## API (frozen contract — `../shared/types.ts`)

| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| POST | `/api/extract` | `{ transcript }` | `Card` |
| GET  | `/api/cards` | — | `Card[]` (newest first) |
| GET  | `/api/skills` | — | `SkillSeen[]` |
| GET  | `/api/balance` | `?period=week\|month\|all` | `BalanceSlice[]` |
| POST | `/api/reset` | — | `{ ok: true }` |
| GET  | `/health` | — | `{ ok, mock, model }` |

### Quick test

```bash
curl localhost:8787/health
curl -X POST localhost:8787/api/extract -H 'content-type: application/json' \
  -d '{"transcript":"I finally got the recursive SQL query working after two hours stuck on it"}'
curl localhost:8787/api/cards
curl 'localhost:8787/api/balance?period=all'
```

## Files

- `src/db.js` — SQLite store + memory functions (`saveCard`, `getRecentCards`, `getSkillsSeen`, `getBalance`, `resetDemo`).
- `src/rarity.js` — deterministic rarity + callback judge.
- `src/extract.js` — Anthropic call + JSON sanitize + mock fallback.
- `src/server.js` — Express routes.
- `src/seed.js` — load `../shared/sampleCards.json` into the DB.
