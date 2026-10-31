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

## Unattended display board (no touches)

Browsers block sound until someone taps the page. On every load the app checks
whether this device lets it play sound without a tap. If it does, sound turns on
automatically ("Sound enabled automatically"). If not, a small "Sound is OFF on this
board" bar appears at the bottom. Use one of these setups so it never needs a tap:

1. **Install it as an app (Android, free).** Open the site in Chrome, then go to
   menu ⋮ → **Install app** (or **Add to Home screen** → **Install**). Always open it from the
   home-screen icon. Chrome lets installed apps play sound without a tap.
2. **Kiosk browser (Android).** Use e.g. Fully Kiosk Browser with the site as the
   start URL. Turn on the autoplay options in its Web Content settings, plus
   "Keep screen on" and "Launch on boot".
3. **PC / mini-PC with Chrome.** Start Chrome with
   `--autoplay-policy=no-user-gesture-required --kiosk <site URL>`.

After setting it up, restart the app/browser without touching the screen. It
should say "Sound enabled automatically", and the bottom bar should not appear.

Tablet settings for a wall board: keep media volume up, turn Do Not Disturb off,
turn off battery optimisation for Chrome or the kiosk app, and keep it on the
charger. The app also asks the browser to keep the screen awake while it's open.

## Audio

- Adhan: `audio/adhan.mp3` (IslamCan azan2)
- Iqama alerts: loud chimes + browser speech

## Settings

Iqama intervals, volume, test Adhan / 5-min warning / Iqama voice, and test mode for time simulation.
