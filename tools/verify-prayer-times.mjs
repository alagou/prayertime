#!/usr/bin/env node
/**
 * Checks prayer-times.js against:
 *   1. The mosque wall clock (Al-Harameen HA-5115) reading for 25 Nov 2026 — must match exactly.
 *   2. The official Qatar Calendar House perpetual table (prayer-cache/qatar-calendar-house.csv)
 *      for every day of 2026–2030 — reports exact matches and any day off by more than 1 minute.
 *
 * Usage:  node tools/verify-prayer-times.mjs
 * Exit code is non-zero if the reference day fails or any prayer is off by more than 1 minute
 * (Dhuhr is compared with the table + 1 minute, see VERIFICATION.md).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { computePrayerTimes } = require(path.join(root, 'prayer-times.js'));

const toMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

let failed = false;

// 1. Reference day from the mosque clock
const clock = { Fajr: '04:37', Dhuhr: '11:22', Asr: '14:23', Maghrib: '16:46', Isha: '18:16' };
const got = computePrayerTimes(2026, 11, 25);
const clockOk = Object.keys(clock).every((k) => got[k] === clock[k]);
console.log(`25 Nov 2026 vs mosque clock: ${clockOk ? 'EXACT MATCH' : 'MISMATCH'}`);
Object.keys(clock).forEach((k) => console.log(`  ${k.padEnd(8)} clock ${clock[k]}  app ${got[k]}`));
if (!clockOk) failed = true;

// 2. Official Qatar Calendar House table (day/month, isha, maghrib, asr, dhuhr, sunrise, fajr)
const csv = fs.readFileSync(path.join(root, 'prayer-cache', 'qatar-calendar-house.csv'), 'utf8');
const rows = csv.trim().split('\n').map((l) => l.split(','));
const cols = ['Isha', 'Maghrib', 'Asr', 'Dhuhr', 'Sunrise', 'Fajr'];
const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const stats = Object.fromEntries(prayers.map((p) => [p, { exact: 0, one: 0, worse: [], n: 0 }]));

for (let year = 2026; year <= 2030; year += 1) {
  for (const r of rows) {
    const [d, m] = r[0].split('/').map(Number);
    if (m === 2 && d === 29 && year % 4 !== 0) continue;
    const official = Object.fromEntries(cols.map((c, i) => [c, toMin(r[i + 1])]));
    const ours = computePrayerTimes(year, m, d);
    for (const p of prayers) {
      // Qatar now calls Dhuhr 1 minute after the perpetual table's solar-noon minute
      const expected = official[p] + (p === 'Dhuhr' ? 1 : 0);
      const diff = toMin(ours[p]) - expected;
      const s = stats[p];
      s.n += 1;
      if (diff === 0) s.exact += 1;
      else if (Math.abs(diff) === 1) s.one += 1;
      else s.worse.push(`${year}-${m}-${d} ${diff > 0 ? '+' : ''}${diff}`);
    }
  }
}

console.log('\nvs Qatar Calendar House table, 2026–2030:');
for (const p of prayers) {
  const s = stats[p];
  const pct = ((100 * s.exact) / s.n).toFixed(1);
  console.log(
    `  ${p.padEnd(8)} exact ${pct}%  ±1 min ${s.one}  more than 1 min: ${s.worse.length}` +
      (s.worse.length ? `  (${s.worse.slice(0, 5).join(', ')})` : '')
  );
  if (s.worse.length) failed = true;
}

process.exit(failed ? 1 : 0);
