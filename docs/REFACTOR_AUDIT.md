# Refactor Audit

Date: 2026-05-19

Scope: source files with high line count, mixed responsibilities, or high change frequency in the WebView.click app. This is an audit only; it does not propose behavior changes in this pass.

## Executive Summary

The codebase would benefit from targeted refactoring. The main issue is not style preference; it is that several files now combine unrelated responsibilities, which makes small product fixes riskier than they need to be.

The highest-priority refactor target is `functions/api/[[path]].ts`. It is the production API surface for Cloudflare Pages Functions and now contains database setup, Google Places, manual imports, duplicate handling, AI readiness, AI generation, R2 storage, site post-processing, payments, domains, and routing in one file. This is the largest maintenance risk because unrelated edits can conflict and regression-test scope is hard to reason about.

The second priority is shared site generation/normalization logic. We now have generation scaffolding, renderer normalization, export behavior, and admin fallback JSON all evolving together. Contact page creation, service page creation, feedback page creation, icon/copy behavior, and generated site navigation should not drift across those layers.

Admin UI files are also large, but they are a lower risk than the production Function because they can be split incrementally into presentational panels and hooks without changing API contracts.

## Largest Files

| File | Lines | Audit Result |
| --- | ---: | --- |
| `functions/api/[[path]].ts` | 5199 | Needs refactor. Too many production API domains in one function file. |
| `src/pages/admin/AdminLeads.tsx` | 2716 | Needs refactor. CRM, search, manual import, duplicate review, batch generation, scoring, palette/photo selection, and jobs are mixed. |
| `src/components/SiteRenderer.tsx` | 1921 | Needs refactor carefully. Visitor renderer is shared by `/demo`, `/:businessId`, and export preparation, so extraction should preserve behavior. |
| `src/pages/admin/AdminSites.tsx` | 1317 | Needs moderate refactor. Fallback site JSON builder and generated-site management UI should be separated. |
| `src/lib/siteStylePresets.ts` | 1106 | Watchlist. Large but mostly registry/config; split only if editing gets painful. |
| `src/components/GenerationJobsTable.tsx` | 853 | Watchlist. Can split details/audit drawers later. |
| `src/pages/admin/AdminSettings.tsx` | 823 | Watchlist. Could split settings sections after higher-risk files. |

## Priority 1: Cloudflare API Function

File: `functions/api/[[path]].ts`

Current mixed responsibilities:

- D1 schema setup, repair, and column migration.
- Settings and public settings.
- Daily usage counters.
- AI provider readiness, remote validation cache, failure diagnostics, and provider health.
- Provider cooldowns and cooldown event pruning.
- Google Places search/details/photo/cache/history/manual import.
- Manual duplicate detection and merge.
- Prospects, leads, CRM activity.
- Generation jobs and retry/preflight failure recording.
- AI copy patch prompt, provider calls, response parsing, copy audit, deterministic merge.
- Site post-processing such as contact page, gallery page, image filename normalization, color contrast, R2 image upload, R2 JSON upload, compact manifest.
- Payments and domain checking.
- Top-level route dispatch.

Recommended extraction boundaries:

1. `functions/api/_shared/response.ts`
   - `json`, `errorJson`, `readJsonBody`, response helpers.

2. `functions/api/_shared/db.ts`
   - D1 setup, `tableColumns`, `ensureColumn`, schema repair, common insert/update helpers.

3. `functions/api/_shared/settings.ts`
   - `getSetting`, settings endpoint helpers, public settings.

4. `functions/api/ai/*`
   - `readiness.ts`, `providers.ts`, `failures.ts`, `copyPatch.ts`, `copyAudit.ts`, `cooldowns.ts`.

5. `functions/api/places/*`
   - search, details, photos, cache/history, manual import, duplicate merge.

6. `functions/api/sites/*`
   - site CRUD, generation handler, post-processing, R2 storage, image asset upload.

7. `functions/api/payments/*` and `functions/api/domains/*`
   - payment config/mock provider logic and domain checks.

8. Keep `functions/api/[[path]].ts` as a thin router.

Why this matters:

- AI/provider changes currently happen near Places, payments, and domains code.
- Site generation failures are harder to isolate because prompt, provider call, storage, and DB update are in one control flow.
- Cloudflare Pages Functions free-tier constraints make it important to reason about expensive operations; usage counters, Places calls, AI readiness, generation, R2, and retries should be easier to review independently.

