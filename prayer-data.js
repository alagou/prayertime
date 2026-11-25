/**
 * App constants for the Lusail, Qatar prayer display (Asia/Qatar).
 *
 * Prayer times are no longer a fixed table: they are calculated for every date
 * by prayer-times.js using the Qatar Ministry of Awqaf / Qatar Calendar House
 * method. See prayer-cache/VERIFICATION.md.
 */

const TIMEZONE = 'Asia/Qatar';
const LOCATION_LABEL = 'Lusail, Qatar';

/** Default minutes after Adhan until Iqama (overridable in Settings / localStorage). */
const DEFAULT_IQAMA_INTERVALS = {
  Fajr: 25,
  Dhuhr: 20,
  Asr: 25,
  Maghrib: 10,
  Isha: 20,
};

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/**
 * Audio paths.
 * Adhan: real MP3 recording.
 * Iqama alerts: loud WAV files played via HTMLAudioElement (works on Android;
 * Web Audio oscillators + speechSynthesis are often silent there).
 */
const AUDIO_PATHS = {
  adhan: 'audio/adhan.mp3?v=3',
  iqamaWarning: 'audio/iqama-5-minutes.wav?v=1',
  iqama: 'audio/iqama.wav?v=1',
};

/** Attribution for the bundled Adhan recording. */
const ADHAN_SOURCE = 'https://www.islamcan.com/audio/adhan/azan2.mp3';

const PRAYER_DATA_META = {
  location: 'Lusail, Qatar',
  method: 'Qatar Ministry of Awqaf (Qatar Calendar House), Doha & suburbs',
  calculatedBy: 'prayer-times.js',
};
