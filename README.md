# OFMS Brand Builder

Private single-operator Brand Builder for early-stage OF/Fansly models.

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase database + storage
- OpenRouter via Vercel AI SDK provider
- Zod contracts
- Vitest, React Testing Library, Supertest, Playwright
- `pnpm` only

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Required env vars:

- `OPERATOR_ACCESS_CODE`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Apply `supabase/schema.sql` for a new project. Existing projects must also run
`supabase/migrations/20260623_curated_brand_memory.sql` in the Supabase SQL editor.

## Supabase Keepalive

`vercel.json` schedules `/api/cron/supabase-keepalive` every two days. The route inserts into `health_checks`, which creates real database activity and helps prevent inactivity pauses. Set `CRON_SECRET` in Vercel and call the route with `Authorization: Bearer <CRON_SECRET>`.

## Quality Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## GPT-5.5 Quality Run

The Brand Builder uses a fixed three-call GPT-5.5 pipeline: strategy, writing and final
review. The quality endpoint runs the same production pipeline without saving to
CyberData. The CLI processes exactly three profiles and writes all nine bios to a
plain-text report with real OpenRouter token usage, cost and response time.

```bash
OFMS_OPERATOR_CODE=admin pnpm benchmark:brand \
  --input /absolute/path/to/three-profiles.json \
  --output /absolute/path/to/report.txt
```

The model identifier is fixed server-side to `openai/gpt-5.5`; environment variables
cannot switch production to a different model.

## Quality Calibration

Approved input-to-bio pairs are stored as canonical quality anchors. At generation
time, OFMS selects only the most relevant anchors and sends both their transferable
lesson and an explicit no-copy policy to every pipeline stage. Anchors calibrate:

- compact micro-story structure;
- reader participation and emotional tension;
- profile-specific detail selection;
- character-appropriate texting voice;
- an in-scene closing CTA.

They are not templates. Settings, wardrobe, body details, niches, wording and cadence
must come from the current profile rather than from an approved example.

## Authorized Leaderboard Research

OFMS includes an aggregate analyzer for leaderboard exports obtained with Fansly's
written permission or supplied by an authorized client. It does not crawl Fansly and
does not place usernames or raw bios in its reports.

```bash
pnpm analyze:leaderboard \
  --input /absolute/path/to/authorized-leaderboard.json \
  --json /absolute/path/to/leaderboard-report.json \
  --markdown /absolute/path/to/leaderboard-report.md
```

The input contract and interpretation limits are documented in
`docs/fansly-leaderboard-data-contract.md`.

## Product Rules

- Generate exactly 3 routes.
- Every route is English, discovery-first and 55-90 words.
- Every route uses 2-4 mutually reinforcing profile anchors inside one scene.
- Reference photos are stored only; they are not sent to the AI in v1.
- Operator edits require field-level feedback reasons.
- Corrections remain pending until an operator approves them in Settings.
- GPT does not learn by itself; OFMS sends a capped set of approved, relevant corrections on future generations.