Suggested order:

1. Extract pure helpers that do not touch `db`, `env`, or `request`.
2. Extract AI readiness/provider/cooldown modules.
3. Extract site post-processing and storage modules.
4. Extract Places/manual import modules.
5. Leave routing extraction for last.

Avoid a big-bang rewrite. Each extraction should keep endpoint behavior and response shapes identical.

## Priority 2: Generated Site Model Drift

Files:

- `functions/api/[[path]].ts`
- `src/components/SiteRenderer.tsx`
- `src/pages/admin/AdminSites.tsx`
- `src/pages/admin/AdminLeads.tsx`
- `src/lib/exportSiteHtml.ts`

Current issue:

Generated-site behavior is split across several layers:

- Admin fallback JSON builders create the initial scaffold.
- `/api/sites/generate` applies AI copy patch and post-processes saved JSON.
- `SiteRenderer` normalizes old/missing structures at runtime.
- `exportSiteHtml` adds static HTML behavior after rendering.

This is why fixes like dedicated contact page routing need both renderer fallback and generator persistence. It works, but the responsibilities are blurry.

Recommended extraction:

1. `src/lib/generatedSiteSchema.ts`
   - Types for generated site JSON pages, sections, offers, contact, hours, brand, conversion.

2. `src/lib/generatedSiteNormalize.ts`
   - Shared normalization that can be used by renderer and admin preview paths where browser-only APIs are not needed.

3. `src/lib/generatedSitePostProcess.ts`
   - Pure post-processors:
   - `ensureServicesPage`
   - `ensureContactPage`
   - `ensureFeedbackPage`
   - `ensureGalleryPage`
   - `normalizeHeaderNavigation`
   - `normalizeGeneratedCtas`

4. `src/lib/generatedSiteScaffold.ts`
   - Fallback site JSON builder currently embedded in admin pages.

Risk note:

Cloudflare Functions cannot import arbitrary browser-only React code. Shared generated-site logic should stay plain TypeScript with no DOM/React dependency.

## Priority 3: Admin Leads

File: `src/pages/admin/AdminLeads.tsx`

Current mixed responsibilities:

- Lead list and CRM status.
- Google Places search.
- Manual Maps URL/captured JSON import.
- Search history.
- Duplicate review/merge queue.
- Places detail gathering.
- Logo/photo selection.
- Palette extraction from image.
- Prospect scoring and filters.
- AI provider/model readiness.
- Single and batch site generation.
- Generation job drawer.
- Large rendered UI for multiple workflow tabs.

Recommended extraction boundaries:

1. `src/pages/admin/leads/useProspectSearch.ts`
   - search query, website precheck options, search history, cache trim.

2. `src/pages/admin/leads/useManualImport.ts`
   - manual Maps import, captured JSON parsing UI state, duplicate queue actions.

3. `src/pages/admin/leads/useProspectDetails.ts`
   - Places details loading, photo selection, palette options.

4. `src/pages/admin/leads/useSiteGenerationQueue.ts`
   - single generate, batch generate, cooldown/readiness checks, generation messages.

5. Presentational components:
   - `ProspectSearchPanel`
   - `ManualImportPanel`
   - `DuplicateReviewPanel`
   - `ProspectFiltersPanel`
   - `ProspectTable`
   - `BatchGenerateToolbar`

Suggested order:

Start by extracting presentational components that receive props. Leave hooks for later. This lowers risk because behavior stays in the parent while JSX shrinks.

## Priority 4: SiteRenderer

File: `src/components/SiteRenderer.tsx`

Current mixed responsibilities:

- Generated site normalization.
- Icon inference and duplicate icon prevention.
- Link and tab navigation.
- Header/submenu behavior.
- Hero H1 fitting.
- Section rendering for many section types.
- Feedback and contact forms.
- Footer rendering.
- Editable text wiring.
- Download/setup panel integration.

Recommended extraction boundaries:

1. `src/components/site-renderer/normalizeSiteData.ts`
   - Move `normalizeSiteData` and page insertion logic out of the component.

2. `src/components/site-renderer/icons.tsx`
   - `menuIcon`, `buttonIcon`, `copyIcon`, `renderCopyIcon`, icon candidate logic.

