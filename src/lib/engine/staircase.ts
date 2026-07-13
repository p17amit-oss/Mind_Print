// Generic adaptive staircase (BUILD PROMPT Section 6). A single integer level
// walks up/down with an n-down / m-up rule; each trial maps level → concrete
// difficulty params. Also serialized into staircase_state across sessions (Step 5).

export interface StaircaseConfig {
  min: number;
  max: number;
  start: number;
  /** consecutive "hard-earned" successes to step harder (level up). */
  down: number;
  /** errors to step easier (level down). */
  up: number;
}

export interface StaircaseState {
  level: number;
  downRun: number; // consecutive successes toward a level-up
  upRun: number; // consecutive failures toward a level-down
}

export function initStaircase(cfg: StaircaseConfig, prior?: Partial<StaircaseState>): StaircaseState {
  return {
    level: clamp(prior?.level ?? cfg.start, cfg.min, cfg.max),
    downRun: prior?.downRun ?? 0,
    upRun: prior?.upRun ?? 0,
  };
}

/** Record one outcome and return the next state (2-down-1-up style). */
export function stepStaircase(
  state: StaircaseState,
  cfg: StaircaseConfig,
  correct: boolean
): StaircaseState {
  let { level, downRun, upRun } = state;
  if (correct) {
    downRun += 1;
    upRun = 0;
    if (downRun >= cfg.down) {
      level = clamp(level + 1, cfg.min, cfg.max);
      downRun = 0;
    }
  } else {
    upRun += 1;
    downRun = 0;
    if (upRun >= cfg.up) {
      level = clamp(level - 1, cfg.min, cfg.max);
      upRun = 0;
    }
  }
  return { level, downRun, upRun };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Linear interpolation from a level index to a numeric param range. */
export function levelLerp(level: number, cfg: StaircaseConfig, from: number, to: number): number {
  const span = cfg.max - cfg.min || 1;
  const t = (clamp(level, cfg.min, cfg.max) - cfg.min) / span;
  return from + (to - from) * t;
}
