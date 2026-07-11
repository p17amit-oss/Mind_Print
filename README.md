# Mind Print

A web-first daily game — three trials, ~3 minutes a day — that is secretly a
longitudinal behavioral-science instrument. Players run a daily gauntlet, wager
on their own performance, and resolve a foggy multi-dimension "Mind Print" while
the system measures cognition, metacognition (calibration), AI-deception
detection, judgment, economic preferences, and composure from play behavior alone.

## Two product laws (they override everything)

1. **Fun-first, instrument-second.** Every trial must survive: _"would someone
   play this if it measured nothing?"_
2. **The two-room wall.** Individual-level data never leaves the system. **There
   are no user-level export endpoints anywhere in this codebase.** Aggregation
   happens only in SQL views (`migrations/0003_research_views.sql`). This is
   architecture, not policy.

> **Code-review rule (founding document, per spec Section 13):** No pull request
> may add an endpoint, script, or query that returns user-level rows across
> users. The only sanctioned cross-user read path is the research views, which
> filter through `v_research_eligible_users` (adult + active research consent)
> and suppress cells below n≥50.

## Stack

- **Next.js 14, Pages Router** (not App Router), TypeScript
- **Neon Postgres** via `@vercel/postgres` — all user/event/run data
- **Airtable** as item-bank CMS (read-only; hourly sync → `item_cache`)
- **GA4** (gtag) + server-side mirror `/api/track` → Postgres **and** Pipedream
- **@vercel/og** for the daily share card (cached by content hash)
- **Howler.js** audio, **Framer Motion** + CSS animation
- Anonymous-first auth: device id in localStorage + httpOnly cookie fallback
- Mobile-first, one-thumb portrait, 380px baseline

## Setup

```bash
npm install
cp .env.example .env.local      # fill in POSTGRES_URL etc.
npm run migrate                 # apply migrations/*.sql (idempotent)
npm run sync:airtable           # pull item bank into item_cache
npm run dev
```

Deployment: Vercel. **Configure Spend Management alert + auto-pause threshold**
as part of deployment setup (spec Section 1). Cron routes are wired in
`vercel.json` and protected by `CRON_SECRET`.

## Compliance guardrails (Section 13)

Encoded in `src/lib/compliance.ts` and enforced in CI:

- `npm run compliance:grep` — greps player-facing source for banned strings
  (`IQ`, `brain training`, `clinical`, `diagnose`, …) and Form-copy banned words
  (`decline`, `impairment`, …).
- `npm run test:compliance` — unit tests: Sponsored label renders, under-18
  users excluded from research, no user-level export endpoint exists, Form copy
  law holds.

## Dev routes

- `/dev/glyphs` — the composable-SVG glyph renderer (alien_rules)
- `/dev/trial/[type]` — play any single trial in isolation
- `/settings` — view/revoke research consent

## Build status (spec Section 17 order)

- [x] 1. Schema + migrations (+ phase-2 stubs + research views), anonymous auth,
       age gate, consent flows, Airtable sync
- [ ] 2. Glyph renderer
- [ ] 3. Trial engine shell (wager → trial → resolution)
- [ ] 4. Six trials
- [ ] 5. Staircase + event logging + summary metrics
- [ ] 6. Scoring job + Form engine + computed telemetry
- [ ] 7. Constellation + session flow + rotation + chaos + context tags
- [ ] 8. Double-or-Bank + Chest
- [ ] 9. Daily share card + share flow
- [ ] 10. Gauntlet admin + event banner
- [ ] 11. Tracking + compliance tests + polish

## Data model

See `migrations/0001_core_schema.sql` (core, Section 2),
`0002_phase2_stubs.sql` (circles/seasons/skill_ratings, Section 14),
`0003_research_views.sql` (the two-room wall, Section 15),
`0004_tracking.sql` (analytics mirror).
