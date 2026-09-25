#!/usr/bin/env python3
"""Fetch Lusail, Qatar prayer times from Aladhan API, cache, and verify."""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone

LUSAIL = {
    "lat": 25.4319,
    "lon": 51.4958,
    "name": "Lusail, Qatar",
    "timezone": "Asia/Qatar",
}
METHOD = 4  # Umm Al-Qura — closest Aladhan method to the provided sheet
METHOD_NAME = "Umm Al-Qura University, Makkah"
PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

PROVIDED_SEP_2026 = {
    "2026-09-01": {"Fajr": "03:53", "Dhuhr": "11:38", "Asr": "15:05", "Maghrib": "17:56", "Isha": "19:26"},
    "2026-09-02": {"Fajr": "03:53", "Dhuhr": "11:37", "Asr": "15:05", "Maghrib": "17:55", "Isha": "19:25"},
    "2026-09-03": {"Fajr": "03:54", "Dhuhr": "11:37", "Asr": "15:05", "Maghrib": "17:54", "Isha": "19:24"},
    "2026-09-04": {"Fajr": "03:54", "Dhuhr": "11:37", "Asr": "15:04", "Maghrib": "17:52", "Isha": "19:22"},
    "2026-09-05": {"Fajr": "03:55", "Dhuhr": "11:36", "Asr": "15:04", "Maghrib": "17:51", "Isha": "19:21"},
    "2026-09-06": {"Fajr": "03:55", "Dhuhr": "11:36", "Asr": "15:03", "Maghrib": "17:50", "Isha": "19:20"},
    "2026-09-07": {"Fajr": "03:56", "Dhuhr": "11:36", "Asr": "15:03", "Maghrib": "17:49", "Isha": "19:19"},
    "2026-09-08": {"Fajr": "03:56", "Dhuhr": "11:35", "Asr": "15:03", "Maghrib": "17:48", "Isha": "19:18"},
    "2026-09-09": {"Fajr": "03:57", "Dhuhr": "11:35", "Asr": "15:02", "Maghrib": "17:47", "Isha": "19:17"},
    "2026-09-10": {"Fajr": "03:58", "Dhuhr": "11:35", "Asr": "15:02", "Maghrib": "17:46", "Isha": "19:16"},
    "2026-09-11": {"Fajr": "03:58", "Dhuhr": "11:34", "Asr": "15:01", "Maghrib": "17:45", "Isha": "19:15"},
    "2026-09-12": {"Fajr": "03:58", "Dhuhr": "11:34", "Asr": "15:01", "Maghrib": "17:44", "Isha": "19:14"},
    "2026-09-13": {"Fajr": "03:59", "Dhuhr": "11:34", "Asr": "15:00", "Maghrib": "17:43", "Isha": "19:13"},
    "2026-09-14": {"Fajr": "03:59", "Dhuhr": "11:33", "Asr": "15:00", "Maghrib": "17:42", "Isha": "19:12"},
    "2026-09-15": {"Fajr": "04:00", "Dhuhr": "11:33", "Asr": "14:59", "Maghrib": "17:41", "Isha": "19:11"},
    "2026-09-16": {"Fajr": "04:00", "Dhuhr": "11:33", "Asr": "14:59", "Maghrib": "17:40", "Isha": "19:10"},
    "2026-09-17": {"Fajr": "04:01", "Dhuhr": "11:32", "Asr": "14:58", "Maghrib": "17:38", "Isha": "19:08"},
    "2026-09-18": {"Fajr": "04:01", "Dhuhr": "11:32", "Asr": "14:57", "Maghrib": "17:37", "Isha": "19:07"},
    "2026-09-19": {"Fajr": "04:02", "Dhuhr": "11:32", "Asr": "14:57", "Maghrib": "17:36", "Isha": "19:06"},
    "2026-09-20": {"Fajr": "04:02", "Dhuhr": "11:31", "Asr": "14:56", "Maghrib": "17:35", "Isha": "19:05"},
    "2026-09-21": {"Fajr": "04:03", "Dhuhr": "11:31", "Asr": "14:56", "Maghrib": "17:34", "Isha": "19:04"},
    "2026-09-22": {"Fajr": "04:03", "Dhuhr": "11:31", "Asr": "14:55", "Maghrib": "17:33", "Isha": "19:03"},
    "2026-09-23": {"Fajr": "04:04", "Dhuhr": "11:30", "Asr": "14:55", "Maghrib": "17:32", "Isha": "19:02"},
    "2026-09-24": {"Fajr": "04:04", "Dhuhr": "11:30", "Asr": "14:54", "Maghrib": "17:31", "Isha": "19:01"},
    "2026-09-25": {"Fajr": "04:04", "Dhuhr": "11:29", "Asr": "14:53", "Maghrib": "17:30", "Isha": "19:00"},
    "2026-09-26": {"Fajr": "04:05", "Dhuhr": "11:29", "Asr": "14:53", "Maghrib": "17:29", "Isha": "18:59"},
    "2026-09-27": {"Fajr": "04:05", "Dhuhr": "11:29", "Asr": "14:52", "Maghrib": "17:28", "Isha": "18:58"},
    "2026-09-28": {"Fajr": "04:06", "Dhuhr": "11:28", "Asr": "14:52", "Maghrib": "17:26", "Isha": "18:56"},
    "2026-09-29": {"Fajr": "04:06", "Dhuhr": "11:28", "Asr": "14:51", "Maghrib": "17:25", "Isha": "18:55"},
    "2026-09-30": {"Fajr": "04:07", "Dhuhr": "11:28", "Asr": "14:50", "Maghrib": "17:24", "Isha": "18:54"},
}


