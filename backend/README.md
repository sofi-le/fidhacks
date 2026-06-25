# Backend — Proof-of-Skill Ledger (Sofi's lane)

Express + SQLite memory store + the AI brain (Anthropic Claude). The frontend
never sees the Claude key — all AI calls happen here.

## Run it

```bash
cd backend
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY (or leave MOCK_MODE=1 to skip AI)
npm run seed                # load the sample binder into memory.db (optional)
npm run dev                 # http://localhost:8787
```

Get a key at https://console.anthropic.com/settings/keys (starts with `sk-ant-`).
If the venue wifi blocks the API — or you have no key yet — set `MOCK_MODE=1` in
`.env` (or just leave the key blank) and the loop still mints cards from a
deterministic mock so the demo survives. Extraction and recap both use Claude's
native structured outputs (`output_format: json_schema`, beta header
`structured-outputs-2025-11-13`), so the model output is shaped by the API.

## The memory model (the moat — plan §6)

- **`cards`** = episodic memory: every micro-win, timestamped.
- **`skills_seen`** = semantic memory: `(skill, first_date, count)`.

`saveCard` writes both in one transaction ([`src/db.js`](src/db.js)), so episodic
and semantic memory never drift apart. On every `/api/extract`, the recent cards
plus `skills_seen` are injected into the prompt as the user's memory — that's how
the model reuses a stable skill tag instead of inventing a new one each time, and
how the card text can echo a past win.

## API (frozen contract — `../shared/types.ts`)

| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| POST   | `/api/extract`    | `{ transcript }`           | `Card` |
| GET    | `/api/cards`      | —                          | `Card[]` (newest first) |
| DELETE | `/api/cards/:id`  | —                          | `{ ok: true }` (404 if unknown) |
| GET    | `/api/skills`     | —                          | `SkillSeen[]` |
| GET    | `/api/balance`    | `?period=week\|month\|all` | `BalanceSlice[]` |
| GET    | `/api/recap`      | `?period=week\|month\|all` | `{ headline, body }` |
| POST   | `/api/reset`      | —                          | `{ ok: true }` |
| GET    | `/health`         | —                          | `{ ok, mock, model }` |

### Quick test

```bash
curl localhost:8787/health
curl -X POST localhost:8787/api/extract -H 'content-type: application/json' \
  -d '{"transcript":"I finally got the recursive SQL query working after two hours stuck on it"}'
curl localhost:8787/api/cards
curl 'localhost:8787/api/balance?period=all'
curl 'localhost:8787/api/recap?period=week'
```

## Files

- `src/db.js` — SQLite store + memory functions (`saveCard`, `getRecentCards`, `getCardsInPeriod`, `getAllCards`, `getSkillsSeen`, `getBalance`, `deleteCard`, `resetDemo`).
- `src/extract.js` — Claude call (structured outputs) + JSON sanitize + deterministic mock fallback. Drafts `{ type, win, overcame, skill }`.
- `src/recap.js` — Claude-written "note to self" weekly reflection over the period's cards + balance, with a mock fallback.
- `src/server.js` — Express routes.
- `src/seed.js` — load `../shared/sampleCards.json` into the DB.
