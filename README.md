# article.fm

**News around things, not articles.**

[article.fm](https://article.fm) is a living evidence graph. Each Topic is a dossier of claims, sources, and typed Changes. The site does not write an article and hang citations on afterward.

Truth is shared. Attention is personal. **Frequency** is a projection of the same graph, not a rewrite of it.

## Product loop

**read → discover → tune → personalize → inspect evidence → ask → Morning Frequency**

- **The World** — what’s moving, compressed like a newspaper. Depth lives on the Topic.
- **Topic dossier** — claims, sources, What changed, relations.
- **Your Frequency** — follow leaf Topics, weight interest areas, mute as the only hard exclude.
- **Grounded Ask** — answers from the graph, not an open web mill.
- **Morning Frequency** — email of what changed on what you follow.

Starting coverage is AI and technology. Expanding continuously.

## How the graph works

```
Topic → Claim → Source → Change
```

A **Claim** is an atomic fact with status (`single_source`, `supported`, `disputed`, …) and linked excerpts. A **Change** is a typed delta over that graph, not generated prose:

| Kind | Meaning |
| --- | --- |
| NEW | First public claim |
| UPDATED | Same claim, new wording |
| CONFIRMED | `single_source` → `supported` |
| DISPUTED | Competing evidence |
| RESOLVED | Dispute cleared |
| RELATIONSHIP | Typed edge between Topics |
| INVALIDATED | Claim retracted |

Every Change carries Topic(s), facets, claims, sources, materiality, timestamp, and prior state.

Mute is the only hard exclude. Parent interest weights are not follow-all.

## Stack

- **App:** Next.js on Vercel — [article.fm](https://article.fm)
- **Graph store:** Neon Postgres (JSON fixture for local review)
- **Discover:** Exa via `gateway.tools.exaSearch()` on Vercel AI Gateway (no `EXA_API_KEY`)
- **Compile:** extract → verify → render through AI Gateway (`PRIMARY_MODEL`)
- **Mail:** Resend for magic-link auth and Morning Frequency
- **Audio:** optional TTS on the launch demo Topic only (`glm-5-3`)

Internal compiler name: CitationForge. Not shown on the masthead.

## Local

```bash
npm install
cp .env.example .env.local   # or: npx vercel env pull .env.local
npm test
npm run dev
```

Open [`/topic/glm-5-3`](http://localhost:3000/topic/glm-5-3). The committed fixture is enough to review a Topic page with no keys.

Useful env (see `.env.example`):

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Neon. Omit to serve the fixture. |
| `AI_GATEWAY_API_KEY` / Vercel OIDC | Gateway for discover + compile |
| `PRIMARY_MODEL` | Compile model |
| `MAX_DAILY_MODEL_SPEND_USD` | Model-token cap (does not cap Exa) |
| `AUTH_SECRET` | Frequency session cookie |
| `RESEND_API_KEY` | Magic link + morning mail |
| `ADMIN_SECRET` | `POST /api/admin/ingest` |

Never set `EXA_API_KEY`. Search is Gateway-only.

## Harvest and compile (optional, spends credits)

Discover banks sources. Compile turns warehouse evidence into claims and Changes. These jobs are **not** required to run the site.

```bash
npm run ocean:blitz      # Exa discover, no claims
npm run compile:yield    # extract/verify low-yield and re-extract queues
npm run ocean:night      # bounded overnight compile
```

Exa on AI Gateway is **metered** (the Aug 31, 2026 promo is over). Model extract/verify also bills Gateway. Stop those processes if you do not want spend.

## Tests

```bash
npm test
npx tsc --noEmit
```

## License

MIT. See [LICENSE](LICENSE).
