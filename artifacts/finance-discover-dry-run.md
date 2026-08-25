# Finance discover dry run

**When:** 2026-08-25, while `ocean:night` PID 5056 was still running.  
**Mode:** `--dry-run` — Exa via `gateway.tools.exaSearch()` only. **Did not persist** to `data/graph.json` or Neon (same write path as the night runner).

| Slug | Model | Cost USD | Tool calls | Sources | Persist |
|---|---|---|---|---|---|
| andreessen-horowitz | zai/glm-5.2 | 0.0265 | 0 (first attempt, `category: company`) | 0 | no |
| openai-funding | zai/glm-5.2 | 0.1528 | 6 × exa_search | 63 | no |

Second run used `category: news` and a must-call prompt. Hits were Reuters / BusinessWire / PR Newswire. No Crunchbase or PitchBook. Sample URLs:

- https://reuters.com/business/retail-consumer/openais-110-billion-funding-round-draws-investment-amazon-nvidia-softbank-2026-02-27
- https://businesswire.com/news/home/20260227557827/en/OpenAI-and-Amazon-Announce-Strategic-Partnership
- https://prnewswire.com/news-releases/openai-and-softbank-group-partner-with-sb-energy-to-build-and-operate-next-generation-ai-data-centers-to-advance-stargate-302657541.html

Compile was **not** run (night still owns the graph; stay under the daily model cap). After 06:00 CT, persist with:

```bash
npm run finance:discover -- openai-funding
# optional, spends compile budget:
npm run finance:discover -- --compile openai-funding
```

Raw JSON: `artifacts/finance-discover-dry-run.json`.
