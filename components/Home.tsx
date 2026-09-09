"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtDuration, runSeconds, totalSeconds, WEEKS, WORKOUTS, type Workout } from "@/lib/plan";
import {
  exportJSON,
  importJSON,
  isDone,
  loadSession,
  resetAll,
  unmarkComplete,
  markComplete,
  updateSettings,
  useStore,
  type Settings,
} from "@/lib/storage";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const store = useStore();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inProgress, setInProgress] = useState<Workout | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const s = loadSession();
    if (s) setInProgress(WORKOUTS.find((w) => w.id === s.workoutId) ?? null);
  }, [store]);

  const completedCount = store.completed.length;
  const nextUp = WORKOUTS.find((w) => !isDone(store, w.id)) ?? WORKOUTS[WORKOUTS.length - 1];
  const allDone = completedCount >= WORKOUTS.length;
  const last = [...store.completed].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const featured = inProgress ?? nextUp;

  const toggle = (k: keyof Settings) => updateSettings({ [k]: !store.settings[k] });

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
      }}
    >
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight">Couch to 5K</h1>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium active:bg-white/20"
        >
          {showSettings ? "Done" : "Settings"}
        </button>
      </header>

      {showSettings ? (
        <section className="mt-6 space-y-6">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">
              Cues
            </h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {(
                [
                  ["voice", "Voice announcements"],
                  ["beeps", "Beeps"],
                  ["countdown", "3-2-1 ticks before each change"],
                  ["halfway", "Halfway announcement"],
                  ["keepAwake", "Keep screen on during run"],
                ] as [keyof Settings, string][]
              ).map(([k, label]) => (
                <li key={k}>
                  <button
                    onClick={() => toggle(k)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span>{label}</span>
                    <span
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        store.settings[k] ? "bg-orange-500" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                          store.settings[k] ? "translate-x-5.5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-1 text-xs text-white/40">
              Voice and beeps play through headphones or the speaker even with the silent switch on.
              Keeping the screen on is the most reliable way to make sure cues fire on iPhone.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">
              Progress
            </h2>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              <li>
                <button
                  onClick={() => {
                    setEditMode((v) => !v);
                    setShowSettings(false);
                  }}
                  className="w-full px-4 py-3.5 text-left"
                >
                  Manually mark runs done / undone
                </button>
              </li>
              <li>
                <button
                  onClick={async () => {
                    const text = exportJSON();
                    try {
                      if (navigator.share) {
                        const file = new File([text], "couch-to-5k-backup.json", {
                          type: "application/json",
                        });
                        await navigator.share({ files: [file], title: "Couch to 5K backup" });
                        return;
                      }
                    } catch {
                      // fall through to clipboard
                    }
                    try {
                      await navigator.clipboard.writeText(text);
                      alert("Backup copied to clipboard.");
                    } catch {
                      alert(text);
                    }
                  }}
                  className="w-full px-4 py-3.5 text-left"
                >
                  Export backup
                </button>
              </li>
              <li>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full px-4 py-3.5 text-left"
                >
                  Import backup
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const ok = importJSON(await f.text());
                    alert(ok ? "Backup restored." : "That file didn't look like a backup.");
                    e.target.value = "";
                  }}
                />
              </li>
              <li>
                {confirmReset ? (
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-red-300">Erase all progress?</span>
                    <span className="flex gap-2">
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          resetAll();
                          setConfirmReset(false);
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold"
                      >
                        Erase
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full px-4 py-3.5 text-left text-red-300"
                  >
                    Reset all progress
                  </button>
                )}
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">
              Install on iPhone
            </h2>
            <p className="rounded-2xl bg-white/5 px-4 py-3.5 text-sm text-white/70">
              In Safari, tap the Share button, then <b>Add to Home Screen</b>. Open it from the home
              screen icon so it runs full-screen and works offline.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* Next up */}
          <Link
            href={`/run/${featured.week}/${featured.day}/`}
            className="mt-6 block rounded-3xl bg-gradient-to-br from-orange-500 to-rose-600 p-5 shadow-xl shadow-orange-950/40 active:scale-[0.99]"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-white/80">
              {mounted && inProgress
                ? "Resume run"
                : allDone
                  ? "Graduated · run it again"
                  : "Next up"}
            </div>
            <div className="mt-1 text-3xl font-black">
              Week {featured.week} · Run {featured.day}
            </div>
            <div className="mt-2 text-white/90">{featured.summary}</div>
            <div className="mt-4 flex items-center justify-between text-sm text-white/80">
              <span>
                {fmtDuration(totalSeconds(featured))} total · {fmtDuration(runSeconds(featured))}{" "}
                running
              </span>
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">
                {mounted && inProgress ? "Resume →" : "Start →"}
              </span>
            </div>
          </Link>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="text-2xl font-bold tabular-nums">
                {mounted ? completedCount : "–"}
                <span className="text-sm font-normal text-white/50">/{WORKOUTS.length}</span>
              </div>
              <div className="text-xs text-white/50">runs done</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="text-2xl font-bold tabular-nums">
                {mounted ? Math.round((completedCount / WORKOUTS.length) * 100) : "–"}%
              </div>
              <div className="text-xs text-white/50">complete</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="text-base font-bold leading-8">
                {mounted && last ? fmtDate(last.completedAt) : "—"}
              </div>
              <div className="text-xs text-white/50">last run</div>
            </div>
          </div>

          {editMode && (
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200">
              <span>Tap a run to toggle it done.</span>
              <button
                onClick={() => setEditMode(false)}
                className="rounded-lg bg-amber-500/30 px-2.5 py-1 font-semibold"
              >
                Done
              </button>
            </div>
          )}

          {/* Plan grid */}
          <section className="mt-6 space-y-3">
            {WEEKS.map((week) => {
              const runs = WORKOUTS.filter((w) => w.week === week);
              const weekDone = runs.every((w) => isDone(store, w.id));
              return (
                <div
                  key={week}
                  className={`rounded-2xl bg-white/5 p-3 ${
                    mounted && weekDone ? "opacity-60" : ""
                  }`}
                >
                  <div className="mb-2 px-1">
                    <span className="font-bold">Week {week}</span>
                    <span className="ml-2 text-xs text-white/50">{runs[0].summary}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {runs.map((w) => {
                      const done = mounted && isDone(store, w.id);
                      const isNext = mounted && !editMode && w.id === featured.id;
                      const cls = `flex flex-col items-center justify-center rounded-xl py-3 text-sm font-semibold ${
                        done
                          ? "bg-emerald-600/70 text-white"
                          : isNext
                            ? "bg-orange-500 text-white"
                            : "bg-white/10 text-white/80"
                      }`;
                      const inner = (
                        <>
                          <span>{done ? "✓" : `Run ${w.day}`}</span>
                          <span className="mt-0.5 text-[11px] font-normal opacity-70">
                            {done ? `Run ${w.day}` : `${Math.round(totalSeconds(w) / 60)} min`}
                          </span>
                        </>
                      );
                      return editMode ? (
                        <button
                          key={w.id}
                          className={cls}
                          onClick={() =>
                            done
                              ? unmarkComplete(w.id)
                              : markComplete({
                                  id: w.id,
                                  week: w.week,
                                  day: w.day,
                                  completedAt: new Date().toISOString(),
                                  durationSec: totalSeconds(w),
                                })
                          }
                        >
                          {inner}
                        </button>
                      ) : (
                        <Link key={w.id} href={`/run/${w.week}/${w.day}/`} className={cls}>
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <p className="mt-8 text-center text-xs text-white/30">
            Based on the NHS Couch to 5K plan. Three runs a week, rest day between.
          </p>
        </>
      )}
    </main>
  );
}
