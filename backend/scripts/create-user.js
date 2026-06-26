// Create the single demo user (Sofi) via the Supabase Admin API. Confirms the
// email immediately, so no email step and it can sign in with the password.
// Run once after creating the project + running the SQL migration:
//
//   cd backend
//   npm run create:user
//
// Override the defaults with env vars if you like:
//   SEED_USER_EMAIL, SEED_USER_PASSWORD, SEED_USER_NAME
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (backend/.env). Secret — server only.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see backend/.env.example).");
  process.exit(1);
}

const email = process.env.SEED_USER_EMAIL || "sofi@journeydex.app";
const password = process.env.SEED_USER_PASSWORD || "password";
const name = process.env.SEED_USER_NAME || "Sofi";

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});

if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    console.log(`User already exists: ${email} (password unchanged). Nothing to do.`);
  } else {
    console.error("✗", error.message);
    process.exit(1);
  }
} else {
  console.log(`✓ Created user — email: ${email}  password: ${password}  name: ${name}`);
}
