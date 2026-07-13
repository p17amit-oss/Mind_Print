// Economy constants (BUILD PROMPT Section 5).

/** Double-or-Bank fires at most 3× per rolling week per user. */
export const DOB_WEEKLY_CAP = 3;

/** Bonus round difficulty bump (staircase steps). */
export const DOB_DIFFICULTY_BUMP = 2;

/**
 * The Chest delay-discounting grid. Each 7th session draws the next (now, later,
 * delay) triple — the grid IS the instrument (no UI explains it). Rotating over
 * months varies the discount points sampled per user.
 */
export const CHEST_GRID: { now_n: number; later_n: number; delay_days: number }[] = [
  { now_n: 5, later_n: 12, delay_days: 3 },
  { now_n: 5, later_n: 10, delay_days: 3 },
  { now_n: 4, later_n: 12, delay_days: 4 },
  { now_n: 6, later_n: 12, delay_days: 3 },
  { now_n: 5, later_n: 15, delay_days: 5 },
  { now_n: 5, later_n: 9, delay_days: 2 },
  { now_n: 4, later_n: 14, delay_days: 4 },
  { now_n: 6, later_n: 10, delay_days: 3 },
];

/** Pick the chest offer for the Nth completed session (only meaningful at N%7===0). */
export function selectChestOffer(completedCount: number) {
  const idx = Math.floor(completedCount / 7 - 1);
  return CHEST_GRID[((idx % CHEST_GRID.length) + CHEST_GRID.length) % CHEST_GRID.length];
}

/** True when a just-completed session should offer a chest (every 7th). */
export function chestDue(completedCount: number): boolean {
  return completedCount > 0 && completedCount % 7 === 0;
}
