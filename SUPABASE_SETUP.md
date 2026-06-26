# Supabase setup (one-time)

JourneyDex now stores cards, card images, and profiles in **Supabase**, with
**email + password sign-in** (one pre-created user for now). The browser talks to
Supabase directly (Row-Level Security keeps each user's data private). The only
server left is the small AI service in `backend/` that drafts card text — it
holds the Anthropic key and nothing else.

Do these steps once, then `npm run dev`.

## 1. Create a project

1. Go to <https://supabase.com> → **New project**. Pick a name + DB password.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcd.supabase.co`)
   - **anon public** key
   - **service_role** key (secret — never goes in the browser)

## 2. Create the tables, policies, and storage bucket

In the dashboard: **SQL Editor → New query**, paste the contents of each file in
[`supabase/migrations/`](supabase/migrations/) **in order** and **Run** them:

- `0001_init.sql` — `profiles` + `cards` tables, RLS, signup trigger, `card-art` bucket.
- `0002_quests.sql` — the `quests` table (Quest Journey goals) + RLS.
- `0003_card_callback.sql` — adds the `callback` column (AI growth callback on cards).

## 3. Frontend env

```bash
cp .env.local.example .env.local
```

Paste your **Project URL** and **anon public** key into `.env.local`.

## 4. AI server env

```bash
cp backend/.env.example backend/.env
```

- `ANTHROPIC_API_KEY` — for live AI card text (leave `MOCK_MODE=1` to skip AI).
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — used by the two one-time scripts
  below (create the user + upload seed art). The service_role key is secret.

## 5. Create the user + upload the seed art

```bash
cd backend
npm run create:user   # creates sofi@journeydex.app / password "password"
npm run seed:images   # uploads the 14 demo card images to Storage
```

To use a different login: `SEED_USER_EMAIL=... SEED_USER_PASSWORD=... SEED_USER_NAME=... npm run create:user`.

## 6. Run

```bash
npm run dev
```

Open <http://localhost:3939>. The login form is pre-filled for Sofi — just click
**Sign in**. On first sign-in you'll get the 14 demo cards seeded into the
account; add your own from there.

---

### How it fits together

```
Browser ──(email + password)──► Supabase Auth
   │
   ├─ cards CRUD + card-art uploads ──► Supabase (Postgres + Storage, RLS per user)
   │
   └─ POST /api/extract, /api/recap ──► backend/ AI server ──► Anthropic
```

- **Cards** → `public.cards` (one row per win, `user_id` scoped by RLS).
- **Pics** → `card-art` Storage bucket: shared seed art under `seed/`, each user's
  uploads under `{user_id}/`. The public URL is saved on the card's `image_url`.
- **Profile** → `public.profiles`, auto-created on signup from the signup
  metadata (name), shown in the header and the Share panel.
