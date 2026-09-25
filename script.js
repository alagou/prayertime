/**
 * Prayer & Iqama Countdown — Lusail, Qatar (Asia/Qatar)
 *
 * All schedule comparisons use real timestamps derived from Asia/Qatar
 * calendar date + Adhan times. Timers only trigger UI refresh; the
 * authoritative clock is Date.now() (or a test-mode offset).
 */

(() => {
  'use strict';

  // —— Storage keys ——
  const STORAGE = {
    settings: 'prayerDisplay.settings.v1',
    alertsEnabled: 'prayerDisplay.alertsEnabled.v1',
    firedAlerts: 'prayerDisplay.firedAlerts.v1',
  };

  // —— Default settings ——
  const DEFAULT_SETTINGS = {
    adhanAudio: true,
    notifications: true,
    iqamaVoice: true,
    iqamaSound: true,
    volume: 80,
    intervals: { ...DEFAULT_IQAMA_INTERVALS },
  };

  // —— DOM ——
  const $ = (id) => document.getElementById(id);

  const els = {
    weekday: $('current-weekday'),
    date: $('current-date'),
    time: $('current-time'),
    location: $('location-label'),
    prayerList: $('prayer-list'),
    statusPanel: $('status-panel'),
    statusNext: $('status-next'),
    statusAdhan: $('status-adhan'),
    statusCountdown: $('status-countdown'),
    statusIqamaNow: $('status-iqama-now'),
    statusComplete: $('status-complete'),
    statusUnavailable: $('status-unavailable'),
    nextPrayerName: $('next-prayer-name'),
    nextPrayerTime: $('next-prayer-time'),
    adhanPrayerName: $('adhan-prayer-name'),
    countdownLabel: $('countdown-label'),
    countdownDigits: $('countdown-digits'),
    countdownIqamaTime: $('countdown-iqama-time'),
    iqamaNowName: $('iqama-now-name'),
    tomorrowFajr: $('tomorrow-fajr'),
    enableOverlay: $('enable-overlay'),
    btnEnable: $('btn-enable-alerts'),
    btnSkip: $('btn-skip-alerts'),
    btnSettings: $('btn-settings'),
    btnTestMode: $('btn-test-mode'),
    settingsPanel: $('settings-panel'),
    testPanel: $('test-panel'),
    backdrop: $('panel-backdrop'),
    btnCloseSettings: $('btn-close-settings'),
    btnCloseTest: $('btn-close-test'),
    testBanner: $('test-banner'),
    testBannerDetail: $('test-banner-detail'),
    btnExitTest: $('btn-exit-test'),
    settingAdhanAudio: $('setting-adhan-audio'),
    settingNotifications: $('setting-notifications'),
    settingIqamaVoice: $('setting-iqama-voice'),
    settingIqamaSound: $('setting-iqama-sound'),
    settingVolume: $('setting-volume'),
    volumeValue: $('volume-value'),
    intervalInputs: $('interval-inputs'),
    btnSaveIntervals: $('btn-save-intervals'),
    btnTestAdhan: $('btn-test-adhan'),
    btnTestWarning: $('btn-test-warning'),
    btnTestIqama: $('btn-test-iqama'),
    btnStopAudio: $('btn-stop-audio'),
    testAudioPrayer: $('test-audio-prayer'),
    testPrayer: $('test-prayer'),
    testScenarios: $('test-scenarios'),
    btnClearAlerts: $('btn-clear-alerts'),
    btnDisableTest: $('btn-disable-test'),
    alarmBanner: $('alarm-banner'),
    alarmEyebrow: $('alarm-eyebrow'),
    alarmTitle: $('alarm-title'),
    alarmPrayer: $('alarm-prayer'),
    alarmDetail: $('alarm-detail'),
    btnStopAlarm: $('btn-stop-alarm'),
  };

  // —— State ——
  let settings = loadSettings();
  let alertsUnlocked = localStorage.getItem(STORAGE.alertsEnabled) === 'true';
  let audioReady = false;

  /** @type {{ active: boolean, baseRealMs: number, simulatedMs: number, label: string } | null} */
  let testMode = null;

  /** Brief UI hold after Iqama moment (ms remaining based on wall clock). */
  let iqamaHoldUntil = 0;

  const audio = {
    // Prefer DOM <audio> when present — more reliable on Windows Chrome/Edge
    adhan: document.getElementById('adhan-player') || new Audio(AUDIO_PATHS.adhan),
  };

  /** @type {AudioContext | null} */
  let audioCtx = null;

  /** @type {AudioBufferSourceNode[]} */
  let activeSources = [];

  /** Prevent overlapping announcement sequences */
  let announcementToken = 0;

  let audioStatusTimer = 0;

  audio.adhan.preload = 'auto';
  audio.adhan.setAttribute?.('playsinline', '');
  audio.adhan.playsInline = true;

  // ============================================================
  // Time helpers — always Asia/Qatar
  // ============================================================

  /**
   * Parts of a Date in Asia/Qatar. Qatar has no DST (UTC+3 year-round).
   */
  function getQatarParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
    );
    // en-GB may give hour "24" at midnight in some engines — normalize
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return {
      weekday: parts.weekday,
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour,
      minute: Number(parts.minute),
      second: Number(parts.second),
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    };
  }

  /** Instant for a Qatar local civil time. Asia/Qatar = UTC+3, no DST. */
  function qatarLocalToDate(year, month, day, hour, minute, second = 0) {
    return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second));
  }

  function parseHHMM(str) {
    const [h, m] = str.split(':').map(Number);
    return { hour: h, minute: m };
  }

  function formatHHMM(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function addMinutesToHHMM(hhmm, minutes) {
    const { hour, minute } = parseHHMM(hhmm);
    const total = hour * 60 + minute + minutes;
    const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const m = ((total % 1440) + 1440) % 1440 % 60;
    return formatHHMM(h, m);
  }

  function formatCountdown(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function formatLongDate(parts) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${parts.day} ${months[parts.month - 1]} ${parts.year}`;
  }

  /** Authoritative "now" — real clock or test simulation. */
  function now() {
    if (!testMode || !testMode.active) return new Date();
    const elapsed = Date.now() - testMode.baseRealMs;
    return new Date(testMode.simulatedMs + elapsed);
  }

  // ============================================================
  // Schedule building
  // ============================================================

  function getIntervals() {
    return { ...DEFAULT_IQAMA_INTERVALS, ...settings.intervals };
  }

  /**
   * Build today's prayer schedule with Adhan/Iqama Date objects.
   * @returns {null | Array<{name, adhanStr, iqamaStr, adhanAt, iqamaAt, warningAt}>}
   */
  function buildSchedule(dateKey, year, month, day) {
    const times = PRAYER_TIMETABLE[dateKey];
    if (!times) return null;

    const intervals = getIntervals();
    return PRAYER_ORDER.map((name) => {
      const adhanStr = times[name];
      const iqamaStr = addMinutesToHHMM(adhanStr, intervals[name]);
      const a = parseHHMM(adhanStr);
      const i = parseHHMM(iqamaStr);
      const adhanAt = qatarLocalToDate(year, month, day, a.hour, a.minute, 0);
      const iqamaAt = qatarLocalToDate(year, month, day, i.hour, i.minute, 0);
      const warningAt = new Date(iqamaAt.getTime() - 5 * 60 * 1000);
      return { name, adhanStr, iqamaStr, adhanAt, iqamaAt, warningAt };
    });
  }

  function nextDateKey(year, month, day) {
    // Advance one calendar day in Qatar by using noon Qatar → +1 day parts
    const noon = qatarLocalToDate(year, month, day, 12, 0, 0);
    const next = new Date(noon.getTime() + 24 * 60 * 60 * 1000);
    return getQatarParts(next);
  }

  // ============================================================
  // Settings & fired-alert persistence
  // ============================================================

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE.settings);
      if (!raw) return { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_IQAMA_INTERVALS } };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        intervals: { ...DEFAULT_IQAMA_INTERVALS, ...(parsed.intervals || {}) },
      };
    } catch {
      return { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_IQAMA_INTERVALS } };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    applyVolume();
  }

  function loadFiredAlerts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.firedAlerts) || '{}');
    } catch {
      return {};
    }
  }

  function saveFiredAlerts(map) {
    localStorage.setItem(STORAGE.firedAlerts, JSON.stringify(map));
  }

  function alertKey(dateKey, prayer, kind) {
    return `${dateKey}:${prayer}:${kind}`;
  }

  function hasFired(dateKey, prayer, kind) {
    const map = loadFiredAlerts();
    return Boolean(map[alertKey(dateKey, prayer, kind)]);
  }

  function markFired(dateKey, prayer, kind) {
    const map = loadFiredAlerts();
    map[alertKey(dateKey, prayer, kind)] = Date.now();
    // Prune entries older than ~45 days
    const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    Object.keys(map).forEach((k) => {
      if (map[k] < cutoff) delete map[k];
    });
    saveFiredAlerts(map);
  }

  function clearFiredForDate(dateKey) {
    const map = loadFiredAlerts();
    Object.keys(map).forEach((k) => {
      if (k.startsWith(`${dateKey}:`)) delete map[k];
    });
    saveFiredAlerts(map);
  }

  // ============================================================
  // Audio & notifications
  // ============================================================

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showAudioStatus(message, kind = 'ok') {
    const toast = $('audio-status');
    const inline = $('audio-status-inline');
    if (inline) inline.textContent = message;
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = message;
    toast.classList.toggle('is-error', kind === 'error');
    toast.classList.toggle('is-ok', kind === 'ok');
    clearTimeout(audioStatusTimer);
    audioStatusTimer = setTimeout(() => {
      toast.hidden = true;
    }, 6000);
  }

  /**
   * Large on-screen alarm with Stop button.
   * @param {'adhan'|'warning'|'iqama'} type
   * @param {string} [prayerName]
   */
  function showAlarmBanner(type, prayerName = '') {
    const banner = els.alarmBanner;
    if (!banner) return;

    const name = (prayerName || '').trim();
    const upper = name ? name.toUpperCase() : '';

    banner.classList.remove('is-adhan', 'is-warning', 'is-iqama');
    banner.classList.add(
      type === 'adhan' ? 'is-adhan' : type === 'warning' ? 'is-warning' : 'is-iqama'
    );

    if (type === 'adhan') {
      els.alarmEyebrow.textContent = 'Prayer time alert';
      els.alarmTitle.textContent = 'ADHAN';
      els.alarmPrayer.textContent = upper || 'PRAYER';
      els.alarmDetail.textContent = name
        ? `It is time for ${name} Adhan. The call to prayer is playing.`
        : 'The Adhan (call to prayer) is playing.';
    } else if (type === 'warning') {
      els.alarmEyebrow.textContent = 'Iqama reminder';
      els.alarmTitle.textContent = 'IQAMA IN 5 MINUTES';
      els.alarmPrayer.textContent = upper || 'PRAYER';
      els.alarmDetail.textContent = name
        ? `${name} Iqama starts in 5 minutes. You should go to prayer now.`
        : 'Iqama starts in 5 minutes. You should go to prayer now.';
    } else {
      els.alarmEyebrow.textContent = 'Iqama alert';
      els.alarmTitle.textContent = 'IQAMA TIME';
      els.alarmPrayer.textContent = upper || 'PRAYER';
      els.alarmDetail.textContent = name
        ? `It is time for ${name} Iqama. Please stand for prayer.`
        : 'It is time for Iqama. Please stand for prayer.';
    }

    banner.hidden = false;
    // Focus stop button for keyboard / accessibility
    requestAnimationFrame(() => els.btnStopAlarm?.focus());
  }

  function hideAlarmBanner() {
    if (els.alarmBanner) els.alarmBanner.hidden = true;
  }

  /** Stop all sound and dismiss the alarm banner. */
  function stopAlarm(showToast = true) {
    stopAllClips();
    hideAlarmBanner();
    if (showToast) showAudioStatus('Alarm stopped');
  }

  function applyVolume() {
    const v = Math.max(0, Math.min(1, (settings.volume ?? 80) / 100));
    audio.adhan.volume = v;
  }

  async function ensureAudioContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        /* ignore */
      }
    }
    return audioCtx;
  }

  function stopAllClips() {
    announcementToken += 1;
    try {
      audio.adhan.pause();
      if (audio.adhan.currentTime) audio.adhan.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
    });
    activeSources = [];
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }

  /** Very loud alert chime for 5-min warning / Iqama (hard to miss across a room). */
  async function playAlertChime(style = 'warning') {
    const ctx = await ensureAudioContext();
    if (!ctx) return;
    const nowT = ctx.currentTime;
    // Alerts stay loud even if the volume slider is moderate
    const vol = Math.min(1, Math.max(0.75, (settings.volume ?? 80) / 100) * 1.15);

    const tone = (freq, start, dur, gain = 0.55, type = 'square') => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const peak = Math.min(0.95, gain * vol);
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, nowT + start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), nowT + start + 0.01);
      g.gain.setValueAtTime(peak, nowT + start + Math.max(0.02, dur - 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, nowT + start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(nowT + start);
      osc.stop(nowT + start + dur + 0.03);
    };

    // Layer two waveforms so the alert cuts through room noise
    const blast = (freq, start, dur, gain = 0.6) => {
      tone(freq, start, dur, gain, 'square');
      tone(freq * 0.5, start, dur, gain * 0.45, 'sawtooth');
      tone(freq * 2, start + 0.01, dur * 0.85, gain * 0.25, 'square');
    };

    if (style === 'iqama') {
      // Urgent rising pattern, then long hold
      [0, 0.18, 0.36, 0.54, 0.72].forEach((t, i) => {
        blast(660 + i * 80, t, 0.14, 0.72);
      });
      blast(988, 1.0, 0.22, 0.8);
      blast(1174, 1.28, 0.35, 0.85);
      blast(1318, 1.7, 0.55, 0.9);
      // Extra attention pulse
      blast(880, 2.4, 0.2, 0.75);
      blast(880, 2.7, 0.2, 0.75);
      blast(1320, 3.0, 0.45, 0.9);
      await delay(3600);
      return;
    }

    // 5-minute warning: sharp triple-triple blasts
    [0, 0.22, 0.44].forEach((t) => {
      blast(1046, t, 0.16, 0.78);
      blast(784, t + 0.1, 0.14, 0.7);
    });
    await delay(900);
    [0, 0.22, 0.44].forEach((t) => {
      blast(1174, t, 0.18, 0.82);
      blast(880, t + 0.1, 0.15, 0.72);
    });
    blast(1318, 0.85, 0.5, 0.9);
    await delay(1600);
  }

  function pickSpeechVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const prefer = [
      /Microsoft (Aria|Jenny|Zira|Guy|David|Mark)/i,
      /Google US English/i,
      /en-US.*Google/i,
      /Samantha/i,
      /^en(-|_)/i,
    ];
    for (const re of prefer) {
      const found = voices.find((v) => re.test(`${v.name} ${v.lang}`));
      if (found) return found;
    }
    return voices.find((v) => /^en/i.test(v.lang)) || voices[0];
  }

  function speakOnce(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve(false);
        return;
      }
      try {
        window.speechSynthesis.resume?.();
      } catch {
        /* ignore */
      }

      const u = new SpeechSynthesisUtterance(text);
      const voice = pickSpeechVoice();
      if (voice) u.voice = voice;
      u.lang = voice?.lang || 'en-US';
      // Slower + max volume = clearer across a room
      u.rate = 0.82;
      u.pitch = 1.05;
      u.volume = 1;
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      u.onend = () => finish(true);
      u.onerror = (ev) => {
        console.warn('Speech error:', ev?.error);
        finish(false);
      };
      setTimeout(() => finish(false), Math.max(12000, text.length * 160));
      try {
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn('Speech speak() threw:', err);
        finish(false);
      }
    });
  }

  /** Short loud punch between spoken lines (keeps attention without long delays). */
  async function playAlertPunch() {
    const ctx = await ensureAudioContext();
    if (!ctx) return;
    const nowT = ctx.currentTime;
    const vol = Math.min(1, Math.max(0.75, (settings.volume ?? 80) / 100) * 1.15);
    const hit = (freq, start, dur, gain) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const peak = Math.min(0.95, gain * vol);
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, nowT + start);
      g.gain.exponentialRampToValueAtTime(peak, nowT + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, nowT + start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(nowT + start);
      osc.stop(nowT + start + dur + 0.02);
    };
    hit(1100, 0, 0.12, 0.85);
    hit(880, 0.14, 0.14, 0.8);
    hit(1320, 0.32, 0.2, 0.9);
    await delay(550);
  }

  /**
   * Hearable, repeatable voice announcement with loud alert tones.
   */
  async function announceVoice(type, prayerName = 'Asr') {
    const token = ++announcementToken;
    const name = prayerName || 'the next';
    await ensureAudioContext();

    const lines =
      type === 'warning'
        ? [
            `Attention! Iqama starts after 5 minutes for ${name} prayer.`,
            'You should go now.',
            `Please go to prayer. Iqama in 5 minutes for ${name}.`,
          ]
        : [
            `Attention! It is time for Iqama for ${name} prayer.`,
            `Please stand for ${name} prayer. Iqama begins now.`,
            `Iqama time for ${name}. Please stand.`,
          ];

    const repeats = type === 'warning' ? 3 : 3;
    const chimeStyle = type === 'warning' ? 'warning' : 'iqama';

    showAlarmBanner(type === 'warning' ? 'warning' : 'iqama', name);
    showAudioStatus(
      type === 'warning'
        ? `Alert: Iqama in 5 minutes for ${name}…`
        : `Alert: Iqama time for ${name}…`
    );

    // Opening double blast — very noticeable
    if (token === announcementToken) {
      await playAlertChime(chimeStyle);
      await playAlertChime(chimeStyle);
    }

    for (let round = 0; round < repeats; round += 1) {
      if (token !== announcementToken) return;
      await playAlertChime(chimeStyle);
      if (token !== announcementToken) return;
      for (const line of lines) {
        if (token !== announcementToken) return;
        const ok = await speakOnce(line);
        await playAlertPunch();
        if (!ok) await playAlertChime(chimeStyle);
      }
      if (round < repeats - 1) await delay(200);
    }
    if (token === announcementToken) {
      await playAlertChime(chimeStyle);
      await playAlertChime(chimeStyle);
    }
    // Announcement finished naturally — keep banner until user stops, or auto-hide shortly
    if (token === announcementToken) {
      await delay(2500);
      if (token === announcementToken) hideAlarmBanner();
    }
  }

  /**
   * Play Adhan immediately — must be called from a click handler
   * without long awaits beforehand (browser autoplay / user-gesture rules).
   * @param {string} [prayerName]
   */
  async function playAdhanFile(prayerName = '') {
    applyVolume();
    audio.adhan.muted = false;
    const vol = Math.max(0, Math.min(1, (settings.volume ?? 80) / 100));
    audio.adhan.volume = vol;

    showAlarmBanner('adhan', prayerName);

    // Ensure src is set
    const srcUrl = AUDIO_PATHS.adhan;
    if (!audio.adhan.getAttribute('src') && !audio.adhan.src) {
      audio.adhan.src = srcUrl;
    }

    try {
      audio.adhan.pause();
    } catch {
      /* ignore */
    }

    try {
      // Some browsers throw if currentTime is set before metadata
      if (audio.adhan.readyState >= 1) audio.adhan.currentTime = 0;
    } catch {
      /* ignore */
    }

    try {
      const playPromise = audio.adhan.play();
      if (playPromise) await playPromise;
      showAudioStatus(prayerName ? `Playing ${prayerName} Adhan…` : 'Playing Adhan…');
      // When Adhan ends, dismiss banner if still showing for Adhan
      audio.adhan.onended = () => {
        hideAlarmBanner();
      };
      return true;
    } catch (err) {
      console.warn('Adhan HTMLAudio play failed:', err);
      showAudioStatus(`Adhan blocked: ${err.message}. Playing alert tone instead.`, 'error');
      await playAlertChime('warning');
      await playAlertChime('iqama');
      return false;
    }
  }

  /**
   * Unlock audio on a user gesture. Keep this FAST — do not await long loads
   * before calling play(), or the browser will revoke the gesture.
   */
  async function unlockAudio() {
    applyVolume();
    const ctx = await ensureAudioContext();
    if (ctx) {
      try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* ignore */
      }
    }

    // Warm speech engine with a silent utterance (Chrome Windows)
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        const warm = new SpeechSynthesisUtterance(' ');
        warm.volume = 0;
        warm.rate = 2;
        window.speechSynthesis.speak(warm);
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }

    audioReady = true;
    localStorage.setItem(STORAGE.alertsEnabled, 'true');
  }

  /**
   * @param {string} which - adhan | warning | iqama | test-*
   * @param {string} [prayerName]
   */
  async function playSound(which, prayerName = 'Asr') {
    const isTest = which.startsWith('test-');
    if (!audioReady && !isTest) return;

    const kind =
      which === 'adhan' || which === 'test-adhan'
        ? 'adhan'
        : which === 'warning' || which === 'test-warning'
          ? 'warning'
          : 'iqama';

    // Resume context FIRST while still in the user-gesture stack
    await ensureAudioContext();

    if (kind === 'adhan') {
      stopAllClips();
      applyVolume();
      try {
        await playAdhanFile(prayerName);
      } catch (err) {
        console.warn('Adhan play failed:', err.message);
        showAudioStatus(`Adhan error: ${err.message}`, 'error');
        await playAlertChime('warning');
      }
      return;
    }

    stopAllClips();
    applyVolume();

    if (kind === 'warning') {
      if (!settings.iqamaVoice && !isTest) return;
      await announceVoice('warning', prayerName);
      return;
    }

    if (!settings.iqamaSound && !isTest) return;
    await announceVoice('iqama', prayerName);
  }

  function canNotify() {
    return (
      settings.notifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    );
  }

  function sendNotification(title, body, tag) {
    if (!canNotify()) return;
    try {
      new Notification(title, {
        body,
        tag,
        renotify: false,
        silent: false,
      });
    } catch (err) {
      console.warn('Notification failed:', err.message);
    }
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // ============================================================
  // Alert triggers (idempotent via localStorage)
  // ============================================================

  /**
   * Fire Adhan once for this prayer/date if we are at/after Adhan
   * and before Iqama, and the alert has not already fired.
   *
   * Important: if the user opens the page mid-countdown (after Adhan),
   * we mark Adhan as fired WITHOUT replaying audio/notification so we
   * do not replay an old Adhan — unless we crossed Adhan "just now"
   * (within a short grace) or exact Adhan in live tick.
   *
   * Strategy:
   * - If never fired and now >= adhan and now < iqama:
   *   - If now is within first 90 seconds of Adhan → play + notify
   *   - Else (late open) → mark fired only (show countdown, no replay)
   */
  function maybeTriggerAdhan(dateKey, prayer, current) {
    if (hasFired(dateKey, prayer.name, 'adhan')) return;

    const t = current.getTime();
    if (t < prayer.adhanAt.getTime() || t >= prayer.iqamaAt.getTime()) return;

    const secondsSinceAdhan = (t - prayer.adhanAt.getTime()) / 1000;
    markFired(dateKey, prayer.name, 'adhan');

    if (secondsSinceAdhan <= 90) {
      if (settings.adhanAudio) playSound('adhan', prayer.name);
      sendNotification(
        'Prayer Time',
        `${prayer.name} Adhan — ${prayer.adhanStr}`,
        alertKey(dateKey, prayer.name, 'adhan')
      );
    }
  }

  function maybeTriggerIqamaWarning(dateKey, prayer, current) {
    if (hasFired(dateKey, prayer.name, 'iqama5')) return;

    const t = current.getTime();
    // Exactly at or after the 5-minute mark, but before Iqama
    if (t < prayer.warningAt.getTime() || t >= prayer.iqamaAt.getTime()) return;

    // If user opens page already past the warning window start,
    // only play if within ~75s of the warning instant (avoid late replay)
    const secondsSinceWarning = (t - prayer.warningAt.getTime()) / 1000;
    markFired(dateKey, prayer.name, 'iqama5');

    if (secondsSinceWarning <= 75) {
      if (settings.iqamaVoice) playSound('warning', prayer.name);
      sendNotification(
        'Iqama Reminder',
        `${prayer.name} Iqama starts after 5 minutes. You should go now.`,
        alertKey(dateKey, prayer.name, 'iqama5')
      );
    }
  }

  function maybeTriggerIqama(dateKey, prayer, current) {
    if (hasFired(dateKey, prayer.name, 'iqama')) return;

    const t = current.getTime();
    if (t < prayer.iqamaAt.getTime()) return;

    // Only within a short window after Iqama so overnight reopen doesn't fire
    const secondsSinceIqama = (t - prayer.iqamaAt.getTime()) / 1000;
    if (secondsSinceIqama > 90) {
      markFired(dateKey, prayer.name, 'iqama');
      return;
    }

    markFired(dateKey, prayer.name, 'iqama');
    if (settings.iqamaSound) playSound('iqama', prayer.name);
    sendNotification(
      'Iqama Time',
      `It is time for Iqama for ${prayer.name} prayer.`,
      alertKey(dateKey, prayer.name, 'iqama')
    );
    iqamaHoldUntil = Math.max(iqamaHoldUntil, prayer.iqamaAt.getTime() + 45_000);
  }

  // ============================================================
  // Phase detection
  // ============================================================

  /**
   * Determine UI phase from schedule + current time.
   * @returns {{ phase: string, prayer?: object, next?: object }}
   */
  function resolvePhase(schedule, current) {
    if (!schedule) return { phase: 'unavailable' };

    const t = current.getTime();

    // Active Adhan → Iqama window (prefer the prayer whose window contains now)
    for (const prayer of schedule) {
      if (t >= prayer.adhanAt.getTime() && t < prayer.iqamaAt.getTime()) {
        const secsSinceAdhan = (t - prayer.adhanAt.getTime()) / 1000;
        if (secsSinceAdhan < 45) {
          return { phase: 'adhan', prayer };
        }
        return { phase: 'countdown', prayer };
      }
    }

    // Brief Iqama hold
    for (const prayer of schedule) {
      const since = t - prayer.iqamaAt.getTime();
      if (since >= 0 && (since < 45_000 || t < iqamaHoldUntil)) {
        return { phase: 'iqama-now', prayer };
      }
    }

    // Next upcoming Adhan
    for (const prayer of schedule) {
      if (t < prayer.adhanAt.getTime()) {
        return { phase: 'next', next: prayer };
      }
    }

    return { phase: 'complete' };
  }

  function urgencyClass(secondsLeft) {
    if (secondsLeft > 15 * 60) return '';
    if (secondsLeft > 10 * 60) return 'urgency-notice';
    if (secondsLeft > 5 * 60) return 'urgency-amber';
    if (secondsLeft > 60) return 'urgency-red';
    return 'urgency-critical';
  }

  // ============================================================
  // Render
  // ============================================================

  function hideAllStatus() {
    [
      els.statusNext,
      els.statusAdhan,
      els.statusCountdown,
      els.statusIqamaNow,
      els.statusComplete,
      els.statusUnavailable,
    ].forEach((el) => {
      el.hidden = true;
    });
    els.statusPanel.className = 'status-panel';
  }

  function renderClock(parts) {
    els.weekday.textContent = parts.weekday;
    els.date.textContent = formatLongDate(parts);
    els.time.textContent = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
    els.location.textContent = LOCATION_LABEL;
  }

  function renderScheduleList(schedule, phaseInfo, current) {
    els.prayerList.innerHTML = '';
    if (!schedule) return;

    const t = current.getTime();
    const activeName =
      phaseInfo.prayer?.name ||
      (phaseInfo.phase === 'next' ? phaseInfo.next?.name : null);

    schedule.forEach((prayer) => {
      const li = document.createElement('li');
      li.className = `prayer-row prayer-${prayer.name.toLowerCase()}`;

      const afterIqama = t >= prayer.iqamaAt.getTime();
      const inWindow = t >= prayer.adhanAt.getTime() && t < prayer.iqamaAt.getTime();
      const isNext = phaseInfo.phase === 'next' && phaseInfo.next?.name === prayer.name;

      if (afterIqama && !inWindow) li.classList.add('passed');
      if (inWindow || (phaseInfo.phase === 'iqama-now' && phaseInfo.prayer?.name === prayer.name) ||
          (phaseInfo.phase === 'adhan' && phaseInfo.prayer?.name === prayer.name)) {
        li.classList.add('current');
      } else if (isNext) {
        li.classList.add('next');
      }

      li.innerHTML = `
        <span class="prayer-name">${prayer.name}</span>
        <span class="prayer-time">${prayer.adhanStr}</span>
        <span class="prayer-time">${prayer.iqamaStr}</span>
      `;
      els.prayerList.appendChild(li);
    });
  }

  function renderStatus(phaseInfo, parts) {
    hideAllStatus();

    switch (phaseInfo.phase) {
      case 'unavailable':
        els.statusUnavailable.hidden = false;
        break;

      case 'adhan': {
        // Prominent Adhan label + live Iqama countdown together
        const prayer = phaseInfo.prayer;
        const secondsLeft = (prayer.iqamaAt.getTime() - now().getTime()) / 1000;
        els.statusAdhan.hidden = false;
        els.adhanPrayerName.textContent = `${prayer.name.toUpperCase()} ADHAN`;
        els.statusCountdown.hidden = false;
        els.countdownLabel.textContent = 'IQAMA IN';
        els.countdownDigits.textContent = formatCountdown(secondsLeft);
        els.countdownIqamaTime.textContent = `Iqama: ${prayer.iqamaStr}`;
        break;
      }

      case 'countdown': {
        const prayer = phaseInfo.prayer;
        const secondsLeft = (prayer.iqamaAt.getTime() - now().getTime()) / 1000;
        els.statusCountdown.hidden = false;
        els.countdownLabel.textContent = `${prayer.name.toUpperCase()} IQAMA IN`;
        els.countdownDigits.textContent = formatCountdown(secondsLeft);
        els.countdownIqamaTime.textContent = `Iqama: ${prayer.iqamaStr}`;
        const u = urgencyClass(secondsLeft);
        if (u) els.statusPanel.classList.add(u);
        break;
      }

      case 'iqama-now':
        els.statusIqamaNow.hidden = false;
        els.iqamaNowName.textContent = 'IQAMA TIME';
        els.statusPanel.classList.add('urgency-critical');
        break;

      case 'complete': {
        els.statusComplete.hidden = false;
        const tomorrow = nextDateKey(parts.year, parts.month, parts.day);
        const tomorrowTimes = PRAYER_TIMETABLE[tomorrow.dateKey];
        if (tomorrowTimes) {
          els.tomorrowFajr.textContent = `Tomorrow's Fajr — ${tomorrowTimes.Fajr}`;
        } else {
          els.tomorrowFajr.textContent = 'Tomorrow\'s timetable is not yet available.';
        }
        break;
      }

      case 'next':
      default: {
        const next = phaseInfo.next;
        els.statusNext.hidden = false;
        if (next) {
          els.nextPrayerName.textContent = next.name.toUpperCase();
          els.nextPrayerTime.textContent = next.adhanStr;
        }
        break;
      }
    }
  }

  function tick() {
    const current = now();
    const parts = getQatarParts(current);
    renderClock(parts);

    const schedule = buildSchedule(parts.dateKey, parts.year, parts.month, parts.day);

    if (schedule) {
      for (const prayer of schedule) {
        maybeTriggerAdhan(parts.dateKey, prayer, current);
        maybeTriggerIqamaWarning(parts.dateKey, prayer, current);
        maybeTriggerIqama(parts.dateKey, prayer, current);
      }
    }

    const phaseInfo = resolvePhase(schedule, current);
    renderStatus(phaseInfo, parts);
    renderScheduleList(schedule, phaseInfo, current);

    if (testMode?.active) {
      els.testBanner.hidden = false;
      els.testBannerDetail.textContent = testMode.label;
    } else {
      els.testBanner.hidden = true;
    }
  }

  // ============================================================
  // Settings UI
  // ============================================================

  function buildIntervalInputs() {
    els.intervalInputs.innerHTML = '';
    const intervals = getIntervals();
    PRAYER_ORDER.forEach((name) => {
      const label = document.createElement('label');
      label.className = 'interval-field';
      label.innerHTML = `<span>${name}</span>`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '60';
      input.value = String(intervals[name]);
      input.dataset.prayer = name;
      label.appendChild(input);
      els.intervalInputs.appendChild(label);
    });
  }

  function syncSettingsForm() {
    els.settingAdhanAudio.checked = settings.adhanAudio;
    els.settingNotifications.checked = settings.notifications;
    els.settingIqamaVoice.checked = settings.iqamaVoice;
    els.settingIqamaSound.checked = settings.iqamaSound;
    els.settingVolume.value = String(settings.volume);
    els.volumeValue.textContent = `${settings.volume}%`;
    buildIntervalInputs();
  }

  function openPanel(panel) {
    els.settingsPanel.hidden = panel !== 'settings';
    els.testPanel.hidden = panel !== 'test';
    els.backdrop.hidden = false;
  }

  function closePanels() {
    els.settingsPanel.hidden = true;
    els.testPanel.hidden = true;
    els.backdrop.hidden = true;
  }

  // ============================================================
  // Test mode
  // ============================================================

  const SCENARIOS = {
    'before-adhan-1m': { label: '1 min before Adhan', offsetFromAdhanMs: -60_000 },
    'exact-adhan': { label: 'Exact Adhan', offsetFromAdhanMs: 0 },
    'after-adhan': { label: 'Just after Adhan', offsetFromAdhanMs: 2_000 },
    'before-iqama-6m': { label: '6 min before Iqama', offsetFromIqamaMs: -6 * 60_000 },
    'before-iqama-5m': { label: '5 min before Iqama', offsetFromIqamaMs: -5 * 60_000 },
    'before-iqama-1m': { label: '1 min before Iqama', offsetFromIqamaMs: -60_000 },
    'exact-iqama': { label: 'Exact Iqama', offsetFromIqamaMs: 0 },
  };

  function startTestScenario(scenarioId) {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) return;

    const prayerName = els.testPrayer.value;
    const current = new Date(); // use real date for which day's schedule
    const parts = getQatarParts(current);
    const schedule = buildSchedule(parts.dateKey, parts.year, parts.month, parts.day);
    if (!schedule) {
      alert('No timetable for today — cannot run test mode.');
      return;
    }

    const prayer = schedule.find((p) => p.name === prayerName);
    if (!prayer) return;

    let simulatedMs;
    if ('offsetFromAdhanMs' in scenario) {
      simulatedMs = prayer.adhanAt.getTime() + scenario.offsetFromAdhanMs;
    } else {
      simulatedMs = prayer.iqamaAt.getTime() + scenario.offsetFromIqamaMs;
    }

    // Clear fired flags for this prayer so the scenario can re-trigger alerts
    const map = loadFiredAlerts();
    ['adhan', 'iqama5', 'iqama'].forEach((kind) => {
      delete map[alertKey(parts.dateKey, prayerName, kind)];
    });
    saveFiredAlerts(map);
    iqamaHoldUntil = 0;

    testMode = {
      active: true,
      baseRealMs: Date.now(),
      simulatedMs,
      label: `${prayerName} · ${scenario.label}`,
    };

    closePanels();
    tick();
  }

  function stopTestMode() {
    testMode = null;
    iqamaHoldUntil = 0;
    els.testBanner.hidden = true;
    tick();
  }

  // ============================================================
  // Enable / bootstrap
  // ============================================================

  async function enableAlerts(withSound) {
    if (withSound) {
      await unlockAudio();
      await requestNotificationPermission();
      localStorage.setItem(STORAGE.alertsEnabled, 'true');
      alertsUnlocked = true;
    } else {
      localStorage.setItem(STORAGE.alertsEnabled, 'skipped');
      alertsUnlocked = false;
    }
    els.enableOverlay.hidden = true;
  }

  function showEnableOverlayIfNeeded() {
    const flag = localStorage.getItem(STORAGE.alertsEnabled);
    if (flag === 'true') {
      // Still need a gesture to unlock audio in many browsers after refresh
      els.enableOverlay.hidden = false;
      els.btnEnable.textContent = 'Tap to Resume Sound & Alerts';
    } else if (flag === 'skipped') {
      els.enableOverlay.hidden = true;
    } else {
      els.enableOverlay.hidden = false;
    }
  }

  // ============================================================
  // Event bindings
  // ============================================================

  function bindEvents() {
    els.btnEnable.addEventListener('click', () => enableAlerts(true));
    els.btnSkip.addEventListener('click', () => enableAlerts(false));

    els.btnSettings.addEventListener('click', () => {
      syncSettingsForm();
      openPanel('settings');
    });
    els.btnTestMode.addEventListener('click', () => openPanel('test'));
    els.btnCloseSettings.addEventListener('click', closePanels);
    els.btnCloseTest.addEventListener('click', closePanels);
    els.backdrop.addEventListener('click', closePanels);
    els.btnExitTest.addEventListener('click', stopTestMode);
    els.btnDisableTest.addEventListener('click', () => {
      stopTestMode();
      closePanels();
    });

    els.settingAdhanAudio.addEventListener('change', () => {
      settings.adhanAudio = els.settingAdhanAudio.checked;
      saveSettings();
    });
    els.settingNotifications.addEventListener('change', async () => {
      settings.notifications = els.settingNotifications.checked;
      if (settings.notifications) await requestNotificationPermission();
      saveSettings();
    });
    els.settingIqamaVoice.addEventListener('change', () => {
      settings.iqamaVoice = els.settingIqamaVoice.checked;
      saveSettings();
    });
    els.settingIqamaSound.addEventListener('change', () => {
      settings.iqamaSound = els.settingIqamaSound.checked;
      saveSettings();
    });
    els.settingVolume.addEventListener('input', () => {
      settings.volume = Number(els.settingVolume.value);
      els.volumeValue.textContent = `${settings.volume}%`;
      applyVolume();
      saveSettings();
    });

    els.btnSaveIntervals.addEventListener('click', () => {
      const inputs = els.intervalInputs.querySelectorAll('input[data-prayer]');
      inputs.forEach((input) => {
        const n = Math.max(1, Math.min(60, Number(input.value) || 1));
        settings.intervals[input.dataset.prayer] = n;
        input.value = String(n);
      });
      saveSettings();
      tick();
    });

    els.btnTestAdhan.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        audioReady = true;
        await ensureAudioContext();
        applyVolume();
        stopAllClips();
        const prayer = els.testAudioPrayer?.value || 'Asr';
        showAudioStatus('Starting Adhan…');
        playAlertChime('warning'); // do not await — overlaps with Adhan start
        const ok = await playAdhanFile(prayer);
        if (ok) {
          showAudioStatus(`Playing ${prayer} Adhan…`);
        }
      } catch (err) {
        console.warn('Test Adhan failed:', err);
        showAudioStatus(`Test Adhan failed: ${err.message}`, 'error');
        await playAlertChime('iqama');
      }
    });
    els.btnTestWarning.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        audioReady = true;
        await ensureAudioContext();
        applyVolume();
        const prayer = els.testAudioPrayer?.value || 'Asr';
        stopAllClips();
        await announceVoice('warning', prayer);
      } catch (err) {
        console.warn('Test Iqama warning failed:', err);
        showAudioStatus(`Voice test failed: ${err.message}`, 'error');
        await playAlertChime('warning');
      }
    });
    els.btnTestIqama?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        audioReady = true;
        await ensureAudioContext();
        applyVolume();
        const prayer = els.testAudioPrayer?.value || 'Asr';
        stopAllClips();
        await announceVoice('iqama', prayer);
      } catch (err) {
        console.warn('Test Iqama voice failed:', err);
        showAudioStatus(`Iqama voice failed: ${err.message}`, 'error');
        await playAlertChime('iqama');
      }
    });
    els.btnStopAudio?.addEventListener('click', () => stopAlarm(true));
    els.btnStopAlarm?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      stopAlarm(true);
    });
    // Clicking the dimmed backdrop area also stops (but not the card text accidentally —
    // only the outer banner outside the card)
    els.alarmBanner?.addEventListener('click', (ev) => {
      if (ev.target === els.alarmBanner) stopAlarm(true);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && els.alarmBanner && !els.alarmBanner.hidden) {
        stopAlarm(true);
      }
    });

    els.testScenarios.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scenario]');
      if (!btn) return;
      startTestScenario(btn.dataset.scenario);
    });

    els.btnClearAlerts.addEventListener('click', () => {
      const parts = getQatarParts(now());
      clearFiredForDate(parts.dateKey);
      alert('Cleared fired alerts for ' + parts.dateKey);
    });

    // Wake / visibility — recalculate immediately
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
  }

  // ============================================================
  // Self-check: 25 September 2026 Iqama math
  // ============================================================

  function verifySeptember25() {
    const key = '2026-09-25';
    const schedule = buildSchedule(key, 2026, 9, 25);
    const expected = {
      Fajr: ['04:04', '04:29'],
      Dhuhr: ['11:29', '11:49'],
      Asr: ['14:53', '15:18'],
      Maghrib: ['17:30', '17:40'],
      Isha: ['19:00', '19:20'],
    };
    const ok = schedule.every((p) => {
      const [a, i] = expected[p.name];
      return p.adhanStr === a && p.iqamaStr === i;
    });
    if (!ok) {
      console.error('September 25 verification FAILED', schedule);
    } else {
      console.info('✓ 25 Sep 2026 Adhan→Iqama verified:', expected);
    }
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    applyVolume();
    bindEvents();
    showEnableOverlayIfNeeded();
    syncSettingsForm();
    verifySeptember25();

    // High-frequency tick: compare real timestamps each second
    tick();
    setInterval(tick, 250);

    // Optional PWA service worker
    // Prefer fresh files over a stale PWA cache (old SW was blocking audio fixes)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then((keys) => {
          keys.forEach((k) => caches.delete(k));
        }).catch(() => {});
      }
      // Re-register a network-first SW after a short delay (optional offline support)
      setTimeout(() => {
        navigator.serviceWorker.register('sw.js?v=6').catch(() => {});
      }, 2500);
    }
  }

  init();
})();
