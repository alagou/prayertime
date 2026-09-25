# Audio

## Adhan
`adhan.mp3` — IslamCan azan2 recording.

## Iqama alerts (required for Android)
These play via HTML `<audio>` (same mechanism as Adhan), because Web Audio tones and speech synthesis are often **silent on Android**:

| File | When |
|------|------|
| `iqama-5-minutes.wav` | 5 minutes before Iqama |
| `iqama.wav` | At Iqama time |

Replace them with your own recordings if you want spoken voice files; keep the same filenames or update `AUDIO_PATHS` in `prayer-data.js`.
