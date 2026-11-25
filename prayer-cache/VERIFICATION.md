# Prayer-time accuracy: root cause and verification

## The problem (up to v1.3.1)

The board showed times that were shifted from the mosque clock. On 25 Nov 2026:

| Prayer  | Mosque clock (Al-Harameen HA-5115) | Old app | Difference |
|---------|------------------------------------|---------|------------|
| Fajr    | 04:37 | 04:36 | 1 min early |
| Dhuhr   | 11:22 | 11:21 | 1 min early |
| Asr     | 14:23 | 14:23 | same |
| Maghrib | 16:46 | 16:43 | 3 min early |
| Isha    | 18:16 | 18:13 | 3 min early |

## Root cause

The times came from a fixed 2026 table downloaded from the Aladhan API with
**method 4, Umm Al-Qura (Saudi Arabia)**. That is not the method used in Qatar:

1. **Fajr angle.** Umm Al-Qura uses 18.5°. Qatar uses 18°.
2. **No Qatar precaution minutes (ihtiyat).** Qatar's official calendar calls Maghrib
   about 2 minutes after the astronomical sunset and Dhuhr 1 minute after solar noon.
   Umm Al-Qura uses the raw times. This is the 3-minute Maghrib/Isha shift.
3. **Ramadan Isha.** Umm Al-Qura adds 120 minutes for Isha in Ramadan (a Saudi-only
   rule). Qatar uses 90 minutes all year. In Ramadan 2026 (18 Feb – 19 Mar) the old
   board called Isha **30 minutes late**.
4. **Data ended on 31 Dec 2026.** On 1 Jan 2027 the board would show
   "Prayer timetable is not available".

Across 2026 the old table matched the official Qatar Calendar House table on only
10/365 days for Fajr and 27/365 days for Maghrib and Isha.

## The fix (v1.4.0)

`prayer-times.js` calculates the times for any date from the sun's position, using
Qatar's rules (Doha reference point 25.2867° N, 51.5333° E, UTC+3):

| Prayer  | Rule |
|---------|------|
| Fajr    | Sun 18° below horizon, −1.0 min |
| Dhuhr   | Solar noon +1.0 min |
| Asr     | Shadow = 1× object + noon shadow, +0.35 min |
| Maghrib | Sunset (0.833°) +2.15 min |
| Isha    | Maghrib + 90 min |

The precaution minutes were fitted to the official table and the mosque clock, not set
by hand for any day. Each result is rounded to the nearest minute.

## Verification (`node tools/verify-prayer-times.mjs`)

**Mosque clock, 25 Nov 2026:** exact match for all five prayers.

**Official Qatar Calendar House perpetual table** (`qatar-calendar-house.csv`, from
[osamaalassiry/TaqweemQatar](https://github.com/osamaalassiry/TaqweemQatar), MIT),
every day of 2026–2030:

| Prayer  | Exact minute | Off by more than 1 minute |
|---------|--------------|---------------------------|
| Fajr    | 80.8% | 0 days |
| Sunrise | 83.9% | 0 days |
| Dhuhr   | 93.2% (vs table + 1 min) | 0 days |
| Asr     | 67.8% | 0 days |
| Maghrib | 73.2% | 0 days |
| Isha    | 73.2% | 0 days |

A perpetual table repeats every year, but the sun's times shift by up to about half a minute across
the 4-year leap cycle. So a ±1 minute difference from the printed table is expected on some days.
Today's Qatar Calendar House times for 21 Nov 2026 (Fajr 04:34, Sunrise 05:55,
Dhuhr 11:21, Asr 14:24, Maghrib 16:46, Isha 18:16) are also reproduced exactly.
