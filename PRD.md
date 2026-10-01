# 📄 PRD — WebView.click v2 (DRAFT for approval)

**Project:** WebView.click · **Version:** 2.0-draft · **Date:** 2026-10-01 · **Status:** 🟡 DRAFT — audit + review first, implementation only after approval.
**Supersedes:** `docs/WebView.click.md` v1.0 (kept as historical record; its ID-market examples, WhatsApp-first flow, and $120/y pricing no longer describe the product).
**Companion:** `CODEBASE.md` (root inventory: code, logic, reason) + `CODEBASE.md` Appendix A (full generation-quality audit with file:line evidence).

Legend: ✅ required · ⚠️ conditional · ❌ out of scope · 🔴 blocks premium feel · 🟡 weakens it · ★ load-bearing decision.

## 1 · Executive summary

WebView.click finds US local businesses without websites (Google Places prospecting), auto-generates a personalized demo website from real business data, and converts the owner through a free `$0` website package into a done-for-you setup customer: **$180/year managed hosting + $17/year domain fee only when WebView.click registers a new domain**. The product has two faces: an admin CRM + AI site builder, and an owner-facing preview that must feel like a `$997`-value custom site, not a template. The v1 product works end-to-end, but generated sites still feel generic — this PRD defines what "good enough" means across three balanced tracks (visual premiumness, copy grounding, conversion + QA gates) and the roadmap to get there.

## 2 · What changed since v1.0 (truth table)

