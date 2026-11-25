# Prayer & Iqama Countdown — Lusail, Qatar

Full-screen Islamic prayer display for **Lusail, Qatar** (`Asia/Qatar`, UTC+3). Shows today’s schedule, plays the Adhan at prayer time, then counts down to Iqama with a 5-minute voice/notification warning.

## Prayer times (calculated, every year)

Times are **calculated in the browser** for any date by `prayer-times.js`, using the
official **Qatar Ministry of Awqaf / Qatar Calendar House** method for Doha and its
suburbs (Lusail included):

- Fajr: sun 18° below the horizon
- Dhuhr: 1 minute after solar noon
- Asr: standard (Shafi'i) shadow length
- Maghrib: about 2 minutes after sunset (Qatar's precaution)
- Isha: Maghrib + 90 minutes, all year (also in Ramadan)

There is no yearly table to refresh, so the board keeps working in 2027 and later.

Check the calculation:

```bash
node tools/verify-prayer-times.mjs
```

It must match the mosque clock exactly for 25 Nov 2026 and stay within 1 minute of the
official Qatar Calendar House table on every day of 2026–2030. Details:
[`prayer-cache/VERIFICATION.md`](prayer-cache/VERIFICATION.md).

### Tablet clock

The board checks its clock against the web server every 30 minutes. If the tablet's
clock is wrong by 2 seconds or more, the board uses the server's time instead and shows a short note.

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
