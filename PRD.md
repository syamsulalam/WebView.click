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

## 12 · Open decisions (need your call before P0)

1. **Photo sourcing depth:** stay with Places-proxy + owner uploads, or budget generated/stock imagery for zero-photo prospects?
2. **Outreach hard-block vs warn:** should C1 *disable* outreach actions, or show red badges but allow override with a reason?
3. **Pricing page:** does the owner preview need visitor-facing price ranges where Places data supports them, or keep pricing strictly in checkout/FAQ?
