# DESIGN_GUIDE.md

## Purpose

This guide documents the generated-site visual system for WebView.click. It is meant for AI/vibe-coding workflows that need consistently polished local-business websites without leaking website aesthetics into WebView.click admin/demo tool UI.

Generated website CSS must be scoped to `[data-wv-site-canvas]`. WebView.click controls such as the edit button, download/setup/domain panel, demo inspector, admin UI, and prospecting tools must remain outside that selector path.

## Research Findings

- Use modern viewport units for first-screen composition. MDN documents that default `vh` maps to large viewport units and can obscure content under mobile browser UI; prefer `svh` with a `dvh` upgrade for heroes and full-screen blocks. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length
- Use `clamp()` for type and spacing tokens so generated pages scale fluidly without depending on a specific font pairing. MDN shows `clamp()` taking min/preferred/max values and using viewport-relative values while preserving readable bounds. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp
- Keep components container/layout aware rather than only viewport aware. MDN container-query guidance supports styling descendants based on container context; this informs our use of bounded content widths and component-safe spacing tokens even when the current renderer is mostly Tailwind-class based. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries
- Use `color-mix()` for palette-derived surfaces and borders, with base color fallbacks already supplied by JSON. MDN recommends perceptual spaces such as Oklab/Oklch for more even mixes. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix
- Animate only cheap properties for routine UI polish. web.dev warns that properties other than `transform` and `opacity` can trigger layout/paint and hurt smoothness. Source: https://web.dev/articles/animations-guide
- Gate motion behind `prefers-reduced-motion`. web.dev recommends serving animation only when the user has not requested reduced motion. Source: https://web.dev/articles/prefers-reduced-motion
- Use feature queries for newer CSS. MDN defines `@supports` for declarations that depend on browser support; this lets us layer `animation-timeline`, `content-visibility`, masks, and gradients without breaking older browsers. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@supports
- Use `content-visibility: auto` cautiously for offscreen generated sections. web.dev documents that it lets the browser skip rendering offscreen content and improve initial load/interaction performance. Source: https://web.dev/articles/content-visibility

## GitHub Research: High-Ticket Website Design

Added: 2 Juni 2026.

Scope: GitHub-hosted Markdown/README/SKILL documents about landing pages, conversion design, premium UI, copywriting, CRO, design review, SEO trust, and AI-readable design systems. The goal is not to copy another framework, but to translate repeated patterns into WebView.click generation rules for high-value local businesses.

### Sources Reviewed

