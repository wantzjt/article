# Article.fm taxonomy

Two layers. Exa is **how** we search. Topics are **what** we keep.

Do not copy Exa’s schema into the product. Map it.

## Layers

| Layer | Role |
|---|---|
| Exa retrieval taxonomy | Indexes we pass to `gateway.tools.exaSearch()` |
| Article.fm topic taxonomy | Durable objects: Topic → Source → (later) Claim |

## Exa categories (API)

`company` · `people` · `research paper` · `news` · `personal site` · `financial report`

Article.fm names:

| Our name | Exa API `category` |
|---|---|
| company | `company` |
| people | `people` |
| publication | `research paper` |
| news | `news` |
| personal_site | `personal site` |
| financial_report | `financial report` |
| web | *(omit category — unrestricted)* |

**Illegal params:** `company` and `people` must **not** send `startPublishedDate` or `excludeDomains`.

## Topic kinds (product)

`company` · `product` · `model` · `person` · `policy` · `standard` · `event` · `concept`

Derived from legacy `entityType` unless a seed sets `kind`:

| entityType | kind |
|---|---|
| lab, company, investor | company |
| infra | product |
| model | model |
| policy | policy (override `standard` on ISO/OECD seeds) |
| research | concept |
| round_event | event |

`taxonomy_path` is derived as `[kind, slug]` — not a separate vector store.

## Source facets

Persisted on every Exa hit (`sources.metadata` + existing columns):

`exa_category` · `query_tag` · `content_type` · `domain` · `published_at` · `retrieved_at` · `content_hash` · `excerpt` (`evidence_excerpt`) · `title` · `publisher` · `topic_id` · `raw_entity_meta`

## Pull plan (kind → Exa passes)

| Topic kind | Exa passes |
|---|---|
| company | company + news + financial_report + web (official domain) |
| model / product | web (docs/model card) + news + publication |
| person | people + news |
| policy / standard | news + publication + web |
| event | news + financial_report + web |
| concept (research line) | publication + news + web |

## Graph (unchanged spine)

```text
Topic (typed kind)
  └── Source (Exa hit, hashed, categorized)
        └── Claim (later, paid compile)
              └── ClaimSource
```

This runner does **not** write claims, versions, or briefs.

## RAG later (not built this pass)

Embed **claim text + source excerpts**, not whole pages.

Filters: `topic.kind`, `source.exa_category`, domain, `published_at`.

## Runner

```bash
npm run ocean:exa
```

Discover-only. Hard stop `2026-08-30T23:59:00-05:00`. No `EXA_API_KEY`. Gateway executes Exa as a provider tool; compile/extract/verify stay off.