def to_min(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def fetch_month(year: int, month: int, method: int = METHOD) -> dict:
    import urllib.request

    url = (
        f"https://api.aladhan.com/v1/calendar/{year}/{month}"
        f"?latitude={LUSAIL['lat']}&longitude={LUSAIL['lon']}"
        f"&method={method}&timezonestring={LUSAIL['timezone']}"
    )
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def day_key(day: dict) -> str:
    gd = day["date"]["gregorian"]
    return f"{gd['year']}-{int(gd['month']['number']):02d}-{int(gd['day']):02d}"


def timings_of(day: dict) -> dict:
    return {k: day["timings"][k].split()[0] for k in PRAYERS}


def main() -> None:
    os.makedirs("prayer-cache", exist_ok=True)
    api_timetable: dict[str, dict] = {}
    raw_months: dict[str, dict] = {}

    for month in range(1, 13):
        print(f"Fetching 2026-{month:02d} (method={METHOD})...", flush=True)
        data = fetch_month(2026, month)
        raw_months[f"2026-{month:02d}"] = data
        for day in data["data"]:
            api_timetable[day_key(day)] = timings_of(day)
        time.sleep(0.3)

    print("Fetching 2026-09 method=10 (Qatar)...", flush=True)
    data10 = fetch_month(2026, 9, method=10)
    qatar_method = {day_key(d): timings_of(d) for d in data10["data"]}

    rows = []
    exact_days = 0
    offset_sums = {k: [] for k in PRAYERS}
    for key, provided in PROVIDED_SEP_2026.items():
        api = api_timetable.get(key)
        if not api:
            rows.append({"date": key, "status": "MISSING_IN_API"})
            continue
        diffs = {}
        match = True
        for k in PRAYERS:
            d = to_min(provided[k]) - to_min(api[k])
            diffs[k] = d
            offset_sums[k].append(d)
            if d != 0:
                match = False
        if match:
            exact_days += 1
        rows.append(
            {
                "date": key,
                "provided": provided,
                "api_method4_lusail": api,
                "api_method10_qatar_lusail": qatar_method.get(key),
                "diff_minutes_provided_minus_api4": diffs,
                "exact_match": match,
            }
        )

    mean_offsets = {k: round(sum(v) / len(v), 2) for k, v in offset_sums.items() if v}

    verification = {
        "location": LUSAIL,
        "api": {
            "provider": "Aladhan (api.aladhan.com)",
            "method_id": METHOD,
            "method_name": METHOD_NAME,
            "url_pattern": (
                "https://api.aladhan.com/v1/calendar/{year}/{month}"
                "?latitude=25.4319&longitude=51.4958&method=4&timezonestring=Asia/Qatar"
            ),
        },
        "compared_against": "User-provided September 2026 timetable",
        "summary": {
            "days_compared": len(PROVIDED_SEP_2026),
            "exact_matches": exact_days,
            "mean_offset_minutes_provided_minus_api4": mean_offsets,
            "note": (
                "Aladhan Umm Al-Qura for Lusail does not exactly match the provided September sheet. "
                "Typical offsets (provided − API): Fajr ≈ −1, Dhuhr ≈ +4, Asr ≈ +1, Maghrib/Isha ≈ +2 minutes. "
                "September 2026 in the app keeps the provided times as authoritative overrides; "
                "all other months use Aladhan method 4 for Lusail coordinates."
            ),
        },
        "days": rows,
    }

    final = dict(api_timetable)
    sources = {k: "aladhan_method_4" for k in api_timetable}
    for key, times in PROVIDED_SEP_2026.items():
        final[key] = times
        sources[key] = "user_provided_override"

    cache = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "location": LUSAIL,
        "api_method": {"id": METHOD, "name": METHOD_NAME},
        "policy": {
            "september_2026": "user_provided_override",
            "other_months": "aladhan_method_4_lusail",
        },
        "sources": sources,
        "timetable": final,
        "api_raw_september_method4": {k: api_timetable[k] for k in PROVIDED_SEP_2026},
        "api_raw_september_method10": qatar_method,
    }

    with open("prayer-cache/lusail-2026.json", "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)
    with open("prayer-cache/verification-sep2026.json", "w", encoding="utf-8") as f:
        json.dump(verification, f, indent=2, ensure_ascii=False)
    with open("prayer-cache/aladhan-raw-2026.json", "w", encoding="utf-8") as f:
        json.dump(raw_months, f)

    # Generate prayer-data.js for the web app
    write_prayer_data_js(final, sources, mean_offsets, exact_days)

    print("Cached days:", len(final))
    print("Exact Sept matches:", exact_days, "/", len(PROVIDED_SEP_2026))
    print("Mean offsets (provided - API4):", mean_offsets)
    print("2026-09-25 final:", final["2026-09-25"])
    print("2026-09-25 API4 :", api_timetable["2026-09-25"])
    print("2026-10-01 API  :", final.get("2026-10-01"))


def write_prayer_data_js(final: dict, sources: dict, mean_offsets: dict, exact_days: int) -> None:
    lines = [
        "/**",
        " * Prayer timetable for Lusail, Qatar (Asia/Qatar).",
        " *",
        " * Generated by tools/fetch-lusail-prayers.py",
        " * - September 2026: user-provided timetable (verified against Aladhan API)",
        " * - Other months 2026: Aladhan API method 4 (Umm Al-Qura) for Lusail coords",
        " *",
        f" * Verification: {exact_days}/30 September days exact-matched Aladhan method 4.",
        f" * Mean offsets (provided − API minutes): {mean_offsets}",
        " * See prayer-cache/verification-sep2026.json for the full day-by-day report.",
        " */",
        "",
        "const TIMEZONE = 'Asia/Qatar';",
        "const LOCATION_LABEL = 'Lusail, Qatar';",
        "",
        "/** Default minutes after Adhan until Iqama (overridable in Settings / localStorage). */",
        "const DEFAULT_IQAMA_INTERVALS = {",
        "  Fajr: 25,",
        "  Dhuhr: 20,",
        "  Asr: 25,",
        "  Maghrib: 10,",
        "  Isha: 20,",
        "};",
        "",
        "const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];",
        "",
        "/**",
        " * Adhan times only (HH:MM, 24h). Keys: YYYY-MM-DD.",
        " */",
        "const PRAYER_TIMETABLE = {",
    ]

    for key in sorted(final.keys()):
        t = final[key]
        src = sources.get(key, "")
        comment = f" // {src}" if src == "user_provided_override" else ""
        lines.append(
            f"  '{key}': {{ Fajr: '{t['Fajr']}', Dhuhr: '{t['Dhuhr']}', "
            f"Asr: '{t['Asr']}', Maghrib: '{t['Maghrib']}', Isha: '{t['Isha']}' }},{comment}"
        )

    lines += [
        "};",
        "",
        "/**",
        " * Audio paths. Adhan is a real recording (IslamCan azan2).",
        " * Iqama alerts are generated by the browser (tones + speech synthesis).",
        " */",
        "const AUDIO_PATHS = {",
        "  adhan: 'audio/adhan.mp3?v=3',",
        "};",
        "",
        "/** Attribution for the bundled Adhan recording. */",
        "const ADHAN_SOURCE = 'https://www.islamcan.com/audio/adhan/azan2.mp3';",
        "",
        "const PRAYER_DATA_META = {",
        "  location: 'Lusail, Qatar',",
        "  latitude: 25.4319,",
        "  longitude: 51.4958,",
        "  apiProvider: 'Aladhan',",
        "  apiMethod: 4,",
        "  apiMethodName: 'Umm Al-Qura University, Makkah',",
        "};",
        "",
    ]

    with open("prayer-data.js", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("Wrote prayer-data.js")


if __name__ == "__main__":
    main()
