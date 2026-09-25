# Lusail prayer times — API extract & verification

## Source

| Field | Value |
|-------|--------|
| Location | **Lusail, Qatar** (25.4319°N, 51.4958°E) |
| Timezone | `Asia/Qatar` (UTC+3) |
| API | [Aladhan](https://api.aladhan.com) calendar |
| Method | **4 — Umm Al-Qura University, Makkah** |
| Also compared | Method **10 — Qatar** (September only) |

Fetch command:

```bash
python tools/fetch-lusail-prayers.py
```

## Cached files

| File | Contents |
|------|----------|
| `prayer-cache/lusail-2026.json` | Full 2026 timetable used by the app (+ metadata) |
| `prayer-cache/verification-sep2026.json` | Day-by-day provided vs API comparison |
| `prayer-cache/aladhan-raw-2026.json` | Raw Aladhan monthly responses |
| `prayer-data.js` | App-ready JS export (365 days) |

## App policy

- **September 2026:** your provided timetable is kept as the **authoritative** schedule (exact Adhan times you supplied).
- **Other months in 2026:** Aladhan method 4 for Lusail coordinates.

## Verification vs provided September 2026

Compared all **30** provided days against Aladhan method 4 for Lusail.

| Result | Value |
|--------|--------|
| Exact day matches | **0 / 30** |
| Mean offset (provided − API) Fajr | **−0.83 min** |
| Mean offset Dhuhr | **+3.73 min** |
| Mean offset Asr | **+1.33 min** |
| Mean offset Maghrib | **+2.33 min** |
| Mean offset Isha | **+2.33 min** |

### Example — 25 September 2026

| Prayer | Provided (used in app) | Aladhan API (Lusail, method 4) | Diff |
|--------|------------------------|-------------------------------|------|
| Fajr | 04:04 | 04:05 | −1 |
| Dhuhr | 11:29 | 11:26 | +3 |
| Asr | 14:53 | 14:52 | +1 |
| Maghrib | 17:30 | 17:27 | +3 |
| Isha | 19:00 | 18:57 | +3 |

Method 10 (Qatar) was also checked; it was **not** closer overall than method 4 for matching your sheet.

### Conclusion

The Aladhan API is a solid source for **Lusail** year-round times, but it does **not** reproduce your September sheet minute-for-minute (likely a different published calendar / rounding / local Awqaf table). The app therefore:

1. Caches the full API year for Lusail.
2. Documents the offsets.
3. Keeps your September values exact so Maghrib 17:30 / Isha 19:00 etc. stay as you specified.

Re-run `python tools/fetch-lusail-prayers.py` anytime to refresh the API cache and regenerate `prayer-data.js`.
