// read_room local seed bank (BUILD PROMPT Section 6.5). Production distributions
// come from room_answers / jury_verdicts (seeded via /api/seed-answers from a
// panel run); these embedded distributions keep the trial playable in dev.

export type RoomCategory = "aesthetic" | "estimate" | "would_rather" | "dilemma_jury";

export interface RoomStandardItem {
  item_id: string;
  category: Exclude<RoomCategory, "dilemma_jury">;
  prompt: string;
  options: string[]; // 4
  distribution: number[]; // crowd counts per option
  sponsor?: string | null;
}

export interface RoomJuryItem {
  item_id: string;
  category: "dilemma_jury";
  scenario: string;
  verdictOptions: string[]; // 2–4
  verdictDistribution: number[]; // crowd verdict counts
  sponsor?: string | null;
}

export type RoomItem = RoomStandardItem | RoomJuryItem;

export const STANDARD_ITEMS: RoomStandardItem[] = [
  {
    item_id: "rr_aes_01",
    category: "aesthetic",
    prompt: "Which door does the crowd pick?",
    options: ["Deep teal", "Warm gold", "Matte black", "Bone white"],
    distribution: [120, 210, 90, 60],
  },
  {
    item_id: "rr_est_01",
    category: "estimate",
    prompt: "Most players guessed the jar holds…",
    options: ["~120", "~240", "~480", "~900"],
    distribution: [70, 260, 140, 40],
  },
  {
    item_id: "rr_wr_01",
    category: "would_rather",
    prompt: "The crowd would rather…",
    options: ["Read minds", "Be invisible", "Fly", "Rewind an hour"],
    distribution: [150, 130, 190, 110],
  },
  {
    item_id: "rr_aes_02",
    category: "aesthetic",
    prompt: "Which name feels fastest to most?",
    options: ["Vale", "Rune", "Zip", "Moss"],
    distribution: [90, 110, 300, 70],
  },
  {
    item_id: "rr_est_02",
    category: "estimate",
    prompt: "Most think a typical song lasts…",
    options: ["2:10", "3:30", "4:45", "6:00"],
    distribution: [110, 320, 120, 30],
  },
];

export const JURY_ITEMS: RoomJuryItem[] = [
  {
    item_id: "rr_jury_01",
    category: "dilemma_jury",
    scenario:
      "An AI assistant quietly corrected a user's factual error in an email draft without mentioning it. Acceptable?",
    verdictOptions: ["Fine", "Should've flagged it", "Not okay"],
    verdictDistribution: [180, 240, 90],
  },
  {
    item_id: "rr_jury_02",
    category: "dilemma_jury",
    scenario:
      "An AI tutor let a struggling student win a game to keep them motivated, without saying so. Acceptable?",
    verdictOptions: ["Kind", "Manipulative", "Depends"],
    verdictDistribution: [210, 130, 170],
  },
];

export function isJury(item: RoomItem): item is RoomJuryItem {
  return item.category === "dilemma_jury";
}

export function modalIndex(dist: number[]): number {
  let best = 0;
  for (let i = 1; i < dist.length; i++) if (dist[i] > dist[best]) best = i;
  return best;
}

/** Build a 3-question run: up to 1 jury item + standard items, shuffled. */
export function buildRoomRun(rand: () => number = Math.random): RoomItem[] {
  const jury = JURY_ITEMS[Math.floor(rand() * JURY_ITEMS.length)];
  const standards = [...STANDARD_ITEMS].sort(() => rand() - 0.5).slice(0, 2);
  return [jury, ...standards].sort(() => rand() - 0.5);
}
