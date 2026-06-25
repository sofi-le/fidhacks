// Seed the memory store from ../shared/sampleCards.json so the binder + balance
// view have history to render before any voice input exists. Run: npm run seed
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { saveCard, resetDemo, getAllCards } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(__dirname, "..", "..", "shared", "sampleCards.json");
const cards = JSON.parse(readFileSync(samplePath, "utf8"));

resetDemo();
// insert oldest-first so semantic-memory counts/first_date come out chronologically
for (const c of [...cards].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
  saveCard(c);
}
console.log(`Seeded ${getAllCards().length} cards into memory.db`);