3. `src/components/site-renderer/hours.ts`
   - hours parsing, grouping, footer lines.

4. `src/components/site-renderer/navigation.ts`
   - tab/page target resolution helpers. Keep React state in the component or a small hook.

5. `src/components/site-renderer/sections/*`
   - `HeroSection`, `TrustBarSection`, `FeaturesSection`, `OffersSection`, `ReviewsSection`, `HoursLocationSection`, `FeedbackSection`, `ContactFormSection`, `FaqSection`, `ImageGallerySection`.

Risk note:

This renderer is shared by `/demo` and public `/:businessId`, so avoid changing markup and data attributes during extraction. Export behavior depends on `data-wv-*` attributes.

## Priority 5: Admin Sites

File: `src/pages/admin/AdminSites.tsx`

Current mixed responsibilities:

- Generated sites list.
- Gathered prospects ready to generate.
- Fallback JSON builder.
- AI readiness and cooldown controls.
- Regenerate and resave workflows.
- Data/brief modal.
- Table rendering.

Recommended extraction:

1. Move fallback/scaffold functions to `src/lib/generatedSiteScaffold.ts`.
2. Extract `ReadyToGenerateTable`.
3. Extract `GeneratedSitesTable`.
4. Extract `RegenerateMenu`.
5. Keep the page as orchestration: data load, provider/model state, high-level actions.

This is a good second-phase UI refactor after `AdminLeads`, because it shares generation workflow concepts.

## Watchlist: Large but Acceptable For Now

`src/lib/siteStylePresets.ts`

This file is large, but much of it appears to be registry/configuration. Refactor only if style/shader preset edits become frequent or if preset-specific CSS bugs keep occurring. A reasonable split would be:

- `siteStylePresets/palettes.ts`
- `siteStylePresets/headerPresets.ts`
- `siteStylePresets/shaders.ts`
- `siteStylePresets/generatedCss.ts`

`src/components/GenerationJobsTable.tsx`

This can stay for now unless Jobs UI keeps growing. Future split:

- filter/sort helpers
- retry action hook
- copy audit drawer/details
- export button

`src/pages/admin/AdminSettings.tsx`

This is manageable but will grow. Future split by settings section:

- AI provider settings
- Places settings
- payment settings
- scoring settings
- cooldown history

## Refactor Guardrails

- Do not change endpoint response shapes while extracting.
- Preserve `data-wv-*` attributes in visitor-rendered HTML.
- Keep Cloudflare Pages Functions and D1/R2 compatibility first; do not move production logic into Express-only code.
- Prefer pure helper modules before hooks/components.
- Add small tests or static fixtures around generated-site post-processors before moving them, because they are now central to contact/services/feedback/gallery behavior.
- Refactor one boundary at a time and deploy between high-risk steps.
- Avoid dependency additions for the refactor; this can be done with TypeScript modules only.

## Recommended First Refactor Ticket

Extract generated-site post-processing into a pure shared module.

Status: implemented in `src/lib/generatedSitePostProcess.ts` with fixture coverage in `tests/generatedSitePostProcess.test.ts`. The module now owns services, contact, feedback, and gallery page insertion through `applyGeneratedSitePageInserts()`.
Follow-up status: generated-site scaffold creation is now centralized in `src/lib/generatedSiteScaffold.ts`, with `/admin/leads` and `/admin/sites` both using `buildGeneratedSiteScaffold()` before AI copy enrichment.

Follow-up status: admin generate/regenerate orchestration is now centralized in `src/lib/adminSiteGeneration.ts`, including cooldown/readiness preflight, Place Details parsing, scaffold payload creation, and `/api/sites/generate` posting for `/admin/leads` and `/admin/sites`.

Target functions:

- `ensureContactPage`
- `ensureGalleryPage`
- `ensureServicesPage`
- `ensureFeedbackPage`
- `applyGeneratedSitePageInserts`
- gallery image collection helpers
- contact source section detection

Why first:

- It directly reduces drift between generator, renderer, and export.
- It is smaller than splitting the entire API function.
- It protects recent product behavior around `#contact`, services, feedback, and gallery pages.
- It can be validated with fixture JSON without needing live Cloudflare/D1.

Expected outcome:

- `functions/api/[[path]].ts` becomes smaller.
- Site generation behavior becomes easier to test.
- Renderer can eventually consume the same normalization logic or at least match it intentionally.
