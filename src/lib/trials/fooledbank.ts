// fooled local seed bank (BUILD PROMPT Section 6.6). Every item carries
// provenance. Human items MUST have rights + source_ref (enforced by
// validateFooledItem). The production bank (200 images + 200 texts, rights-clean)
// ships via Airtable; image items here are clearly-marked dev SVG placeholders.
import type { Provenance } from "../server/item-validation";

export type Modality = "image" | "text";

export interface FooledItem {
  item_id: string;
  modality: Modality;
  /** true = AI-made (FAKE), false = human-made (REAL). */
  isFake: boolean;
  /** fake_quality_tier 1→4 (obvious → frontier); only meaningful for fakes. */
  tier: 1 | 2 | 3 | 4;
  /** text content, or an SVG placeholder descriptor for images. */
  text?: string;
  imageSeed?: number;
  provenance: Provenance;
  generator_model?: string | null;
}

const human = (rights: Provenance["rights"], ref: string, created: string): Provenance => ({
  source_type: "human",
  rights,
  source_ref: ref,
  created,
});
const ai = (created: string): Provenance => ({ source_type: "ai", created });

export const FOOLED_TEXTS: FooledItem[] = [
  {
    item_id: "f_txt_h1",
    modality: "text",
    isFake: false,
    tier: 1,
    text: "We got the boat in before the rain. My uncle swore the storm would hold off until noon, and for once he was wrong by two whole hours.",
    provenance: human("public_domain", "diary/pd-1931", "1931"),
  },
  {
    item_id: "f_txt_h2",
    modality: "text",
    isFake: false,
    tier: 2,
    text: "The recipe card is in her handwriting, smudged where the butter got to it. It just says 'bake until it smells right,' which is not a temperature but somehow always works.",
    provenance: human("licensed", "contrib/marta-k", "2018"),
  },
  {
    item_id: "f_txt_h3",
    modality: "text",
    isFake: false,
    tier: 3,
    text: "He never learned to whistle. Forty years of trying, air hissing past his teeth, and the dog still came running anyway.",
    provenance: human("commissioned", "commission/short-2024", "2024"),
  },
  {
    item_id: "f_txt_h4",
    modality: "text",
    isFake: false,
    tier: 4,
    text: "Traffic was bad, so I read the whole plaque twice.",
    provenance: human("public_domain", "note/pd-collection", "2011"),
  },
  {
    item_id: "f_txt_a1",
    modality: "text",
    isFake: true,
    tier: 1,
    text: "In today's fast-paced world, embracing the journey of self-discovery can unlock a myriad of transformative possibilities for personal growth and holistic well-being.",
    generator_model: "textgen-a-v2",
    provenance: ai("last month"),
  },
  {
    item_id: "f_txt_a2",
    modality: "text",
    isFake: true,
    tier: 2,
    text: "The old lighthouse stood as a beacon of hope, its unwavering light a testament to the resilience that dwells within us all, guiding weary travelers safely home.",
    generator_model: "textgen-a-v3",
    provenance: ai("last month"),
  },
  {
    item_id: "f_txt_a3",
    modality: "text",
    isFake: true,
    tier: 3,
    text: "She poured the coffee and watched steam curl toward the window. Outside, the city was waking up, one honking car at a time, indifferent and alive.",
    generator_model: "textgen-b-v1",
    provenance: ai("this week"),
  },
  {
    item_id: "f_txt_a4",
    modality: "text",
    isFake: true,
    tier: 4,
    text: "The keys were exactly where he'd left them.",
    generator_model: "textgen-b-v2",
    provenance: ai("this week"),
  },
];

export const FOOLED_IMAGES: FooledItem[] = [
  {
    item_id: "f_img_h1",
    modality: "image",
    isFake: false,
    tier: 2,
    imageSeed: 11,
    provenance: human("licensed", "photo/stock-4412", "2019"),
  },
  {
    item_id: "f_img_h2",
    modality: "image",
    isFake: false,
    tier: 3,
    imageSeed: 23,
    provenance: human("public_domain", "photo/pd-museum", "2007"),
  },
  {
    item_id: "f_img_a1",
    modality: "image",
    isFake: true,
    tier: 2,
    imageSeed: 42,
    generator_model: "imagegen-x-v3",
    provenance: ai("last month"),
  },
  {
    item_id: "f_img_a2",
    modality: "image",
    isFake: true,
    tier: 4,
    imageSeed: 77,
    generator_model: "imagegen-x-v4",
    provenance: ai("this week"),
  },
];

/** Build an 8-item run with 3–5 fakes, shuffled, tiers spread. */
export function buildFooledRun(rand: () => number = Math.random): FooledItem[] {
  const all = [...FOOLED_TEXTS, ...FOOLED_IMAGES];
  const fakes = all.filter((i) => i.isFake).sort(() => rand() - 0.5);
  const reals = all.filter((i) => !i.isFake).sort(() => rand() - 0.5);
  const nFake = 3 + Math.floor(rand() * 3); // 3–5
  const chosen = [...fakes.slice(0, nFake), ...reals.slice(0, 8 - nFake)];
  return chosen.sort(() => rand() - 0.5).slice(0, 8);
}

/** Human-readable provenance chip (Section 6.6). */
export function provenanceChip(item: FooledItem): string {
  if (item.isFake) {
    return `AI — ${item.generator_model ?? "model"}, ${item.provenance.created ?? "recent"}`;
  }
  const ref = item.provenance.source_ref ?? "source";
  return `Human — ${ref}, ${item.provenance.created ?? ""}`.trim();
}
