# Article.fm design

Mobile (≈390px) is the source of truth. Desktop is the same column with wider margins. One product, four pages.

## Tokens

| Token | Role | Value |
|---|---|---|
| `--paper` | Page ground | `oklch(0.982 0.008 92)` |
| `--ink` | Primary text | `oklch(0.22 0.02 55)` |
| `--ink-quiet` | Meta, captions | `oklch(0.48 0.015 55)` |
| `--rule` | Hairlines | `oklch(0.88 0.012 85)` |
| `--signal` | “Changed” only | `oklch(0.52 0.14 38)` rust |

Status (quiet, semantic — never a confidence %):

| Status | Token |
|---|---|
| supported | `--status-supported` `oklch(0.34 0.07 155)` |
| disputed | `--status-disputed` `oklch(0.40 0.12 28)` |
| single-source / stub / strong | `--ink` (12px mono — not quiet gray) |

Type: Source Serif 4 for topic names and claim sentences. Geist for chrome. Geist Mono for timestamps, counts, chips.

Scale: `11/14` meta · `15/24` body · `22/28` section · `36/40` topic display (32 on 390px).

Spacing: 16px page gutter; 24–40px between sections; 12px inside a claim row. Column: 40rem — desktop is the same column with wider margins.

## Components

- Masthead: wordmark · tagline (hidden on 390px) · Methodology · Corrections
- Status chip
- Claim row + expandable sources (`N independent · M primary`); Sources control ≥44px
- Disagreement: stacked sourced positions, not a blended card
- Timeline: date (mono) + one-line change
- Play: secondary, under meta, ≥44px hit, no autoplay, `glm-5-3` only
- Topic dek: ≤2 short sentences on the page
- Explore What Moved: latest brief headline or first sentence of material change — never the topic dek

## Do not

- Purple AI glow, stock heroes, tickers, bylines
- Article card grids, Pinterest, newspaper CMS chrome
- Dark mode as a project
- CitationForge on any consumer surface
- Fake confidence scores
- Autoplay or a hero player
- New routes this pass
