/**
 * Prayer times for Lusail / Doha — official Qatar timetable.
 *
 * Source of truth: the Qatar Calendar House perpetual timetable (التقويم القطري),
 * the timetable published by Qatar's Ministry of Awqaf for "Doha and its suburbs"
 * (Lusail included), with Dhuhr and Asr called 1 minute later, as the Ministry's
 * mosque clocks do.
 *
 * Checked against the Ministry of Awqaf clock in a Lusail mosque on 26 Nov 2026
 * (Fajr 04:37, Dhuhr 11:22, Asr 14:24, Maghrib 16:45, Isha 18:15) and against
 * official Qatar Calendar House times for 21 Nov 2026 (04:34, 11:21, 14:24, 16:46, 18:16).
 *
 * The table is perpetual (one row per day of the year), so it works for every year.
 * 29 February uses the 28 February row.
 *
 * The astronomical calculator further down is kept only as a fallback and for
 * cross-checking (tools/verify-prayer-times.mjs).
 *
 * History: up to v1.3.1 the app used a 2026 table from the Saudi Umm Al-Qura
 * method (Fajr 18.5°, no Qatar precaution minutes, Isha +120 in Ramadan), which
 * shifted Fajr, Dhuhr, Maghrib and Isha by 1–3 minutes (Isha 30 minutes in Ramadan).
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

  /**
   * Qatar Calendar House perpetual table, one string per month.
   * Each day: Fajr.Sunrise.Dhuhr.Asr.Maghrib in minutes after midnight
   * (Isha = Maghrib + 90, always). From prayer-cache/qatar-calendar-house.csv.
   */
  const QATAR_CALENDAR = [
    '297.380.697.876.1017 297.380.698.876.1018 298.380.698.877.1019 298.380.699.878.1019 298.380.699.878.1020 298.381.700.879.1021 299.381.700.880.1021 299.381.701.880.1022 299.381.701.881.1023 299.381.701.882.1024 299.381.702.882.1024 300.381.702.883.1025 300.381.703.884.1026 300.381.703.884.1027 300.381.703.885.1027 300.381.704.886.1028 300.381.704.886.1029 300.381.704.887.1030 300.381.705.888.1030 300.381.705.888.1031 300.381.705.889.1032 300.380.705.890.1033 300.380.706.890.1033 299.380.706.891.1034 299.380.706.892.1035 299.379.706.892.1036 299.379.707.893.1036 299.379.707.893.1037 298.378.707.894.1038 298.378.707.895.1039 298.378.707.895.1039', // Jan
    '298.377.707.896.1040 297.377.708.896.1041 297.376.708.897.1042 296.376.708.897.1042 296.375.708.898.1043 296.375.708.898.1044 295.374.708.899.1044 295.373.708.899.1045 294.373.708.900.1046 294.372.708.900.1046 293.372.708.901.1047 292.371.708.901.1048 292.370.708.902.1048 291.369.708.902.1049 291.369.708.903.1050 290.368.708.903.1050 289.367.708.903.1051 289.367.708.904.1051 288.366.708.904.1052 287.365.708.904.1053 287.364.708.905.1053 286.363.707.905.1054 285.362.707.905.1054 284.362.707.905.1055 283.361.707.906.1056 283.360.707.906.1056 282.359.707.906.1057 281.358.706.906.1057', // Feb
    '280.357.706.907.1058 279.356.706.907.1058 278.355.706.907.1059 277.354.706.907.1059 276.353.705.907.1060 275.352.705.907.1060 275.351.705.907.1061 274.351.705.908.1061 273.350.704.908.1062 272.349.704.908.1062 271.348.704.908.1063 270.347.704.908.1063 269.346.703.908.1064 268.344.703.908.1064 266.343.703.908.1065 265.342.703.908.1065 264.341.702.908.1066 263.340.702.908.1066 262.339.702.908.1066 261.338.701.908.1067 260.337.701.908.1067 259.336.701.908.1068 258.335.701.908.1069 257.334.700.907.1070 256.333.700.907.1070 255.332.700.907.1071 253.331.699.907.1071 252.330.699.907.1071 251.329.699.907.1072 250.328.698.907.1072 249.327.698.907.1073', // Mar
    '248.326.698.906.1073 247.325.698.906.1074 245.324.697.906.1074 244.323.697.906.1075 243.322.697.906.1075 242.321.696.906.1075 241.320.696.905.1076 240.319.696.905.1076 239.318.696.905.1077 238.317.695.905.1077 236.316.695.904.1078 235.315.695.904.1078 234.314.694.904.1079 233.313.694.904.1079 232.312.694.904.1079 231.311.694.903.1080 230.310.693.903.1080 229.309.693.903.1081 228.308.693.903.1081 226.307.693.902.1082 225.306.693.902.1081 224.305.692.902.1082 223.305.692.902.1082 222.304.692.901.1083 221.303.692.901.1083 220.302.692.901.1084 219.301.692.901.1084 218.300.691.900.1085 217.300.691.900.1085 216.299.691.900.1086', // Apr
    '215.298.691.900.1086 214.297.691.900.1087 213.297.691.899.1087 212.296.691.899.1088 212.295.691.899.1088 211.295.690.899.1089 210.294.690.898.1089 209.293.690.898.1090 208.293.690.898.1090 207.292.690.898.1091 206.291.690.898.1091 206.291.690.897.1092 205.290.690.897.1092 204.290.690.897.1093 203.289.690.897.1093 203.289.690.897.1094 202.288.690.897.1094 201.288.690.897.1095 201.287.690.896.1096 200.287.690.896.1096 200.287.690.896.1097 199.286.691.896.1097 198.286.691.896.1098 198.285.691.896.1098 197.285.691.896.1099 197.285.691.896.1099 196.285.691.896.1100 196.284.691.896.1100 196.284.691.896.1101 195.284.691.896.1101 195.284.692.896.1101', // May
    '195.284.692.896.1102 194.283.692.896.1102 194.283.692.896.1103 194.283.692.896.1103 193.283.692.896.1104 193.283.692.896.1104 193.283.693.896.1105 193.283.693.896.1105 193.283.693.896.1105 193.283.693.896.1106 193.283.693.897.1106 193.283.694.897.1106 193.283.694.897.1107 193.283.694.897.1107 193.283.694.897.1107 193.283.695.897.1108 193.283.695.897.1108 193.284.695.898.1108 193.284.695.898.1109 193.284.695.898.1109 193.284.696.898.1109 194.284.696.898.1109 194.285.696.899.1109 194.285.696.899.1110 194.285.696.899.1110 195.285.697.899.1110 195.286.697.900.1110 195.286.697.900.1110 196.286.697.900.1110 196.287.697.900.1110', // Jun
    '197.287.698.901.1110 197.287.698.901.1110 198.288.698.901.1110 198.288.698.902.1110 198.288.698.902.1110 199.289.699.902.1110 200.289.699.902.1110 200.290.699.903.1110 201.290.699.903.1110 201.291.699.903.1110 202.291.699.903.1110 202.291.699.904.1109 203.292.700.904.1109 204.292.700.904.1109 204.293.700.904.1109 205.293.700.905.1108 205.294.700.905.1108 206.294.700.905.1108 207.295.700.905.1107 207.295.700.906.1107 208.296.700.906.1107 209.296.700.906.1106 209.296.700.906.1106 210.297.700.906.1106 211.297.700.907.1105 211.298.700.907.1105 212.298.700.907.1104 213.299.700.907.1104 213.299.700.907.1103 214.300.700.907.1102 215.300.700.907.1102', // Jul
    '216.301.700.907.1101 216.301.700.908.1101 217.302.700.908.1100 218.302.700.908.1099 218.303.700.908.1099 219.303.700.908.1098 220.304.700.908.1097 220.304.700.908.1097 221.305.699.908.1096 222.305.699.908.1095 222.306.699.908.1094 223.306.699.908.1094 224.306.699.908.1093 224.307.699.907.1092 225.307.698.907.1091 226.308.698.907.1090 226.308.698.907.1089 227.309.698.907.1089 227.309.698.907.1088 228.309.697.907.1087 229.310.697.906.1086 229.310.697.906.1085 230.311.697.906.1084 230.311.696.906.1083 231.312.696.905.1082 232.312.696.905.1081 232.312.695.905.1080 233.313.695.905.1079 233.313.695.904.1078 234.314.695.904.1077 234.314.694.904.1076', // Aug
    '235.314.694.903.1075 235.315.694.903.1074 236.315.693.902.1073 236.316.693.902.1072 237.316.693.902.1071 238.316.692.901.1070 238.317.692.901.1069 239.317.692.900.1068 239.317.691.900.1067 239.318.691.899.1066 240.318.691.899.1065 240.319.690.898.1064 241.319.690.898.1063 241.319.689.897.1062 242.320.689.897.1061 242.320.689.896.1060 243.320.688.896.1058 243.321.688.895.1057 244.321.688.895.1056 244.322.687.894.1055 245.322.687.894.1054 245.322.687.893.1053 245.323.686.892.1052 246.323.686.892.1051 246.323.686.891.1050 247.324.685.891.1049 247.324.685.890.1048 248.325.685.889.1046 248.325.684.889.1045 248.325.684.888.1044', // Sep
    '249.326.684.888.1043 249.326.683.887.1042 250.327.683.886.1041 250.327.683.886.1040 250.328.682.885.1039 251.328.682.884.1038 251.328.682.884.1037 252.329.681.883.1036 252.329.681.882.1035 253.330.681.882.1034 253.330.681.881.1033 253.331.680.881.1032 254.331.680.880.1031 254.332.680.879.1030 255.332.680.879.1029 255.333.679.878.1028 256.333.679.878.1027 256.334.679.877.1026 257.334.679.876.1025 257.335.679.876.1024 257.335.679.875.1024 258.336.678.875.1023 258.336.678.874.1022 259.337.678.873.1021 259.337.678.873.1020 260.338.678.872.1020 260.338.678.872.1019 261.339.678.871.1018 261.340.678.871.1017 262.340.678.870.1017 262.341.677.870.1016', // Oct
    '263.341.677.869.1015 263.342.677.869.1015 264.343.677.868.1014 264.343.677.868.1013 265.344.677.868.1013 265.345.677.867.1012 266.345.678.867.1012 266.346.678.866.1011 267.347.678.866.1010 268.347.678.866.1010 268.348.678.865.1010 269.349.678.865.1009 269.349.678.865.1009 270.350.678.865.1008 270.351.678.864.1008 271.351.679.864.1008 272.352.679.864.1007 272.353.679.864.1007 273.353.679.864.1007 273.354.679.863.1006 274.355.680.863.1006 275.356.680.863.1006 275.356.680.863.1006 276.357.680.863.1006 277.358.681.863.1005 277.359.681.863.1005 278.359.681.863.1005 278.360.682.863.1005 279.361.682.863.1005 280.361.682.863.1005', // Nov
    '280.362.683.863.1005 281.363.683.863.1005 282.364.684.863.1005 282.364.684.864.1005 283.365.684.864.1006 283.366.685.864.1006 284.366.685.864.1006 285.367.686.864.1006 285.368.686.865.1006 286.368.687.865.1007 286.369.687.865.1007 287.370.687.865.1007 288.370.688.866.1007 288.371.688.866.1008 289.371.689.867.1008 289.372.689.867.1009 290.373.690.867.1009 290.373.690.868.1009 291.374.691.868.1010 292.374.691.869.1010 292.375.692.869.1011 293.375.692.870.1011 293.376.693.870.1012 293.376.693.871.1012 294.377.694.871.1013 294.377.694.872.1013 295.378.695.872.1014 295.378.695.873.1015 296.378.696.874.1015 296.379.696.874.1016 296.379.697.875.1016', // Dec
  ];

  /** Minutes the Ministry of Awqaf mosque clocks add to the printed table. */
  const OFFICIAL_ADJUSTMENT = { Fajr: 0, Sunrise: 0, Dhuhr: 1, Asr: 1, Maghrib: 0 };
  const ISHA_AFTER_MAGHRIB = 90;
  const TABLE_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib'];
  const parsedMonths = [];

  function officialRow(month, day) {
    if (!parsedMonths[month]) {
      const src = QATAR_CALENDAR[month - 1];
      parsedMonths[month] = src ? src.split(' ').map((d) => d.split('.').map(Number)) : [];
    }
    const days = parsedMonths[month];
    const row = days[day - 1] || (month === 2 && day === 29 ? days[27] : null);
    return row && row.length === 5 ? row : null;
  }

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
   * Official Adhan times for a Qatar calendar date.
   * @returns {{Fajr:string, Sunrise:string, Dhuhr:string, Asr:string, Maghrib:string, Isha:string}}
   */
  function computePrayerTimes(year, month, day) {
    const row = officialRow(month, day);
    if (!row) return computeAstronomical(year, month, day);
    const minutes = {};
    TABLE_KEYS.forEach((k, i) => {
      minutes[k] = row[i] + OFFICIAL_ADJUSTMENT[k];
    });
    minutes.Isha = minutes.Maghrib + ISHA_AFTER_MAGHRIB;
    const result = {};
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((k) => {
      result[k] = toHHMM(minutes[k]);
    });
    return result;
  }

  /**
   * Fallback: astronomical calculation with Qatar's rules (within 1 minute of the
   * official table). Only used if the table has no row for a date.
   */
  function computeAstronomical(year, month, day, m = QATAR_METHOD) {
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

  const api = { QATAR_METHOD, computePrayerTimes, computeAstronomical, rawTimes, officialRow };
  global.PrayerTimes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
