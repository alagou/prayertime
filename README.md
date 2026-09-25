# Prayer & Iqama Countdown — Lusail, Qatar

Full-screen Islamic prayer display for **Lusail, Qatar** (`Asia/Qatar`, UTC+3). Shows today’s schedule, plays the Adhan at prayer time, then counts down to Iqama with a 5-minute voice/notification warning.

## Prayer data (API + cache)

Times are loaded from `prayer-data.js` (365 days for 2026):

- **September 2026:** your provided timetable (authoritative)
- **Other months:** [Aladhan API](https://api.aladhan.com) method 4 (Umm Al-Qura) for Lusail (25.4319°N, 51.4958°E)

Refresh from the API:

```bash
python tools/fetch-lusail-prayers.py
```

Verification report (provided Sept vs API): [`prayer-cache/VERIFICATION.md`](prayer-cache/VERIFICATION.md)

## Quick start

```bash
python -m http.server 8080
```

Open `http://localhost:8080` → **Enable Prayer Alerts & Sound**.

## Audio

- Adhan: `audio/adhan.mp3` (IslamCan azan2)
- Iqama alerts: loud chimes + browser speech

## Settings

Iqama intervals, volume, test Adhan / 5-min warning / Iqama voice, and test mode for time simulation.
