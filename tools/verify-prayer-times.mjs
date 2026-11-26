#!/usr/bin/env node
/**
 * Checks prayer-times.js:
 *   1. Official readings must match exactly:
 *        - Ministry of Awqaf clock, Lusail mosque, 26 Nov 2026
 *        - Qatar Calendar House times for 21 Nov 2026
 *   2. Every day of 2026–2030 must equal the official Qatar Calendar House table
 *      (prayer-cache/qatar-calendar-house.csv) with Dhuhr and Asr +1 minute.
 *   3. Info only: how close the astronomical fallback is to the official times.
 *
 * Usage: node tools/verify-prayer-times.mjs   (non-zero exit on any failure)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { computePrayerTimes, computeAstronomical } = require(path.join(root, 'prayer-times.js'));

const toMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let failed = false;

// 1. Official readings
const references = [
  {
    label: '26 Nov 2026 — Awqaf clock, Lusail mosque',
    date: [2026, 11, 26],
    times: { Fajr: '04:37', Dhuhr: '11:22', Asr: '14:24', Maghrib: '16:45', Isha: '18:15' },
  },
  {
    label: '21 Nov 2026 — Qatar Calendar House',
    date: [2026, 11, 21],
    times: { Fajr: '04:34', Dhuhr: '11:21', Asr: '14:24', Maghrib: '16:46', Isha: '18:16' },
  },
];
for (const ref of references) {
  const got = computePrayerTimes(...ref.date);
  const bad = PRAYERS.filter((p) => got[p] !== ref.times[p]);
  console.log(`${ref.label}: ${bad.length ? 'MISMATCH ' + bad.join(', ') : 'exact match'}`);
  if (bad.length) failed = true;
}

// 2 + 3. Whole table, 2026–2030
const csv = fs.readFileSync(path.join(root, 'prayer-cache', 'qatar-calendar-house.csv'), 'utf8');
const cols = ['Isha', 'Maghrib', 'Asr', 'Dhuhr', 'Sunrise', 'Fajr'];
const adjust = { Dhuhr: 1, Asr: 1 };
const rows = csv.trim().split('\n').map((l) => l.split(','));
let days = 0;
let mismatches = 0;
const fallbackOff = Object.fromEntries(PRAYERS.map((p) => [p, 0]));
const fallbackMax = Object.fromEntries(PRAYERS.map((p) => [p, 0]));

for (let year = 2026; year <= 2030; year += 1) {
  for (const r of rows) {
    const [d, m] = r[0].split('/').map(Number);
    const official = Object.fromEntries(cols.map((c, i) => [c, toMin(r[i + 1]) + (adjust[c] || 0)]));
    const ours = computePrayerTimes(year, m, d);
    const calc = computeAstronomical(year, m, d);
    days += 1;
    for (const p of PRAYERS) {
      if (toMin(ours[p]) !== official[p]) {
        mismatches += 1;
        if (mismatches <= 5) console.log(`  mismatch ${year}-${m}-${d} ${p}: ${ours[p]}`);
      }
      const diff = Math.abs(toMin(calc[p]) - official[p]);
      if (diff) fallbackOff[p] += 1;
      fallbackMax[p] = Math.max(fallbackMax[p], diff);
    }
  }
}
console.log(`Official table 2026–2030: ${days} days × 5 prayers, ${mismatches} mismatches`);
if (mismatches) failed = true;
console.log('Fallback calculator (info): max difference in minutes', fallbackMax);

process.exit(failed ? 1 : 0);
