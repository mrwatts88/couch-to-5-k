# Couch to 5K

Personal, single-user Couch to 5K PWA for iPhone. Static Next.js export, no backend;
progress and settings live in `localStorage` with a JSON export/import as a backup.

## Plan

Nine weeks × three runs, from the NHS Couch to 5K plan. Every run opens with a
5-minute warm-up walk and closes with a 5-minute cool-down walk.

| Week | Body of the run |
| ---- | --------------- |
| 1 | Run 1:00 / walk 1:30 × 8 |
| 2 | Run 1:30 / walk 2:00 × 6 |
| 3 | Run 1:30, walk 1:30, run 3:00, walk 3:00, run 1:30, walk 1:30, run 3:00 |
| 4 | Run 3, walk 1:30, run 5, walk 2:30, run 3, walk 1:30, run 5 |
| 5 | R1: 5/3/5/3/5 · R2: 8/5/8 · R3: run 20 |
| 6 | R1: 5/3/8/3/5 · R2: 10/3/10 · R3: run 25 |
| 7 | Run 25 |
| 8 | Run 28 |
| 9 | Run 30 |

Data lives in `lib/plan.ts`.

## Layout

- `lib/plan.ts` — workouts as segment lists.
- `lib/storage.ts` — localStorage store (`useStore`), completed runs, settings, in-progress session.
- `lib/audio.ts` — Web Audio beeps, speech cues, iOS audio-session unlock and silent keep-alive loop.
- `lib/useWorkoutTimer.ts` — wall-clock timer, cue scheduling, wake lock, pause/skip/back/resume.
- `components/WorkoutScreen.tsx` — the run screen.
- `components/Home.tsx` — plan grid, next-up card, settings, backup.
- `public/sw.js` — offline-first service worker (registered in production only).

## Dev

```
npm run dev
npm run build   # static export to out/
npx vercel deploy --prod
```

## iPhone notes

- Install via Safari → Share → Add to Home Screen. Open from the icon for standalone mode and offline use.
- The screen wake lock keeps the display on during a run; that is the reliable path for cues on iOS.
- Timing is wall-clock based, so backgrounding the app doesn't drift the timer; an unfinished run can be resumed from the home screen.
