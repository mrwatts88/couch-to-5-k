"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fmtClock,
  fmtDuration,
  KIND_LABEL,
  nextWorkout,
  runSeconds,
  type SegmentKind,
  type Workout,
} from "@/lib/plan";
import { useStore } from "@/lib/storage";
import { useWorkoutTimer } from "@/lib/useWorkoutTimer";

const KIND_BG: Record<SegmentKind, string> = {
  warmup: "bg-sky-700",
  walk: "bg-sky-600",
  run: "bg-orange-600",
  cooldown: "bg-teal-700",
};

const KIND_BAR: Record<SegmentKind, string> = {
  warmup: "bg-sky-400",
  walk: "bg-sky-400",
  run: "bg-orange-400",
  cooldown: "bg-teal-400",
};

export default function WorkoutScreen({ workout }: { workout: Workout }) {
  const { settings } = useStore();
  const { state, total, bounds, start, pause, resume, skip, back, abandon } = useWorkoutTimer(
    workout,
    settings,
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const seg = workout.segments[state.segmentIndex];
  const next = workout.segments[state.segmentIndex + 1];
  const active = state.status === "running" || state.status === "paused";
  const bg = active ? KIND_BG[seg.kind] : "bg-neutral-950";
  const upcoming = nextWorkout(workout);

  return (
    <main
      className={`flex h-dvh flex-col overflow-hidden text-white transition-colors duration-500 ${bg}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-3">
          <Link
            href="/"
            onClick={(e) => {
              if (active && !confirm("Leave this run? Progress is saved and you can resume.")) {
                e.preventDefault();
              }
            }}
            className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium active:bg-white/30"
          >
            ← Home
          </Link>
          <div className="text-sm font-semibold uppercase tracking-widest opacity-80">
            Week {workout.week} · Run {workout.day}
          </div>
          <div className="w-16 text-right text-sm tabular-nums opacity-80">
            {active ? `-${fmtClock(state.totalRemaining)}` : fmtClock(total)}
          </div>
        </header>

        {/* Timeline */}
        <div className="px-5">
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-black/30">
            {workout.segments.map((s, i) => {
              const startS = bounds[i];
              const fill = Math.min(1, Math.max(0, (state.elapsed - startS) / s.seconds));
              return (
                <div key={i} className="relative h-full bg-white/15" style={{ flex: s.seconds }}>
                  <div
                    className={`absolute inset-y-0 left-0 ${KIND_BAR[s.kind]} ${
                      i === state.segmentIndex && active ? "opacity-100" : "opacity-70"
                    }`}
                    style={{ width: `${active || state.status === "done" ? fill * 100 : 0}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {state.status === "idle" && (
          <section className="flex min-h-0 flex-1 flex-col px-5 pt-6">
            <h1 className="text-3xl font-bold">{workout.summary}</h1>
            <p className="mt-1 text-white/70">
              {fmtDuration(total)} total · {fmtDuration(runSeconds(workout))} running
            </p>
            {mounted && state.resumed && (
              <p className="mt-3 rounded-xl bg-amber-500/20 px-3 py-2 text-sm text-amber-200">
                Found an unfinished run. Tap Resume to pick it back up.
              </p>
            )}
            <ol className="mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {workout.segments.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${KIND_BAR[s.kind]}`} />
                    <span className="font-medium">{KIND_LABEL[s.kind]}</span>
                  </span>
                  <span className="tabular-nums text-white/70">{fmtClock(s.seconds)}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={start}
              className="mt-6 mb-4 w-full rounded-2xl bg-orange-500 py-5 text-2xl font-bold shadow-lg shadow-orange-900/40 active:bg-orange-400"
            >
              Start
            </button>
          </section>
        )}

        {active && (
          <section className="flex flex-1 flex-col items-center justify-center px-5">
            <div className="text-xl font-semibold uppercase tracking-[0.3em] opacity-80">
              {KIND_LABEL[seg.kind]}
            </div>
            <div className="mt-2 text-[6.5rem] leading-none font-black tabular-nums">
              {fmtClock(state.segmentRemaining)}
            </div>
            <div className="mt-4 text-base opacity-80">
              {next ? (
                <>
                  Next: <span className="font-semibold">{KIND_LABEL[next.kind]}</span>{" "}
                  {fmtClock(next.seconds)}
                </>
              ) : (
                <>Last segment</>
              )}
            </div>
            <div className="mt-1 text-sm opacity-60">
              Segment {state.segmentIndex + 1} of {workout.segments.length} ·{" "}
              {fmtClock(state.elapsed)} elapsed
            </div>
            {state.status === "paused" && (
              <div className="mt-6 rounded-full bg-black/30 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest">
                Paused
              </div>
            )}
          </section>
        )}

        {active && (
          <section className="px-5 pb-4">
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={back}
                className="rounded-2xl bg-black/25 py-4 text-lg font-semibold active:bg-black/40"
                aria-label="Back one segment"
              >
                ⏮
              </button>
              {state.status === "running" ? (
                <button
                  onClick={pause}
                  className="col-span-2 rounded-2xl bg-white text-neutral-900 py-4 text-xl font-bold active:bg-white/80"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={resume}
                  className="col-span-2 rounded-2xl bg-white text-neutral-900 py-4 text-xl font-bold active:bg-white/80"
                >
                  Resume
                </button>
              )}
              <button
                onClick={skip}
                className="rounded-2xl bg-black/25 py-4 text-lg font-semibold active:bg-black/40"
                aria-label="Skip segment"
              >
                ⏭
              </button>
            </div>
            {confirmEnd ? (
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="flex-1 rounded-2xl bg-black/25 py-3 font-semibold"
                >
                  Keep going
                </button>
                <button
                  onClick={() => {
                    setConfirmEnd(false);
                    abandon();
                  }}
                  className="flex-1 rounded-2xl bg-red-600 py-3 font-semibold"
                >
                  End run
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                className="mt-3 w-full rounded-2xl py-3 text-sm font-medium text-white/70"
              >
                End without saving
              </button>
            )}
          </section>
        )}

        {state.status === "done" && (
          <section className="flex flex-1 flex-col items-center justify-center px-5 text-center">
            <div className="text-6xl">🎉</div>
            <h1 className="mt-4 text-3xl font-bold">Run complete</h1>
            <p className="mt-2 text-white/70">
              Week {workout.week}, run {workout.day} is in the books.
              <br />
              {fmtDuration(runSeconds(workout))} of running.
            </p>
            <div className="mt-8 w-full space-y-3">
              {upcoming ? (
                <Link
                  href={`/run/${upcoming.week}/${upcoming.day}/`}
                  className="block w-full rounded-2xl bg-orange-500 py-4 text-lg font-bold active:bg-orange-400"
                >
                  Next: Week {upcoming.week} · Run {upcoming.day}
                </Link>
              ) : (
                <p className="text-lg font-semibold">You finished Couch to 5K. 🏅</p>
              )}
              <Link
                href="/"
                className="block w-full rounded-2xl bg-white/10 py-4 text-lg font-semibold active:bg-white/20"
              >
                Home
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