| Source | Useful takeaway for WebView.click |
| --- | --- |
| [bear2u/my-skills: landing-page-guide-v2](https://github.com/bear2u/my-skills/blob/master/skills/landing-page-guide-v2/SKILL.md) | High-converting pages need both conversion structure and memorability. It emphasizes bold aesthetic direction, distinctive typography, social proof, real media, benefits, FAQ, final CTA, and footer completeness. |
| [MiniMax-AI/skills: frontend-dev](https://github.com/MiniMax-AI/skills/blob/main/skills/frontend-dev/SKILL.md) | Treat frontend generation as design, motion, media, and copy together. Its copy section reinforces AIDA/PAS/FAB, outcome-led headlines, action-oriented CTAs, and objection handling near CTAs. |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/README.md) | Match industry to page pattern, style, palette, typography, motion, and anti-patterns. For service businesses, hero + social proof + services + booking/contact is a strong default. |
| [coreyhaines31/marketingskills: copywriting](https://github.com/coreyhaines31/marketingskills/blob/main/skills/copywriting/SKILL.md) | Start from page purpose, audience, offer, objections, and desired action. Above the fold needs a clear headline, specific subheadline, and CTA that says what the visitor gets. |
| [coreyhaines31/marketingskills: page-cro](https://github.com/coreyhaines31/marketingskills) | CRO reviews should check value proposition clarity, headline, CTA placement/copy, visual hierarchy, trust signals, objection handling, and friction. These map well to generated-site QA flags. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) | Avoid generic AI-looking pages by inferring the brief first, choosing a context-specific visual direction, and auditing contrast, CTA visibility, and component polish before delivery. |
| [stricher05 Claude + Figma Website Builder gist](https://gist.github.com/stricher05/16ae7a2e34fade513f5a6593c40dc88f) | A useful sequence is strategy -> structure -> copy -> style -> layout -> hero -> offer -> microcopy -> handoff -> variations. WebView.click generation should follow the same order internally. |
| [garrytan/gstack: design-review](https://github.com/garrytan/gstack/blob/main/design-review/SKILL.md) | Marketing-page review should identify competing CTAs, unclear hierarchy, missing proof, weak above-the-fold communication, and interaction polish issues. |
| [syntax-syndicate/marketing-skills](https://github.com/syntax-syndicate/marketing-skills) | Marketing skills are most useful when CRO, copywriting, SEO, analytics, and growth engineering are connected rather than treated as isolated artifacts. |
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md/blob/main/README.md) | AI-generated UI improves when design language is captured as plain Markdown rules: tokens, patterns, layout intent, and constraints, not just broad style adjectives. |
| [nowork-studio/toprank SEO analysis](https://github.com/nowork-studio/toprank/blob/main/seo/seo-analysis/SKILL.md) | Local sites need trustworthiness basics: transparent contact info, accurate content, local schema, NAP consistency, location pages when relevant, and better-than-thin service content. |
| [wondelai/skills examples](https://github.com/wondelai/skills/blob/main/EXAMPLES.md) | CRO audits should identify visitor objections, missing persuasion assets, and absent influence principles. This is directly useful for generated FAQ, proof, and CTA sections. |

### Repeated Principles

1. Strategy before visuals.
   Generated sites should start from the business type, customer intent, likely objection, and desired action. A plumber, med spa, attorney, and restaurant should not share the same section rhythm just because the JSON shape is the same.

2. High-ticket design is confidence plus specificity.
   Premium does not mean decorative. It means the page makes a credible promise, uses polished spacing/type/image treatment, shows proof early, and reduces risk before asking for contact/payment.

3. One primary conversion action per page.
   For local service pages, the default should be one dominant action such as `Call Now`, `Request an Estimate`, `Book Appointment`, or `Get Directions`. Secondary CTAs should support, not compete.

4. Proof belongs near the top.
   Rating, review count, review snippets, years/credentials if sourced, service-area clarity, and gallery/work examples should appear before or immediately after the first CTA.

5. Benefits beat features, but concrete service details still matter.
   A high-ticket local site should explain outcomes and practical scope: what is included, who it is best for, what problems it prevents, and how to start.

6. Objection handling is part of the page, not an afterthought.
   Generated FAQ and process sections should answer price uncertainty, availability, service area, timing, warranty/guarantee only if sourced, licensing/insurance only if sourced, and what happens after submitting the form.

7. Visual direction must be industry-specific.
   Use `design.stylePreset`, font pairing, header treatment, image treatment, card density, and CTA style as one coordinated decision. Avoid generic purple gradients, default SaaS cards, and one-size-fits-all hero layouts.

8. Real imagery is part of perceived value.
   Prefer business/gallery/Places imagery where attribution allows. If imagery is weak, use restrained composition and proof/copy instead of unrelated stock-like visuals.

9. The final CTA should recap value and reduce risk.
   The bottom CTA should not simply repeat `Contact us`. It should restate the outcome, show the easiest next step, and include phone/location/payment/contact context where available.

10. AI-readable design rules should be explicit.
    Generated JSON should carry enough design intent for renderer/export parity: pattern, mood, CTA priority, proof strategy, media strategy, and anti-patterns.

### WebView.click Generation Rules To Add Or Preserve

- Add a `conversion.pagePattern` or equivalent derived field: `quote-led-service`, `booking-led-local`, `menu-led-restaurant`, `trust-led-professional`, `emergency-service`, `gallery-led-craft`, or `premium-consultation`.
- Generate a `conversion.primaryActionReason` sentence internally for QA, even if not rendered, so prompts stay anchored on one primary action.
- Strengthen hero requirements:
  - Headline: outcome + niche + city/service-area when natural.
  - Subheadline: what the business does, who it serves, and why the next step is low-friction.
  - Above-fold proof: rating/reviews/area/open-now/phone if available.
  - CTA: action verb plus specific result, for example `Request a Concrete Estimate`, not `Submit`.
- Improve service/detail pages with a consistent high-ticket structure:
  - best-for/use cases,
  - what is included,
  - process/timeline,
  - proof/review if relevant,
  - FAQ objections,
  - CTA to contact/call.
- Add generation QA flags for:
  - missing proof above the fold,
  - generic CTA text,
  - no objection-handling FAQ,
  - service pages with fewer than 3 concrete details,
  - hero without location/service specificity,
  - multiple competing primary CTAs,
  - no final CTA.
- Add prompt guidance that forbids fake high-ticket claims. Do not invent certifications, years in business, warranties, financing, named clients, team size, awards, or guarantees. Use source-backed proof, conservative industry knowledge, and clearly generic process language.
- Tune style preset selection for perceived value:
  - Legal/accounting/financial: authority, restraint, low radius, navy/charcoal, clear credentials.
  - Med spa/salon/wellness: soft luxe, editorial images, elegant type, booking CTA.
  - Contractor/home services: rugged trust, before/after/gallery, quote CTA, service-area clarity.
  - Restaurant/cafe: editorial/menu-led, reservations/directions, food imagery, hours.
  - Emergency services: phone-first layout, trust badges, service-area and response clarity.
- Keep the generated page scannable: 3-6 benefits, 3-5 steps, 5-8 FAQs, concise cards, and no long generic paragraphs.

### High-Ticket Implementation Progress Tracker

Use this tracker as the working backlog for translating the GitHub research into WebView.click generation behavior. Mark items complete only after the implementation, lightweight verification, and `docs/CODEBASE_REFERENCE.md` update are done.

| Status | Track | What to implement | Primary areas | Done when |
| --- | --- | --- | --- | --- |
| Done | Research | Review GitHub Markdown/README/SKILL material for high-ticket landing pages, premium UI, copywriting, CRO, trust, SEO, and AI design systems. | `docs/DESIGN_GUIDE.md` | Sources and reusable principles are captured in this guide. |
| Planned | Conversion schema | Add explicit conversion metadata such as `conversion.pagePattern`, `conversion.primaryAction`, `conversion.primaryActionReason`, and source-safe proof inputs. | Site schema/types, generation parser, export path | Generated site JSON records the intended page pattern and primary action without breaking existing demos. |
| Planned | Prompt/copy brief | Add a premium conversion-pattern block based on business category, local intent, available Places proof, and lead value. | AI generation prompt/builders | Prompts consistently request hero specificity, proof, benefits, process, objections, and final CTA. |
| Planned | Hero quality | Require hero headline, subheadline, CTA, and proof row to be specific to service, location, and available source data. | Prompt, post-process, renderer | Generated hero avoids generic claims and shows one clear primary action above the fold. |
| Planned | Proof badges | Generate 3-5 source-safe proof badges such as `Highly rated`, `Local service area`, `Directions ready`, `Photos available`, and `Open today` only when data supports them. | Places normalization, prompt context, renderer | Badges never invent credentials, awards, warranties, years, named clients, or guarantees. |
| Planned | CTA copy | Add lightweight post-processing that rewrites only generic CTA labels into specific, source-safe CTAs. | Site post-process utilities | Labels such as `Submit`, `Learn More`, or `Contact Us` become action/result CTAs without changing unsupported claims. |
| Planned | Service/detail sections | Improve service pages with high-ticket structure: best-for/use cases, what is included, process/timeline, relevant proof, FAQ objections, and contact CTA. | Prompt, schema, renderer | Service/detail pages include at least 3 concrete details and no thin generic paragraphs. |
| Planned | Objection handling | Require 5-8 concise FAQs or objection blocks for price, timing, service area, booking/contact, preparation, guarantees/warranties only when source-safe, and next step. | Prompt, post-process QA | Generated sites include relevant FAQ content near conversion points. |
| Planned | Final CTA band | Add one renderer section variant for a high-ticket final CTA band with phone, service area, and one short risk-reduction line. | `src/components/SiteRenderer.tsx`, export HTML | Visitor-facing `/demo`, `/:businessId`, and static exports render the same final conversion band. |
| Planned | Industry presets | Tune perceived-value guidance by vertical: legal/accounting/finance, med spa/salon/wellness, contractor/home services, restaurant/cafe, emergency services. | `src/lib/siteStylePresets.ts`, prompt category mapping | Generated style direction matches category expectations without one-size-fits-all luxury styling. |
| Planned | Scannability guardrails | Enforce compact generated structure: 3-6 benefits, 3-5 process steps, 5-8 FAQs, concise cards, and bounded paragraph length. | Prompt, post-process QA | Output is easier to scan and avoids long filler sections. |
| Planned | Conversion audit metadata | Store derived QA metadata in `generation_jobs.metadata_json`, for example `conversionAudit: { primaryCtaSpecific, proofAboveFold, objectionsCovered, finalCtaPresent }`. | Pages Function generation endpoints, D1 metadata | Admin can inspect conversion-readiness signals per generated job. |
| Planned | QA flags | Add generation QA flags for missing proof above fold, generic CTA, no objection FAQ, thin service pages, non-specific hero, competing primary CTAs, and missing final CTA. | Generation post-process, AdminSites/AdminLeads surfaces | Admin review can quickly identify weak demos before outreach. |
| Planned | Admin visibility | Surface conversion pattern, audit flags, and key proof inputs in admin generation/job review without adding bulky controls. | Admin sites/leads UI | Admin can triage demo quality and regenerate weak pages faster. |
| Planned | Export parity | Ensure high-ticket CTA, proof badges, CTA rewrites, and audit-safe content appear in owner static HTML/zip exports. | `src/lib/exportSiteHtml.ts` | Downloaded sites match public preview conversion structure. |
| Planned | Tests/fixtures | Add focused fixtures or lightweight tests for CTA rewrite, proof badge eligibility, conversion audit flags, and final CTA export parity. | Test fixtures/scripts used by existing checks | Core conversion transformations are covered without requiring a dev server. |

## Implementation Rules

- Scope all generated-site enhancement CSS under `[data-wv-site-canvas]`.
- Keep WebView.click UI controls outside `[data-wv-site-canvas]`.
- Do not let font-pairing choices control layout quality. Use CSS variables, `clamp()`, and bounded measure instead of fixed font-specific dimensions.
- Avoid negative letter spacing. Generated headings and Tailwind `tracking-tight` inside the canvas are normalized to `letter-spacing: 0`.
- Use positive tracking only for small uppercase labels/eyebrows.
- Use `svh` first and `dvh` inside `@supports` for hero minimum heights.
- Prefer `transform`, `opacity`, `box-shadow`, `border-color`, and color transitions for interaction states.
- Put scroll/view animations behind `@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`.
- Use `@supports` around advanced effects such as mask-based animated borders.
- Preserve readable text widths with a measure token around `60-70ch`.

## Current Generated-Site Layer

The renderer uses:

- `#rendered-site`: shared CSS variable host for the active generated site palette.
- `[data-wv-site-canvas]`: actual generated website canvas. Preset classes such as `wv-preset-cafe-warm` and visual classes such as `wv-visual-soft-rounded` live here.
- WebView.click controls remain siblings of `[data-wv-site-canvas]` inside `#rendered-site`, so generated-site CSS does not style them.

The CSS lives in `src/lib/siteStylePresets.ts` as `siteStylePresetCss` and is injected by `src/components/SiteRenderer.tsx`, so it applies to `/demo`, `/:businessId`, and exported owner HTML.

## Visual Tokens

- `--wv-page-x`: responsive page gutter.
- `--wv-section-y`: responsive vertical section rhythm.
- `--wv-section-y-compact`: compact rhythm for trust bars and short bands.
- `--wv-content-max`: max content width.
- `--wv-measure`: readable paragraph measure.
- `--wv-card-shadow` and `--wv-lift-shadow`: default and hover elevation.
- `--wv-focus-ring`: palette-derived focus ring.
- `--wv-subtle-border`: palette-derived border color.

## Debug Checklist

- If WebView.click tool UI looks affected, confirm the affected element is not inside `[data-wv-site-canvas]`.
- If a generated hero is cropped on mobile, inspect `svh/dvh` support and the sticky header height assumption.
- If animation feels excessive, test with reduced motion enabled and inspect only `transform`/`opacity` animations.
- If a card border effect does not show, check browser support for `conic-gradient`, `mask`, and `@property`; the design should still work without the enhanced border.
