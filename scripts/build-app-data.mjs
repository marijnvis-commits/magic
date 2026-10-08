// Bouwt app-data.json voor de prijsdalers-app uit alle opgeslagen dagprijzen.
// Per kaart: prijs nu, prijs ~30/60/90 dagen geleden (dichtstbijzijnde
// momentopname binnen 4 dagen), avg30 als indicatie en een prijsverloop.

import { readdir, readFile, writeFile } from "node:fs/promises";

const DAY = 86400000;
const WINDOW_DAYS = 4;

const meta = JSON.parse(await readFile("data/cards.json", "utf8"));
const files = (await readdir("data/snapshots")).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
if (!files.length) throw new Error("Nog geen momentopnames");

const snaps = [];
for (const f of files) snaps.push(JSON.parse(await readFile(`data/snapshots/${f}`, "utf8")));
const latest = snaps[snaps.length - 1];
const latestT = Date.parse(latest.date);

function snapshotNear(daysAgo) {
  const target = latestT - daysAgo * DAY;
  let best = null, bestDiff = Infinity;
  for (const s of snaps) {
    const diff = Math.abs(Date.parse(s.date) - target);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return bestDiff <= WINDOW_DAYS * DAY && best !== latest ? best : null;
}
const ref = { 1: snapshotNear(30), 2: snapshotNear(60), 3: snapshotNear(90) };

// Prijsverloop: de laatste 91 dagen, één punt per momentopname.
const spanSnaps = snaps.filter((s) => latestT - Date.parse(s.date) <= 91 * DAY);

const cards = [];
for (const [id, p] of Object.entries(latest.prices)) {
  const m = meta[id];
  if (!m) continue;
  const [now, avg30] = p;
  const was = {};
  for (const k of [1, 2, 3]) {
    const v = ref[k]?.prices?.[id]?.[0];
    if (typeof v === "number") was[k] = v;
  }
  cards.push({
    id, name: m.name, set: m.set, no: m.total ? `${m.no}/${String(m.total).padStart(3, "0")}` : m.no,
    rarity: m.rarity, now, avg30,
    was,
    hist: spanSnaps.map((s) => s.prices?.[id]?.[0] ?? null),
  });
}

const out = {
  updated: latest.date,
  source: latest.source,
  firstSnapshot: snaps[0].date,
  snapshots: snaps.length,
  refDates: { 1: ref[1]?.date ?? null, 2: ref[2]?.date ?? null, 3: ref[3]?.date ?? null },
  histDates: spanSnaps.map((s) => s.date),
  cards,
};
await writeFile("app-data.json", JSON.stringify(out) + "\n");
console.log(`app-data.json: ${cards.length} kaarten, ${snaps.length} momentopnames, referenties ${JSON.stringify(out.refDates)}`);
