// Haalt dagelijks de Cardmarket-prijzen (EUR) op van alle Engelse
// Illustration Rares en Special Illustration Rares via de gratis TCGdex API.
// Schrijft:
//   data/cards.json                  kaartgegevens (naam, set, nummer, zeldzaamheid)
//   data/snapshots/YYYY-MM-DD.json   prijzen van die dag
// Draait zonder extra pakketten op Node 20+.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const API = process.env.TCGDEX_API || "https://api.tcgdex.net/v2/en";
const WANTED = new Map([
  ["illustration rare", "IR"],
  ["special illustration rare", "SIR"],
]);
const CONCURRENCY = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "pokemon-prijzen (GitHub Action)" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw new Error(`${url}: ${err.message}`);
      await sleep(1000 * i * i);
    }
  }
}

// Cardmarket geeft voor sommige kaarten alleen de holo-variant een prijs.
function pick(cm, key) {
  const v = cm?.[key];
  if (typeof v === "number" && v > 0) return v;
  const h = cm?.[`${key}-holo`];
  if (typeof h === "number" && h > 0) return h;
  return null;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Kandidaten ophalen. Het filter zonder "eq:" matcht ook "Special illustration rare".
  const listed = await getJson(`${API}/cards?rarity=${encodeURIComponent("illustration rare")}`);
  if (!Array.isArray(listed)) throw new Error("Onverwacht antwoord van de kaartenlijst");
  console.log(`Kandidaten: ${listed.length}`);

  // 2. Per kaart details + Cardmarket-prijs ophalen.
  const meta = {};
  const prices = {};
  let i = 0, missingPrice = 0, loggedSample = false;
  async function worker() {
    while (i < listed.length) {
      const { id } = listed[i++];
      const card = await getJson(`${API}/cards/${encodeURIComponent(id)}`);
      if (!card) continue;
      const rarity = WANTED.get(String(card.rarity || "").toLowerCase());
      if (!rarity) continue;
      meta[card.id] = {
        name: card.name,
        set: card.set?.name ?? "",
        setId: card.set?.id ?? "",
        no: card.localId ?? "",
        total: card.set?.cardCount?.official ?? null,
        rarity,
        image: card.image ?? null,
      };
      const cm = card.pricing?.cardmarket;
      if (cm && !loggedSample) { loggedSample = true; console.log("Voorbeeld Cardmarket-velden:", JSON.stringify(cm)); }
      if (cm?.idProduct) meta[card.id].cmId = cm.idProduct;
      const trend = pick(cm, "trend");
      if (trend == null) { missingPrice++; continue; }
      prices[card.id] = [trend, pick(cm, "avg30"), pick(cm, "low"), pick(cm, "avg7")];
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const count = Object.keys(prices).length;
  console.log(`IR/SIR-kaarten: ${Object.keys(meta).length}, met prijs: ${count}, zonder prijs: ${missingPrice}`);
  if (count < 50) throw new Error(`Maar ${count} prijzen gevonden; vermoedelijk is de API veranderd. Niets opgeslagen.`);

  // 3. Opslaan. Bestaande kaartgegevens blijven bewaard, nieuwe worden toegevoegd.
  await mkdir("data/snapshots", { recursive: true });
  let allMeta = {};
  if (existsSync("data/cards.json")) allMeta = JSON.parse(await readFile("data/cards.json", "utf8"));
  Object.assign(allMeta, meta);
  await writeFile("data/cards.json", JSON.stringify(allMeta, null, 0) + "\n");
  await writeFile(
    `data/snapshots/${today}.json`,
    JSON.stringify({ date: today, source: "Cardmarket via TCGdex", fields: ["trend", "avg30", "low", "avg7"], prices }) + "\n"
  );
  console.log(`Opgeslagen: data/snapshots/${today}.json`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
