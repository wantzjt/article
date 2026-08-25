# Article.fm

Provisional public name. Internal compiler: CitationForge — not shown on the masthead.

**News around things, not articles.**

This repo is a living topic graph: Topic → Claim → Source → Change. The public site renders that graph. It does not generate an article and hang citations on afterward.

## Promo path (do not bypass)

- **Model:** Vercel AI Gateway, `PRIMARY_MODEL=zai/glm-5.2` (Blackbox/eve free through 2026-08-27 23:59 CT). After that window, default flips to metered `zai/glm-5.3` under `$8`. No silent 5.3 fallback. OIDC (`vercel env pull`). No direct Z.ai key.
- **Exa:** `gateway.tools.exaSearch()` on AI Gateway / Eve. Free through 2026-08-31. **No `EXA_API_KEY`. No Marketplace PAYG.**
- **Model spend guard:** `MAX_DAILY_MODEL_SPEND_USD` (default 8). This does **not** cap Exa promo search.
- **Database:** Neon free plan when Marketplace provisioning completes. Until then the committed GLM-5.3 fixture is enough to review the topic page.

## Local

```bash
npm install
npx vercel link --yes --scope tarx --project article
npx vercel env pull .env.local --yes
npm test
npm run dev
```

Open `/topic/glm-5-3`. No keys required for the fixture.

Live ingest (Gateway OIDC required):

```bash
npm run ingest -- glm-5-3
```

Night runner (bounded overnight compile — do not use `npm run ocean` for the demo window):

```bash
npm run ocean:night
```

Stops at **06:00 America/Chicago**, **$6.50** model spend today, empty queue, or Exa hard stop (`2026-08-30 23:59 CT`). Compile stays `PRIMARY_MODEL=zai/glm-5.2`. No silent 5.3 fallback. No `EXA_API_KEY`. Resume-safe via `data/ocean-night-progress.json`. Writes `artifacts/ocean-night-report.json` and `artifacts/OCEAN_REPORT.md` on each topic finish and on stop. Public snapshot: `GET /api/status`.

## Morning checklist

Do this in order. Trust `/api/status` and the report files; do not scrape harvest logs.

1. [Explore](https://article-gamma-rose.vercel.app/) — count What Moved
2. [`/api/status`](https://article-gamma-rose.vercel.app/api/status) — `topics.strong` / `provisional` / `stub`, `claims`, `urls`, `whatMoved`, `model`, `spendUsd`, `spendCapUsd`, `hardStopAt`, `runner`, `lastError`
3. [GLM-5.3 Play](https://article-gamma-rose.vercel.app/topic/glm-5-3) — cache hit only; other slugs have no Play
4. [Anthropic](https://article-gamma-rose.vercel.app/topic/anthropic)
5. [OpenAI](https://article-gamma-rose.vercel.app/topic/openai)
6. Local: `artifacts/OCEAN_REPORT.md` and `artifacts/ocean-night-report.json`

Admin HTTP trigger (secret in `ADMIN_SECRET`):

```
POST /api/admin/ingest
Authorization: Bearer $ADMIN_SECRET
{"slug":"glm-5-3"}
```

## Audio (Phase B)

Play is enabled only on `glm-5-3`. Speech is generated from `scriptFromClaims` via AI Gateway model `fish-audio/s2.1-pro` (promo through 2026-09-18). Audio is cached by `topic_id + material_hash` in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, otherwise `data/audio/` (gitignored). No Fish API key. No autoplay.

## Seed

~50 checked-in AI entities in `src/lib/seed/entities.ts`. New topics are not created from arbitrary named strings. Launch demo topic: **GLM-5.3**.
