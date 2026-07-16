// Item validation, incl. the fooled provenance rule (BUILD PROMPT Section 6.6).
// Human items MUST carry rights ('licensed'|'public_domain'|'commissioned') and a
// source_ref — no scraped content, ever. AI items MUST carry generator_model + a
// generation date. Enforced at sync time AND by a CI test over the seed bank.

export interface Provenance {
  source_type?: "human" | "ai";
  rights?: "licensed" | "public_domain" | "commissioned" | string;
  source_ref?: string;
  created?: string;
}

export interface FooledItemLike {
  item_id: string;
  provenance?: Provenance | null;
  generator_model?: string | null;
}

/** The only permitted `rights` values for human items — no scraped content. */
export const VALID_RIGHTS = ["licensed", "public_domain", "commissioned"] as const;
export type Rights = (typeof VALID_RIGHTS)[number];
const VALID_RIGHTS_SET = new Set<string>(VALID_RIGHTS);

/** Returns a list of human-readable reasons the item is invalid (empty = OK). */
export function validateFooledItem(item: FooledItemLike): string[] {
  const errors: string[] = [];
  const p = item.provenance ?? {};
  const sourceType = p.source_type;

  if (sourceType !== "human" && sourceType !== "ai") {
    errors.push(`${item.item_id}: provenance.source_type must be 'human' or 'ai'`);
    return errors;
  }

  if (sourceType === "human") {
    if (!p.rights || !VALID_RIGHTS_SET.has(p.rights)) {
      errors.push(
        `${item.item_id}: human item rights must be licensed|public_domain|commissioned (no scraped content)`
      );
    }
    if (!p.source_ref) {
      errors.push(`${item.item_id}: human item missing source_ref`);
    }
  } else {
    // AI item
    if (!item.generator_model) {
      errors.push(`${item.item_id}: AI item missing generator_model`);
    }
    if (!p.created) {
      errors.push(`${item.item_id}: AI item missing generation date (provenance.created)`);
    }
  }
  return errors;
}

export function isValidFooledItem(item: FooledItemLike): boolean {
  return validateFooledItem(item).length === 0;
}
