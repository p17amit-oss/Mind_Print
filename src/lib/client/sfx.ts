// Juice: every tap has audio (BUILD PROMPT Section 12).
// Synthesized via WebAudio so no assets are required to feel alive. When real
// audio ships, swap these for Howler-loaded sprites behind the same play() API.
"use client";

type Cue =
  | "tap"
  | "combo"
  | "shatter"
  | "win"
  | "loss"
  | "chime" // fooled correct
  | "glitch" // fooled wrong / mutation
  | "fog" // fog clear
  | "chest"
  | "lock";

const MUTE_KEY = "mp_muted";
let ctx: AudioContext | null = null;

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(m: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, when = 0) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const RECIPES: Record<Cue, () => void> = {
  tap: () => tone(520, 0.06, "sine", 0.06),
  combo: () => {
    tone(660, 0.08, "triangle", 0.07);
    tone(990, 0.1, "triangle", 0.05, 0.05);
  },
  shatter: () => {
    tone(180, 0.18, "sawtooth", 0.06);
    tone(90, 0.22, "square", 0.04, 0.02);
  },
  win: () => {
    tone(523, 0.1, "triangle", 0.07);
    tone(659, 0.1, "triangle", 0.07, 0.09);
    tone(784, 0.16, "triangle", 0.07, 0.18);
  },
  loss: () => tone(196, 0.24, "sine", 0.06),
  chime: () => {
    tone(880, 0.08, "sine", 0.06);
    tone(1320, 0.12, "sine", 0.05, 0.06);
  },
  glitch: () => {
    tone(140, 0.05, "square", 0.06);
    tone(300, 0.05, "sawtooth", 0.05, 0.03);
    tone(90, 0.08, "square", 0.05, 0.06);
  },
  fog: () => {
    tone(392, 0.5, "sine", 0.05);
    tone(588, 0.6, "sine", 0.035, 0.1);
  },
  chest: () => {
    tone(330, 0.15, "triangle", 0.07);
    tone(440, 0.15, "triangle", 0.07, 0.12);
    tone(660, 0.3, "triangle", 0.08, 0.26);
    tone(880, 0.4, "sine", 0.06, 0.42);
  },
  lock: () => {
    tone(740, 0.1, "sine", 0.06);
    tone(1108, 0.2, "sine", 0.05, 0.08);
  },
};

export function sfx(cue: Cue) {
  if (isMuted()) return;
  try {
    RECIPES[cue]?.();
  } catch {
    /* audio is best-effort */
  }
}
