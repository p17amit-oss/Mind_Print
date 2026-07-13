// neon_stream word bank (BUILD PROMPT Section 6.1). Real words + 3 fake tiers:
// tier 1 letterstrings, tier 2 pseudowords, tier 3 one-letter-off near-words.
// (The full 300-word production bank ships via Airtable; this is the local set.)

export const REAL_WORDS: string[] = [
  "river", "candle", "planet", "silver", "garden", "window", "pocket", "forest",
  "bridge", "market", "engine", "pillow", "orange", "signal", "hollow", "meadow",
  "castle", "velvet", "copper", "harbor", "sunset", "purple", "ribbon", "ladder",
  "island", "circle", "mirror", "temple", "flavor", "wisdom", "anchor", "beacon",
  "cinema", "dragon", "ember", "fabric", "glance", "hunter", "ivory", "jungle",
  "kernel", "lantern", "marble", "nectar", "onyx", "prism", "quartz", "ripple",
  "saddle", "thistle", "umber", "violet", "walnut", "yonder", "zephyr", "amber",
];

const TIER1 = "bcdfghjklmnpqrstvwxz"; // consonant-heavy letterstrings
const VOWELS = "aeiou";

/** tier 1: unpronounceable letterstrings. */
function letterstring(len: number, rand: () => number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += TIER1[Math.floor(rand() * TIER1.length)];
  return s;
}

/** tier 2: pronounceable pseudowords (alternating CV). */
function pseudoword(len: number, rand: () => number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const pool = i % 2 === 0 ? "bcdfghjklmnprstv" : VOWELS;
    s += pool[Math.floor(rand() * pool.length)];
  }
  return s;
}

/** tier 3: one-letter-off from a real word (hardest). */
function oneLetterOff(rand: () => number): string {
  const w = REAL_WORDS[Math.floor(rand() * REAL_WORDS.length)];
  const i = Math.floor(rand() * w.length);
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let c = alphabet[Math.floor(rand() * 26)];
  while (c === w[i]) c = alphabet[Math.floor(rand() * 26)];
  return w.slice(0, i) + c + w.slice(i + 1);
}

export function makeFake(tier: 1 | 2 | 3, rand: () => number = Math.random): string {
  const len = 5 + Math.floor(rand() * 2);
  if (tier === 1) return letterstring(len, rand);
  if (tier === 2) return pseudoword(len, rand);
  return oneLetterOff(rand);
}

export function makeReal(rand: () => number = Math.random): string {
  return REAL_WORDS[Math.floor(rand() * REAL_WORDS.length)];
}
