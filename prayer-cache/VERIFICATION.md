# Prayer-time accuracy

## Source of truth (v1.4.1)

The app shows the **official Qatar Calendar House perpetual timetable** for Doha and
its suburbs (Lusail included), with **Dhuhr and Asr called 1 minute later**, as the
Ministry of Awqaf mosque clocks do. Isha is always Maghrib + 90 minutes.

The timetable data is `qatar-calendar-house.csv`, from
[osamaalassiry/TaqweemQatar](https://github.com/osamaalassiry/TaqweemQatar) (MIT). Each
row is `day/month, Isha, Maghrib, Asr, Dhuhr, Sunrise, Fajr`. 29 February uses the
28 February row.

## Official readings it matches exactly

| Date | Source | Fajr | Dhuhr | Asr | Maghrib | Isha |
|------|--------|------|-------|-----|---------|------|
| 26 Nov 2026 | Ministry of Awqaf clock, Lusail mosque | 04:37 | 11:22 | 14:24 | 16:45 | 18:15 |
| 21 Nov 2026 | Qatar Calendar House | 04:34 | 11:21 | 14:24 | 16:46 | 18:16 |

`node tools/verify-prayer-times.mjs` checks both readings. It also checks that every day of
2026–2030 equals the official timetable, with 0 mismatches.

## Why the old app was shifted (up to v1.3.1)

The app used a 2026 table from the Aladhan API with **method 4, Umm Al-Qura
(Saudi Arabia)**, not Qatar's timetable:

- Fajr used 18.5° instead of Qatar's 18°, so it was about 1 minute early.
- It had no Qatar precaution minutes, so Dhuhr was about 1 minute early and Maghrib and Isha about 3 minutes early.
- In Ramadan, Isha was set at Maghrib + 120 minutes (a Saudi rule), 30 minutes late for Qatar.
- The data ended on 31 Dec 2026, so the board would have gone blank on 1 Jan 2027.

## About v1.4.0

v1.4.0 calculated the times from the sun's position. Its rules were tuned to an
Al-Harameen wall clock, which turned out to be 1 minute off the official Awqaf clock
for Asr, Maghrib and Isha. That calculator is now only a fallback, used if a date has no
row in the timetable. It stays within 1 minute of the official times.
