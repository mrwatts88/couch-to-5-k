"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtSpoken, KIND_LABEL, totalSeconds, type Workout } from "./plan";
import { beep, say, startKeepAlive, stopKeepAlive, unlockAudio } from "./audio";
import { loadSession, markComplete, saveSession, type Session, type Settings } from "./storage";

export type Status = "idle" | "running" | "paused" | "done";

export interface TimerState {
  status: Status;
  elapsed: number; // whole seconds into the workout
  segmentIndex: number;
  segmentElapsed: number;
  segmentRemaining: number;
  totalRemaining: number;
  resumed: boolean;
}

function computeElapsed(s: Session, now: number): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, (end - s.startedAt - s.pausedTotal) / 1000 + s.skipOffset);
}

export function useWorkoutTimer(workout: Workout, settings: Settings) {
  const total = useMemo(() => totalSeconds(workout), [workout]);
  const bounds = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const seg of workout.segments) {
      starts.push(acc);
      acc += seg.seconds;
    }
    return starts;
  }, [workout]);

  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [resumed, setResumed] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastSegRef = useRef<number>(-1);
  const lastTickRef = useRef<number>(-1);
  const halfwayFiredRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const segmentAt = useCallback(
    (elapsed: number) => {
      let idx = 0;
      for (let i = 0; i < bounds.length; i++) if (elapsed >= bounds[i]) idx = i;
      return elapsed >= total ? workout.segments.length : idx;
    },
    [bounds, total, workout.segments.length],
  );

  // Restore an in-progress session for this workout, if one exists.
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.workoutId === workout.id) {
      const el = computeElapsed(saved, Date.now());
      if (el >= total) {
        saveSession(null);
        return;
      }
      setSession(saved);
      setStatus(saved.pausedAt ? "paused" : "running");
      setResumed(true);
      lastSegRef.current = segmentAt(el);
      halfwayFiredRef.current = el >= total / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id]);

  const elapsedRaw = session ? computeElapsed(session, now) : 0;
  const elapsed = Math.min(total, Math.floor(elapsedRaw));
  const segmentIndex = Math.min(segmentAt(elapsedRaw), workout.segments.length - 1);
  const segStart = bounds[segmentIndex] ?? 0;
  const segLen = workout.segments[segmentIndex]?.seconds ?? 0;
  const segmentElapsed = Math.min(segLen, Math.max(0, elapsedRaw - segStart));
  const segmentRemaining = Math.max(0, Math.ceil(segStart + segLen - elapsedRaw));
  const totalRemaining = Math.max(0, Math.ceil(total - elapsedRaw));

  // ---- Wake lock ----
  const requestWakeLock = useCallback(async () => {
    if (!settingsRef.current.keepAwake) return;
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // denied or unsupported
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    try {
      void wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status, requestWakeLock]);

  // ---- Announce helpers ----
  const announceSegment = useCallback(
    (idx: number) => {
      const s = settingsRef.current;
      const seg = workout.segments[idx];
      if (!seg) return;
      const isLastRun =
        seg.kind === "run" && !workout.segments.slice(idx + 1).some((x) => x.kind === "run");
      if (s.beeps) beep(seg.kind === "run" ? "run" : "walk");
      if (s.voice) {
        const dur = fmtSpoken(seg.seconds);
        let text: string;
        switch (seg.kind) {
          case "warmup":
            text = `Warm up. Walk briskly for ${dur}.`;
            break;
          case "cooldown":
            text = `Cool down. Walk for ${dur}. Nice work.`;
            break;
          case "run":
            text =
              isLastRun && workout.segments.filter((x) => x.kind === "run").length > 1
                ? `Last run. Run for ${dur}.`
                : `Run for ${dur}.`;
            break;
          case "walk":
            text = `Walk for ${dur}.`;
            break;
        }
        // Small delay so the beep isn't clipped by speech.
        window.setTimeout(() => say(text), s.beeps ? 500 : 0);
      }
    },
    [workout.segments],
  );

  const finish = useCallback(() => {
    setStatus("done");
    saveSession(null);
    stopKeepAlive();
    releaseWakeLock();
    const s = settingsRef.current;
    if (s.beeps) beep("done");
    if (s.voice) window.setTimeout(() => say("Workout complete. Great job."), 700);
    markComplete({
      id: workout.id,
      week: workout.week,
      day: workout.day,
      completedAt: new Date().toISOString(),
      durationSec: total,
    });
  }, [workout, total, releaseWakeLock]);

  // ---- Tick loop ----
  useEffect(() => {
    if (status !== "running" || !session) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 200) {
        last = t;
        const n = Date.now();
        setNow(n);
        const el = computeElapsed(session, n);
        const idx = segmentAt(el);
        if (idx >= workout.segments.length) {
          finish();
          return;
        }
        if (idx !== lastSegRef.current) {
          lastSegRef.current = idx;
          lastTickRef.current = -1;
          announceSegment(idx);
        }
        const s = settingsRef.current;
        const remaining = Math.ceil(bounds[idx] + workout.segments[idx].seconds - el);
        if (
          s.countdown &&
          s.beeps &&
          remaining <= 3 &&
          remaining >= 1 &&
          remaining !== lastTickRef.current
        ) {
          lastTickRef.current = remaining;
          beep("tick");
        }
        if (s.halfway && !halfwayFiredRef.current && el >= total / 2) {
          halfwayFiredRef.current = true;
          if (s.beeps) beep("halfway");
          if (s.voice) window.setTimeout(() => say("Halfway there."), 300);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, session, segmentAt, announceSegment, finish, bounds, total, workout.segments]);

  // ---- Controls ----
  const start = useCallback(() => {
    unlockAudio();
    startKeepAlive();
    void requestWakeLock();
    const s: Session = {
      workoutId: workout.id,
      startedAt: Date.now(),
      pausedAt: null,
      pausedTotal: 0,
      skipOffset: 0,
    };
    lastSegRef.current = -1;
    lastTickRef.current = -1;
    halfwayFiredRef.current = false;
    saveSession(s);
    setSession(s);
    setNow(s.startedAt);
    setStatus("running");
  }, [workout.id, requestWakeLock]);

  const pause = useCallback(() => {
    if (!session || status !== "running") return;
    const s = { ...session, pausedAt: Date.now() };
    saveSession(s);
    setSession(s);
    setStatus("paused");
    stopKeepAlive();
    releaseWakeLock();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }, [session, status, releaseWakeLock]);

  const resume = useCallback(() => {
    if (!session || status !== "paused" || session.pausedAt == null) return;
    unlockAudio();
    startKeepAlive();
    void requestWakeLock();
    const s: Session = {
      ...session,
      pausedTotal: session.pausedTotal + (Date.now() - session.pausedAt),
      pausedAt: null,
    };
    saveSession(s);
    setSession(s);
    setNow(Date.now());
    setStatus("running");
  }, [session, status, requestWakeLock]);

  const skip = useCallback(() => {
    if (!session || status === "idle" || status === "done") return;
    const el = computeElapsed(session, Date.now());
    const idx = segmentAt(el);
    const end = (bounds[idx] ?? 0) + (workout.segments[idx]?.seconds ?? 0);
    const s = { ...session, skipOffset: session.skipOffset + (end - el) + 0.001 };
    saveSession(s);
    setSession(s);
    setNow(Date.now());
  }, [session, status, segmentAt, bounds, workout.segments]);

  const back = useCallback(() => {
    if (!session || status === "idle" || status === "done") return;
    const el = computeElapsed(session, Date.now());
    const idx = segmentAt(el);
    const start = bounds[idx] ?? 0;
    // Restart current segment if more than 3s in, otherwise jump to previous.
    const target = el - start > 3 ? start : bounds[Math.max(0, idx - 1)];
    const s = { ...session, skipOffset: session.skipOffset - (el - target) };
    lastSegRef.current = -1; // re-announce
    saveSession(s);
    setSession(s);
    setNow(Date.now());
  }, [session, status, segmentAt, bounds]);

  const abandon = useCallback(() => {
    saveSession(null);
    stopKeepAlive();
    releaseWakeLock();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    setSession(null);
    setStatus("idle");
    setResumed(false);
  }, [releaseWakeLock]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopKeepAlive();
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const state: TimerState = {
    status,
    elapsed,
    segmentIndex,
    segmentElapsed,
    segmentRemaining,
    totalRemaining,
    resumed,
  };

  return { state, total, bounds, start, pause, resume, skip, back, abandon, KIND_LABEL };
}
