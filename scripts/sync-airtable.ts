/** CLI entry for the Airtable → item_cache sync. `npm run sync:airtable`. */
import { syncAirtable } from "../src/lib/server/airtable-sync";

syncAirtable()
  .then((r) => {
    console.log(`Sync complete: ${r.upserted} upserted, ${r.skipped} skipped.`);
    if (r.errors.length) {
      console.warn(`${r.errors.length} validation error(s):`);
      for (const e of r.errors) console.warn("  -", e);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
