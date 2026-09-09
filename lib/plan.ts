export type SegmentKind = "warmup" | "run" | "walk" | "cooldown";

export interface Segment {
  kind: SegmentKind;
  seconds: number;
}

export interface Workout {
  week: number;
  day: number;
  id: string;
  summary: string;
  segments: Segment[];
}

const min = (m: number) => Math.round(m * 60);

const WARMUP: Segment = { kind: "warmup", seconds: min(5) };
const COOLDOWN: Segment = { kind: "cooldown", seconds: min(5) };
const run = (m: number): Segment => ({ kind: "run", seconds: min(m) });
const walk = (m: number): Segment => ({ kind: "walk", seconds: min(m) });

/** Alternate run/walk `reps` times, ending on a run (no trailing walk). */
function alternate(runMin: number, walkMin: number, reps: number): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < reps; i++) {
    out.push(run(runMin));
    if (i < reps - 1) out.push(walk(walkMin));
  }
  return out;
}

function wrap(main: Segment[]): Segment[] {
  return [WARMUP, ...main, COOLDOWN];
}

// NHS Couch to 5K, 9 weeks x 3 runs. Every session opens with a brisk 5-minute
// warm-up walk and closes with a 5-minute cool-down walk.
const weekBodies: Record<number, Segment[][]> = {
  1: Array(3).fill(alternate(1, 1.5, 8)),
  2: Array(3).fill(alternate(1.5, 2, 6)),
  3: Array(3).fill([run(1.5), walk(1.5), run(3), walk(3), run(1.5), walk(1.5), run(3)]),
  4: Array(3).fill([run(3), walk(1.5), run(5), walk(2.5), run(3), walk(1.5), run(5)]),
  5: [[run(5), walk(3), run(5), walk(3), run(5)], [run(8), walk(5), run(8)], [run(20)]],
  6: [[run(5), walk(3), run(8), walk(3), run(5)], [run(10), walk(3), run(10)], [run(25)]],
  7: Array(3).fill([run(25)]),
  8: Array(3).fill([run(28)]),
  9: Array(3).fill([run(30)]),
};

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function fmtDuration(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)}½ min`;
}

export function fmtSpoken(seconds: number): string {
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} ${m === 1 ? "minute" : "minutes"} ${s} seconds`;
}

function summarize(body: Segment[]): string {
  const runs = body.filter((s) => s.kind === "run");
  const walks = body.filter((s) => s.kind === "walk");
  if (runs.length === 1) return `Run ${fmtDuration(runs[0].seconds)} straight`;
  const uniform =
    runs.every((r) => r.seconds === runs[0].seconds) &&
    walks.every((w) => w.seconds === walks[0].seconds);
  if (uniform) {
    return `Run ${fmtDuration(runs[0].seconds)}, walk ${fmtDuration(walks[0].seconds)} × ${runs.length}`;
  }
  const short = (sec: number) => (sec % 60 === 0 ? `${sec / 60}` : `${Math.floor(sec / 60)}½`);
  return `Runs ${runs.map((r) => short(r.seconds)).join(" · ")} min, walks between`;
}

export const WORKOUTS: Workout[] = Object.entries(weekBodies).flatMap(([week, bodies]) =>
  bodies.map((body, i) => ({
    week: Number(week),
    day: i + 1,
    id: `w${week}d${i + 1}`,
    summary: summarize(body),
    segments: wrap(body),
  })),
);

export const WEEKS = Array.from({ length: 9 }, (_, i) => i + 1);

export function getWorkout(week: number, day: number): Workout | undefined {
  return WORKOUTS.find((w) => w.week === week && w.day === day);
}

export function totalSeconds(w: Workout): number {
  return w.segments.reduce((a, s) => a + s.seconds, 0);
}

export function runSeconds(w: Workout): number {
  return w.segments.filter((s) => s.kind === "run").reduce((a, s) => a + s.seconds, 0);
}

export function nextWorkout(w: Workout): Workout | undefined {
  const idx = WORKOUTS.findIndex((x) => x.id === w.id);
  return WORKOUTS[idx + 1];
}

export const KIND_LABEL: Record<SegmentKind, string> = {
  warmup: "Warm up",
  run: "Run",
  walk: "Walk",
  cooldown: "Cool down",
};
