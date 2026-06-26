// Upload the 14 seed card images (public/card_images/*.jpg) to the Supabase
// Storage bucket `card-art` under seed/. Run ONCE after creating the project
// and running the SQL migration (which creates the bucket):
//
//   cd backend
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:images
//
// (Or put SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env.)
// The service-role key bypasses Storage RLS, so it can write the shared seed/
// folder that every user's seed cards point at. Keep it server-side only.

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see backend/.env.example).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "..", "public", "card_images");

const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) {
  console.error("No images found in", dir);
  process.exit(1);
}

const contentTypeFor = (ext) =>
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

let ok = 0;
for (const f of files) {
  const buf = readFileSync(path.join(dir, f));
  const contentType = contentTypeFor(path.extname(f).toLowerCase());
  const dest = `seed/${f}`; // e.g. seed/c1.jpg — matches seedSampleCardsIfEmpty()
  const { error } = await supabase.storage
    .from("card-art")
    .upload(dest, buf, { upsert: true, contentType });
  if (error) console.error("✗", f, "-", error.message);
  else {
    ok++;
    console.log("✓", dest);
  }
}
console.log(`\nUploaded ${ok}/${files.length} seed images to card-art/seed/`);
if (ok < files.length) process.exit(1);
