"use client";

/**
 * Audio cues for iOS Safari / home-screen PWAs.
 *
 * - Everything is unlocked inside the Start tap (user gesture).
 * - navigator.audioSession.type = "playback" lets cues play with the silent
 *   switch on (iOS 17+).
 * - A looping silent track keeps the audio session alive so timers and cues
 *   keep firing if the screen locks or you switch apps mid-run.
 */

let ctx: AudioContext | null = null;
let keepAlive: HTMLAudioElement | null = null;
let unlocked = false;

function silentWavUrl(seconds = 1, rate = 8000): string {
  const samples = seconds * rate;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    // not supported
  }
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    // Play a zero-length buffer to fully unlock on iOS.
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }
  try {
    if ("speechSynthesis" in window && !unlocked) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    // ignore
  }
  unlocked = true;
}

export function startKeepAlive() {
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentWavUrl());
      keepAlive.loop = true;
      keepAlive.volume = 0.01;
      keepAlive.setAttribute("playsinline", "");
    }
    void keepAlive.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function stopKeepAlive() {
  try {
    keepAlive?.pause();
  } catch {
    // ignore
  }
}

function tone(freq: number, at: number, dur: number, gain = 0.5) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.setValueAtTime(gain, at + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export type BeepKind = "run" | "walk" | "tick" | "done" | "halfway";

export function beep(kind: BeepKind) {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime + 0.01;
  switch (kind) {
    case "run":
      tone(880, t, 0.12);
      tone(1175, t + 0.15, 0.12);
      tone(1568, t + 0.3, 0.2);
      break;
    case "walk":
      tone(660, t, 0.18);
      tone(440, t + 0.22, 0.28);
      break;
    case "tick":
      tone(1000, t, 0.06, 0.35);
      break;
    case "halfway":
      tone(740, t, 0.1);
      tone(740, t + 0.14, 0.1);
      break;
    case "done":
      tone(784, t, 0.12);
      tone(988, t + 0.14, 0.12);
      tone(1175, t + 0.28, 0.12);
      tone(1568, t + 0.42, 0.4);
      break;
  }
}

export function say(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}
