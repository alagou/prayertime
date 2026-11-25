/**
 * Prayer-time calculator — Qatar Ministry of Awqaf / Qatar Calendar House method.
 *
 * Why this exists (root cause of the old "shifted" times):
 *   The app used a fixed 2026 table downloaded from Aladhan *method 4
 *   (Umm Al-Qura, Saudi Arabia)*. That is not the method used in Qatar:
 *     - Umm Al-Qura puts Fajr at 18.5° below the horizon; Qatar uses 18°.
 *     - Umm Al-Qura uses the raw astronomical sunset / transit; Qatar's official
 *       calendar adds precautionary minutes (ihtiyat) — most visibly ~2 min after
 *       sunset for Maghrib (and so for Isha, which is Maghrib + 90 min), and ~1 min
 *       after solar noon for Dhuhr.
 *   Result: Fajr ~1 min early, Dhuhr ~1 min early, Maghrib/Isha ~3 min early.
 *   The table also stopped on 2026-12-31, so the board would go blank on 1 Jan 2027.
 *
 * This file computes the times for ANY date from the sun's position, using the
 * Qatar rules below. Nothing is typed in by hand per day.
 *
 * Reference point: Qatar publishes one timetable for "Doha and its suburbs"
 * (Lusail included), so we compute for the official Doha reference point.
 *
 * Verified with tools/verify-prayer-times.mjs against:
 *   - the official Qatar Calendar House perpetual table (prayer-cache/qatar-calendar-house.csv)
 *   - the mosque wall clock (Al-Harameen HA-5115) reading for 25 Nov 2026.
 */
(function (global) {
  'use strict';

  const QATAR_METHOD = {
    name: 'Qatar Ministry of Awqaf (Qatar Calendar House)',
    // Official Doha reference point used by the Qatari calendar
    latitude: 25.2867,
    longitude: 51.5333,
    utcOffsetHours: 3, // Asia/Qatar, no DST
    fajrAngle: 18, // degrees below horizon
    sunsetAngle: 0.833, // refraction + solar semi-diameter
    asrShadowFactor: 1, // Shafi'i / Maliki / Hanbali (standard)
    ishaMinutesAfterMaghrib: 90,
    /**
     * Precautionary minutes (ihtiyat) built into Qatar's official calendar,
     * calibrated against the Qatar Calendar House table and the mosque clock.
     */
    ihtiyatMinutes: {
      Fajr: -1.0,
      Sunrise: 0,
      Dhuhr: 1.0, // 1 minute after solar noon (zawal)
      Asr: 0.35,
      Maghrib: 2.15, // ~2 minutes after sunset
    },
  };

  const DEG = Math.PI / 180;
  const sin = (d) => Math.sin(d * DEG);
  const cos = (d) => Math.cos(d * DEG);
  const tan = (d) => Math.tan(d * DEG);
  const asin = (x) => Math.asin(x) / DEG;
  const acos = (x) => Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
  const atan2 = (y, x) => Math.atan2(y, x) / DEG;
  const fixAngle = (a) => a - 360 * Math.floor(a / 360);
  const fixHour = (a) => a - 24 * Math.floor(a / 24);

  /** Julian day at 00:00 UT of a Gregorian date. */
  function julianDay(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return (
      Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5
    );
  }

  /** Sun declination (deg) and equation of time (hours) — U.S. Naval Observatory algorithm. */
  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    const declination = asin(sin(e) * sin(L));
    let eqt = q / 15 - fixHour(RA);
    eqt = eqt - 24 * Math.round(eqt / 24);
    return { declination, eqt };
  }

  /**
   * Raw astronomical times (decimal hours, local civil time) for one date.
   * Each event uses the sun's position at (approximately) the moment of that event.
   */
  function rawTimes(year, month, day, m = QATAR_METHOD) {
    const lat = m.latitude;
    const lon = m.longitude;
    const tz = m.utcOffsetHours;
    const jdate = julianDay(year, month, day) - lon / (15 * 24);

    // Sun position at a local-time guess (hours)
    const sunAt = (hours) => sunPosition(jdate + hours / 24);

    const noonAt = (hours) => fixHour(12 - sunAt(hours).eqt);

    /** Time the sun reaches `angle` degrees below horizon, before (-1) or after (+1) noon. */
    const timeAtAngle = (angle, guess, direction) => {
      const { declination } = sunAt(guess);
      const noon = noonAt(guess);
      const t =
        acos((-sin(angle) - sin(declination) * sin(lat)) / (cos(declination) * cos(lat))) / 15;
      return noon + direction * t;
    };

    const asrTime = (factor, guess) => {
      const { declination } = sunAt(guess);
      // Sun altitude when an object's shadow = factor × its length + noon shadow
      const alt = atan2(1, factor + tan(Math.abs(lat - declination)));
      const noon = noonAt(guess);
      const t = acos((sin(alt) - sin(declination) * sin(lat)) / (cos(declination) * cos(lat))) / 15;
      return noon + t;
    };

    // Two refinement passes starting from typical guesses (local solar hours)
    let t = { Fajr: 5, Sunrise: 6, Dhuhr: 12, Asr: 13, Maghrib: 18 };
    for (let pass = 0; pass < 2; pass += 1) {
      t = {
        Fajr: timeAtAngle(m.fajrAngle, t.Fajr, -1),
        Sunrise: timeAtAngle(m.sunsetAngle, t.Sunrise, -1),
        Dhuhr: noonAt(t.Dhuhr),
        Asr: asrTime(m.asrShadowFactor, t.Asr),
        Maghrib: timeAtAngle(m.sunsetAngle, t.Maghrib, 1),
      };
    }

    // Convert local solar time → local civil time (UTC+3)
    const shift = tz - lon / 15;
    const out = {};
    Object.keys(t).forEach((k) => {
      out[k] = t[k] + shift;
    });
    return out;
  }

  function toHHMM(totalMinutes) {
    const mins = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  /**
   * Official-style Adhan times for a Qatar calendar date.
   * @returns {{Fajr:string, Sunrise:string, Dhuhr:string, Asr:string, Maghrib:string, Isha:string}}
   */
  function computePrayerTimes(year, month, day, m = QATAR_METHOD) {
    const raw = rawTimes(year, month, day, m);
    const minutes = {};
    Object.keys(raw).forEach((k) => {
      minutes[k] = Math.round(raw[k] * 60 + (m.ihtiyatMinutes[k] || 0));
    });
    minutes.Isha = minutes.Maghrib + m.ishaMinutesAfterMaghrib;

    const result = {};
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((k) => {
      result[k] = toHHMM(minutes[k]);
    });
    return result;
  }

  const api = { QATAR_METHOD, computePrayerTimes, rawTimes };
  global.PrayerTimes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