| # | v1.0 claim (`docs/WebView.click.md`) | v2 truth (code as of 2026-10-01) |
|---|---|---|
| 1 | ID-market examples (Kopi Senja, Rp, WhatsApp outreach) | ✅ US-only: English default for US addresses, SMS/iMessage + email outreach, no WhatsApp-first flow |
| 2 | $120/y all-in, "free lifetime hosting" | ✅ $180/y hosting + $17/y new-domain fee; owned domains pay hosting only; 1–10y terms with hosting-only discounts |
| 3 | One-shot AI JSON generation | ✅ Chunked resumable jobs: preflight → outline → siteCopy → offeringCopy (1 item/request) → finalize; transient errors retry one chunk after 60s |
| 4 | Generic JSON schema (meta/design/global/navigation/pages) | ✅ Rich schema: `sourceData`, `brand`, `businessProfile`, `trust`, `offers`/`products`/`services`, `capabilities`, `location`, `hours`, `conversion`, `seo`, design intent, audits |
| 5 | WhatsApp CTA + PayPal.me manual payments | ✅ PayPal Orders v2 / Subscriptions inline + manual rails; `mailto:`/`sms:` drafts from real business data; no fake placeholder contacts |
| 6 | "AI picks colors/fonts" (one paragraph) | ✅ Full visual system: 16 niche presets, 5 shape layers, procedural shaders, 30 font pairings, photo-derived palettes with contrast tokens |
| 7 | No quality definition | ✅ v2 defines it: §8 outreach-ready gate (this PRD's core addition) |

## 3 · Tech stack (current, not aspirational)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind | Token-driven renderer; generated-site CSS strictly scoped to `[data-wv-site-canvas]` so tool UI never inherits site styles |
| Auth | Clerk (`publicMetadata.role === "admin"`) | Staff gating with dev bypass outside production |
| Production hosting/API/data | Cloudflare Pages + Pages Functions + D1 + R2 | `functions/api/*/handler.ts` modules; D1 manifests + R2 full JSON; Express/SQLite kept for local context only |
| AI | OpenRouter / OpenAI / Gemini / KIE.ai / Opencode via chunked jobs | No single huge AI call (reliability rule); provider cooldowns + readiness preflight + 24h health guardrails |
| Payments | PayPal API-first, Xendit/Midtrans/DOKU/Wise/Payoneer/manual rails | Server recomputes all pricing; buyer UI never shows wholesale registrar cost |
| Proof asset | Deterministic GBP marketing audit (`/audit/:businessId`), no AI | Owner-facing score + evidence + PDF without hallucination risk |

## 4 · Goals and non-goals

| # | Statement | Type |
|---|---|---|
| G1 | Every outreach demo passes the §8 outreach-ready gate (no weak demo ever reaches an owner) | ✅ goal |
| G2 | A demo is recognizably *that business*: real photos, real hours/reviews/location, niche-correct composition — never a re-skinned template | ✅ goal |
| G3 | One dominant conversion action per page, source-safe proof above the fold, objection-handling FAQ, final CTA band — on preview *and* in the owner zip | ✅ goal |
| G4 | Generation stays chunked/resumable; partial progress is never silently discarded or disguised as success | ✅ goal |
| N1 | Inventing credentials (years, awards, warranties, named clients, exact prices) to look premium | ❌ non-goal (forbidden) |
| N2 | Hotlinking Google photos as the final paid asset; free previews proxy, paid sites use owner/provided assets | ❌ non-goal (policy) |
| N3 | Rebuilding the admin CRM visual language in this PRD cycle; admin work here is QA-signal surfacing only | ❌ non-goal (deferred) |

## 5 · User flows (current truth)

**A · Admin acquisition:** login → Find Leads (niche + city + state, curated US routes) → Gather data (Place Details; `No website` verified only after details) → pick photo/palette (up to 5 palette options) → chunked Generate (outline → siteCopy → offeringCopy → finalize with progress bar) → QA in Sites/Jobs → audit snapshot → outreach queue.
**B · Owner conversion:** receives `/:businessId?owner=1` link (starts 7-day review countdown) → browses personalized preview → `Download / Setup` panel → FREE `$0` package modal ($997 → $0 value stack, page list, PDF guide) **or** done-for-you setup (term → optional $50 page add-ons → domain check → email/payment) → download zip or paid fulfillment queue.
**C · Return visit:** `localStorage.savedBusinessId` reopens the owner's preview from the hub; expired review windows show an archived overlay with a `mailto:` restore path.

## 6 · Audit verdict: why current sites feel "not good enough"

Full evidence in `CODEBASE.md` Appendix A. One-line verdict per track:

| Track | Verdict | Worst offenders |
|---|---|---|
| 🔴 Visual premiumness | Renderer *can* vary hero/proof/offers/CTA, but page rhythm, detail layout, and media strategy are data-only — every niche renders the same stacked blocks with one recycled photo | Identical `py-20` sections (§A-T1.1); single-photo reuse (§A-T1.2); preset convergence (§A-T1.3); export font/hero breakage (§A-T1.7) |
| 🔴 Copy grounding | The AI writes blind (no design/asset context, minimal facts) and failures degrade silently into canned scaffold + generic filler that count-based audits cannot catch | Blinded prompt (§A-T2.1); thin facts (§A-T2.2); silent outline skip (§A-T2.3); filler FAQ/about (§A-T2.4) |
| 🟡 Conversion + QA | Proof/CTA/final-CTA machinery exists but is conditional, thin, or jobs-only — and nothing stops a weak demo from being contacted | No composite gate (§A-T3.1); conditional proof (§A-T3.2); mailto-only contact (§A-T3.4); unused Places richness (§A-T3.5) |

## 7 · Requirements v2 (balanced across all three tracks)

### Track A — Visual premiumness (look custom, not templated)

| ID | Requirement | Acceptance |
|---|---|---|
| A1 | Every generated design-intent field either branches rendering or is removed from generation — no more data-only intent | ✅ `compositionPattern`/`sectionRhythm`/`detailLayout`/`mediaStrategy` each change ≥1 visible layout decision, or the field is deleted from schema + prompts |
| A2 | Multi-photo generation: hero + gallery + card pool picked at generate time (never one photo rotated everywhere); zero-photo sites use proof-led layouts, never empty grey boxes | ✅ no duplicate image across hero/cards on gate pass; no-photo sites render map/contact/icon composition |
| A3 | Preset inference uses `primaryType` + `types` + review themes (not first-match keyword), admin can override before generate; same-industry sites differ visibly | ✅ 3 same-niche samples are distinguishable by preset/visual/font Sector in `/demo` QA |
| A4 | Owner zip matches preview: valid font loading, viewport-correct hero size, working images offline, same final CTA + proof badges | ✅ export-parity fixture covers fonts, hero size, badges, final CTA |
| A5 | Mobile-first finish: real mobile nav, safe-area-aware sticky CTA, accordion FAQ, `mailto:` success state | ✅ thumb-reachable CTA + contact confirmation on a 360px viewport |

### Track B — Copy grounding (sound like the business, not a template)

| ID | Requirement | Acceptance |
|---|---|---|
| B1 | AI brief gains grounding: `reviewSummary`/`generativeSummary`, amenity booleans, `priceLevel`/`paymentOptions`, secondary hours + timezone, top 3–4 photo references | ✅ brief fixture contains ≥80% of available rich fields for a sample place |
| B2 | AI sees render context (page IDs, section order, image presence, palette/mood, CTA slots) without permission to mutate structure | ✅ copy references real sections/offers; protected-field violations stay at zero |
| B3 | Outline failure is loud: null/invalid outline blocks or explicitly flags the job — never silent scaffold passthrough; `siteCopy` retry never wipes offering progress | ✅ no `generatedWithAi=true` site ships scaffold-grade offerings undetected |
| B4 | Filler ban: About/FAQ/detail copy must contain ≥1 business-specific fact (name, place, service, review theme); generic-only text fails the audit | ✅ audit checks specificity, not just counts |
| B5 | Prices/CTAs stay source-safe but specific: real price signals render when Places provides them; CTA labels name the outcome (`Request a Concrete Estimate`, not `Submit`) | ✅ zero invented prices; generic-CTA flag covers all scaffold labels |

### Track C — Conversion + QA gates (prove it before outreach)

| ID | Requirement | Acceptance |
|---|---|---|
| C1 | Composite **outreach-ready** gate in `AdminSites`: `auditSnapshot && conversionReady && designReady && mediaReady && contactReady` — one filter, one badge, outreach actions disabled until green | ✅ weak demos cannot enter the outreach queue by construction |
| C2 | Proof above the fold guaranteed: rating/count/area/open-now/phone rendered as a designed strip near the CTA on every pattern, with attribution intact | ✅ gate fails any demo with zero above-fold proof |
| C3 | Detail pages are sales pages: included scope, best-for chips, process/next step, proof snippet, FAQ, final CTA (no more thin article pages) | ✅ thin-service-pages flag reaches zero on gate pass |
| C4 | Contact ladder: call/SMS/directions/hours always; `mailto:` form gains success state; visitor pricing answers exist where data allows | ✅ every demo has a working low-friction contact path |
| C5 | Job reliability: finalize persists partial AI work on save failure; all chunk transitions preserve prior progress; safe-mode data stays visible per provider/model | ✅ no full-spend job loss without a recoverable checkpoint |

## 8 · Outreach-ready gate (normative definition)

A site is **outreach-ready** iff all five hold: (1) **audit**: saved GBP snapshot exists and is fresh vs source hash; (2) **conversion**: `conversionAudit` has zero flags (specific primary CTA, proof above fold, objections covered, final CTA present, specific hero, no competing CTAs, no thin service pages); (3) **design**: `designAudit` has zero flags (layout set, proof treatment set, media strategy valid, CTA hierarchy valid, no generic fallback, no weak-image hero); (4) **media**: ≥2 usable images with attribution, ≥2 palette options, no missing/duplicate service-card images; (5) **contact**: usable phone or email plus directions/hours. Admin UI enforces this as a single composite filter + row badge; outreach copy/open actions stay disabled until green.

## 9 · Data grounding map (Places → JSON → pixels)

| Places field | JSON target | Visible result | Today |
|---|---|---|---|
| `displayName`, `primaryType`, `types` | `businessProfile.*`, preset/visual inference | Header, hero eyebrow, niche composition | ⚠️ keyword-only inference |
| `nationalPhoneNumber`, `googleMapsUri` | `businessProfile.contact`, `location` | Call/directions CTAs | ✅ |
| `formattedAddress`, components, service-area flags | `location`, `locationServed` | Contact section, areas-served, SAB copy | ⚠️ components + SAB shaping unused |
| `regularOpeningHours`, secondary hours, timezone | `hours` | Grouped hours card, open-now badges | ⚠️ secondary hours + tz unused |
| `rating`, `userRatingCount`, `reviews`, summaries | `trust.*` | Trust bar, testimonials, proof badges | ⚠️ flattened to 3 reviews, synthetic summary |
| `photos` (ranked, attributed) | `brand.*`, gallery, card pool | Hero, gallery, service imagery | 🔴 single photo reused |
| Amenities, price, payments, parking, accessibility | `capabilities`, `offers.priceHint` | Badges, pricing cues | ❌ largely unused — B1 restores them |

## 10 · Pricing truth (authoritative)

Free: `$0` website package (static zip + PDF guide). Done-for-you: **$180/year hosting + $17/year domain fee only for newly registered domains**; owned domains pay hosting only. Terms 1–10y discount hosting only (5% at 2y, +5%/y to 9y, 50% at 10y). Add-ons: page add/edit work at `$50`/action (10% off 5–9, 20% off 10+), counted before domain/payment. Server recomputes everything; buyer UI shows the included `$17` fee, never wholesale registrar cost.

## 11 · Roadmap (phased, approval-gated)

| Phase | Scope | Gate to next phase |
|---|---|---|
| P0 · Truth + gates (no AI changes) | C1 composite gate UI, B4 specificity audit, A4 export-parity fixes, multi-photo pick (A2 data path) | Outreach queue provably blocks weak demos |
| P1 · Grounding (prompt + brief) | B1 rich brief, B2 render context, B3 loud outline failure, B5 CTA/price specificity | `generatedWithAi` sites beat scaffold on blind review |
| P2 · Composition (renderer) | A1 intent-actually-renders, A3 preset inference, A5 mobile finish, C2/C3/C4 conversion depth | 3 same-niche demos distinguishable + gate fully green |
| P3 · Scale | Batch upgrade with dry-run filters, version metadata, rollback notes (per `DESIGN_GUIDE.md` upgrade plan) | Bulk migration without breaking URLs, payments, or owner edits |
| P4 · Design-intelligence (§13, implemented 2026-10-01) | D1–D12 derived from ui-ux-pro-max: spacing token system, landing-pattern alignment, industry must-have blocks, style/type/motion enrichment, checklist audit flags | 3 same-niche demos beat current-gen on blind premium review with the §8 gate staying green |

## 12 · Open decisions (need your call before P0)

1. **Photo sourcing depth:** stay with Places-proxy + owner uploads, or budget generated/stock imagery for zero-photo prospects?
2. **Outreach hard-block vs warn:** should C1 *disable* outreach actions, or show red badges but allow override with a reason?
3. **Pricing page:** does the owner preview need visitor-facing price ranges where Places data supports them, or keep pricing strictly in checkout/FAQ?
4. **P4 density default:** should owner demos default to the UUPM "spacious" tier (D2) for premium feel, or "standard" to keep more content above the fold? → **Decided P4 (2026-10-01): spacious default** (`design.density`, premium airiness is the product goal); `standard` stays an explicit opt-in.

## 13 · Design-intelligence upgrade (ui-ux-pro-max derived — P4 approved and implemented 2026-10-01)

**Source:** `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/` (MIT), reviewed 2026-10-01 at upstream HEAD `09170ee` via a disposable shallow clone (no code vendored; nothing copied into this repo). It is an AI design-intelligence skill: a BM25-searchable database of **192 industry reasoning rules** (`products.csv` + `ui-reasoning.csv`), **79 searchable UI styles (50 active, 29 supplemental, 9 deprecated)**, **192 industry color palettes**, **74 font pairings**, **34 landing-page patterns**, **119 UX guidelines** (44 High, 4 Critical), **17 motion tiers**, 22 stack guides (incl. `html-tailwind`, `react`), and a three-layer token architecture (primitive → semantic → component) with an optional 1–10 variance/motion/density dial system (`design_system.py` `DIAL_TIERS`). The consumable insight for us is not the search CLI but the *curated values*: spacing scales, section orders, industry must-haves, style checklists, type/motion numbers. Everything below is mapped against our current truth (16 style presets, 5 visual styles, 7 `sectionRhythm` names collapsing to 3 paddings, `conversionPagePattern`, `conversionAudit`/`designAudit`, export parity) so each item is implementable later without re-research.

### 13.1 Spacing system (priority — fixes the "same stacked blocks" feel)

Today `sectionRhythmPadClass` maps 7 rhythm names to 3 paddings (`py-10` / `py-16` / `py-20` default / `py-24·md:py-32`), responsive steps exist only on premium rhythms, horizontal padding is fixed (`px-4`/`px-6`), and there is no shared scale between renderer and export. UUPM gives us exact numbers to replace this with a token system:

| ID | Requirement (derived) | Acceptance (when implemented) |
|---|---|---|
| D1 | Adopt the 4px-base primitive scale (`--space-0-5` 2px … `--space-24` 96px, `primitive-tokens.md` §Spacing Scale) plus semantic section tokens `--spacing-section-sm/md/lg` = 32/48/64px, shared by `SiteRenderer` and `exportSiteHtml` so export parity holds by construction | ✅ fixture asserts every section type resolves to a token (no raw `py-20` fallback) and renderer/export emit the same padding for the same intent |
| D2 | Add a `density` intent dial with the two marketing tiers from `DIAL_TIERS` (spacious: md 24 / lg 32 / xl 48 / 2xl 64 / 3xl 96; standard: md 16 / lg 24 / xl 32 / 2xl 48 / 3xl 64); owner demos default spacious (see open decision §12.4), admin keeps its dense UI | ✅ one intent field flips the token set; snapshot test shows both tiers |
| D3 | Responsive padding steps per `html-tailwind` rows 9–10: `px-4 → md:px-6 → lg:px-8` on sections, `max-w-7xl` content container, narrow `max-width: 600px` for forms (matches deprecated Conversion-Optimized checklist), grid gaps `gap-4/6/8` instead of per-item margins, `space-y-*` for vertical lists | ✅ 360px and 1440px renders share the same tokens with stepped values; no full-width body copy on desktop |
| D4 | Component spacing tokens from `component-tokens.md`: buttons `px-4·py-2` / `px-6·py-3`, cards `p-6` + `space-y-4`, badges, inputs, table cells; touch gaps ≥8px between adjacent targets and ≥24px web pointer targets (`ux-guidelines` rows 23/104) | ✅ CTA/button audit flag for undersized or tightly-packed targets |

### 13.2 Landing-pattern alignment (extends `conversionPagePattern`, not a replacement)

UUPM's 34 `landing.csv` patterns supersede its own deprecated style rows 20/21/24/26 (Hero-Centric, Conversion-Optimized, Social-Proof, Trust&Authority) — we adopt the *patterns*, never the deprecated rows. Direct mappings for our demos:

| ID | Requirement (derived) | Acceptance (when implemented) |
|---|---|---|
| D5 | Extend `conversionPagePattern` with pattern IDs + section-order templates: `hero-testimonials-cta` (#2: hero → problem → solution → testimonials → CTA, hero-sticky + post-testimonial CTA repeat), `hero-centric` (#32: full-bleed hero → value strip → proof → CTA), `trust-authority` (#33: credibility hero → proof → solution → clear CTA path for legal/medical), `feature-showcase` (#31) for trades/real-estate, `pricing-focused` (#8/#14: cards + sticky nav CTA + FAQ + final CTA) where price data exists, `before-after` (#21) for beauty/dental/gallery-rich niches, `reviews-first` (#19) for 100+ review businesses | ✅ pattern selection is deterministic from (niche, photo count, review count, price presence); each pattern renders a distinct section order, not just re-skinned blocks |
| D6 | Adopt pattern CTA-placement rules: sticky hero CTA + exactly one repeat after proof/testimonials (never competing CTAs — already a `conversionAudit` flag, keep it), one CTA per banner min-44px (banner rules), final CTA band present on every pattern | ✅ audit asserts ≤2 CTA repeats per page with proof between them |

### 13.3 Industry must-have blocks (extends B1 grounding + C2/C3 depth, always source-safe)

`ui-reasoning.csv` rows for our exact niches carry `Decision_Rules` must-haves. Each becomes a conditional site block that renders **only when Places data supports it** (N1 still forbids invention):

| Google niche | UUPM row | Must-have → site block |
|---|---|---|
| Beauty/spa/salon | #32 Soft UI Evolution + Neumorphism, gold accents if luxury | booking block + before/after gallery (photos only) |
| Restaurant/cafe/bakery | #34/#63 warm palette, menu hover | menu-display + hours-prominent + online-ordering link (data-only) |
| Home services (plumber/electrician/HVAC) | #55 Flat + Accessible, trust blue + safety orange | sticky emergency-contact bar + certifications display (never invented) |
| Medical/dental/vet | #58/#60/#61 medical blue, social-proof-first | appointment/booking info + insurance info + testimonial carousel + before/after (photos only) |
| Legal | #40 navy + gold, Trust&Authority+Minimal | credential/case-result display (data-only) + guarantee statement slot |
| Real estate/hotel | #36/#38 glass/minimal + gold | map integration + amenity/room reveals + booking info |
| Auto/photo/coworking/florist | #52/#53/#54/#62 | comparison/financing slots (auto, data-only), portfolio showcase (photo studio), tour + booking (coworking), delivery/care info (florist) |

| ID | Requirement (derived) | Acceptance (when implemented) |
|---|---|---|
| D7 | Add per-industry must-have evaluation to generation/post-process: each block has a data precondition (e.g. booking block needs a real phone/URL), a rendered treatment, and an audit flag when the precondition holds but the block is missing | ✅ gate fails demos whose niche must-haves are satisfiable-but-absent; zero invented credentials |

### 13.4 Style, type, motion, color enrichment

| ID | Requirement (derived) | Acceptance (when implemented) |
|---|---|---|
| D8 | Enrich our 16 preset AI descriptors + CSS checklists from the *active* style rows: #19 Soft UI Evolution (8–12px radius, multi-layer soft shadows, 200–300ms, visible focus), #1 Minimalism & Swiss (12–16-col grid, no decoration, `gap: 2rem`, `max-width: 1200px`), #39 Bento Box Grid (4→2→1 cols, 16–24px radius, `gap: 16px`, hover 1.02), #66 Editorial Grid (asymmetric, pull quotes, drop caps, serif body) for story-rich niches, #12 Flat (≤6 solids, no shadows) for trades, #8 Accessible & Ethical as the floor for medical/legal | ✅ each preset carries keywords + effects + checklist; deprecated rows (20/21/24/26) are never referenced |
| D9 | Adopt the modular type scale (`ux-guidelines` row 74: 12·14·16·18·24·32) with body `1.5–1.75`, tight/snug headings, fluid `clamp()` hero sizes; cross-check our 30 font pairings against UUPM's 74 and fill niche gaps (wellness serif, legal traditional, trades bold-sans) | ✅ no arbitrary font sizes in generated CSS; hero scales without breakpoints |
| D10 | Adopt motion timing values (CSS-only, no GSAP runtime): hover 150–200ms `power1.out` feel, cards 200–300ms, scroll reveal 300–400ms, stagger 250–350ms, page fade 200–300ms; map onto our `motionLevel` subtle/standard/complex (scrub/parallax/elastic tiers stay opt-in, never default); `prefers-reduced-motion` already respected — keep it binding | ✅ timing audit: no animation outside the approved durations per level |
| D11 | Extend photo-derived palettes toward the UUPM color-row shape (primary/on-primary, secondary, accent, background/foreground, card, muted, border, ring) and bias per-industry palette focus (medical blue `#0077B6`, legal navy `#1E3A5F` + gold, restaurant warm, spa pastels + cream + gold) while keeping our contrast-token enforcement | ✅ every palette row ships on-× foregrounds with measured contrast |
| D12 | Extend the design/convert audits with the pre-delivery checklist subset that applies to web: text/chip/badge reflow without clipping (`+n` disclosure for chip overflow), badge meaning never color-alone, visible focus states, no emoji-as-icon (audit-then-standardize on one icon family — Phosphor/Heroicons/Lucide), 375/768/1024/1440 verification, light-mode contrast measured (we are light-first; verify, never assume) | ✅ checklist items are audit flags, not manual QA |

### 13.5 Deliberately NOT adopted (recorded so nobody re-proposes them)

- **Dark-mode-first / OLED / neon / AI-purple-gradients** for local SMB demos: explicit anti-patterns for beauty, legal, medical rows; our demos stay light-first.
- **GSAP runtime**: adopt timing/easing *values* only; generated static zips must not gain a JS animation dependency (export-parity + offline-open constraint).
- **Dashboard-density tier** (`DIAL_TIERS` dense: 3xl 32px): for admin/data UI only, never owner demos.
- **Logo / CIP / slides / banner-generator / social-photo subsystems**: brand-asset generation is outside the demo-site product (N-scope; revisit only if owner upsell needs it).
- **Blanket React memoization** (`react.csv` warns against it): renderer output is largely static per render; memoize only measured hotspots.
- **Deprecated style rows** 20/21/24/26 and supplemental/mobile-only styles: excluded from recommendations by the source itself; use §13.2 patterns instead.
