# Refactor Audit

Date: 2026-05-19
Last updated: 2026-05-25

Scope: source files with high line count, mixed responsibilities, or high change frequency in the WebView.click app. This is an audit only; it does not propose behavior changes in this pass.

## Executive Summary

The codebase would benefit from targeted refactoring. The main issue is not style preference; it is that several files now combine unrelated responsibilities, which makes small product fixes riskier than they need to be.

The highest-priority refactor target remains `functions/api/[[path]].ts`. It is the production API surface for Cloudflare Pages Functions and is now close to a thin router: dependency wiring, schema bootstrap, and route dispatch. The highest-risk conversion/generation handlers, shared response/DB/schema helpers, and remaining settings/stats/leads/prospects handlers are now split into focused modules.

The second priority is shared site generation/normalization logic. We now have generation scaffolding, renderer normalization, export behavior, and admin fallback JSON all evolving together. Contact page creation, service page creation, feedback page creation, icon/copy behavior, and generated site navigation should not drift across those layers.

Admin UI files are also large, but they are a lower risk than the production Function because they can be split incrementally into presentational panels and hooks without changing API contracts.

## Progress Update: 2026-05-21

Completed since this audit was written:

- [x] Extracted generated-site post-processing into `src/lib/generatedSitePostProcess.ts`.
- [x] Added fixture coverage for generated-site post-processing in `tests/generatedSitePostProcess.test.ts`.
- [x] Centralized generated-site scaffold creation in `src/lib/generatedSiteScaffold.ts`.
- [x] Centralized admin generation orchestration in `src/lib/adminSiteGeneration.ts`.
- [x] Made `/admin/leads`, `/admin/sites`, and Jobs retry use the same generation payload/preflight path.
- [x] Added deterministic AI offering outline handling before copy patch, with max 12 generated offerings and one JSON repair attempt.
- [x] Added D1-backed chunked generation jobs: `outline`, `siteCopy`, `offeringCopy`, and `finalize`.
- [x] Added per-step chunked progress and retry controls in the Jobs drawer.
- [x] Improved palette/photo parity between `/admin/leads`, `/admin/sites`, `/demo`, public `/:businessId`, and static download export.
- [x] Updated `docs/CODEBASE_REFERENCE.md` for the new generation and Jobs behavior.
- [x] Extracted AI offering outline, JSON repair, copy patch, copy audit, and deterministic merge helpers into `functions/api/ai/siteGeneration.ts`.
- [x] Extracted generation job listing, preflight/cooldown failure rows, chunked start, and chunked run-step handling into `functions/api/generationJobs/handler.ts`.
- [x] Extracted remaining site storage/R2 helpers into `functions/api/sites/storage.ts`.
- [x] Extracted Places search, details, cache trim, manual import, prospect upsert, and website precheck helpers into `functions/api/places/handler.ts`.
- [x] Extracted Places photo proxy, search history hydration, and manual duplicate review/merge into `functions/api/places/handler.ts`.
- [x] Extracted Jobs retry orchestration into `src/components/generation-jobs/useGenerationJobRetry.ts`.

Still to do today if time allows:

- [x] Split chunked generation job API helpers out of `functions/api/[[path]].ts`.
- [x] Split AI provider call, JSON repair, offering outline, copy patch, and copy audit helpers out of `functions/api/[[path]].ts`.
- [x] Extract remaining site storage/R2 helpers out of `functions/api/[[path]].ts`.
- [x] Extract Places search/details/manual import helpers out of `functions/api/[[path]].ts`.
- [x] Extract `GenerationJobsTable` drawer/details into smaller components and move job display/filter helpers beside it.
- [x] Extract `GenerationJobsTable` retry orchestration into `src/components/generation-jobs/useGenerationJobRetry.ts`.
- [x] Move Places photo proxy, search history hydration, and manual duplicate review/merge into `functions/api/places/handler.ts`.
- [x] Extract AI readiness, provider failure/health, and provider cooldown handling into focused modules.
- [x] Extract payment checkout and domain availability handlers into focused modules.
- [x] Extract site CRUD/generate save orchestration into `functions/api/sites/handler.ts`.
- [x] Extract shared response, D1 helper, schema setup, repair, and required-column lists into `functions/api/_shared/*`.
- [x] Extract settings, stats/activity, leads, and prospects route handlers into focused modules.
- [x] Added lightweight endpoint-level fixtures for prospect filters and site generate-save behavior in `tests/apiHandlers.test.ts`.
- [x] Add targeted tests for offering outline normalization and copy audit behavior.
- [x] Add targeted tests for chunked job step state.
- [ ] After production deploy, manually verify one `/admin/leads` generate and one `/admin/sites` generate against the same gathered record.

## Largest Files

| File | Lines | Audit Result |
| --- | ---: | --- |
| `functions/api/[[path]].ts` | 301 | Improved. Now close to a thin router: imports, dependency wiring, DB bootstrap, and route dispatch. |
| `functions/api/ai/siteGeneration.ts` | 1342 | New focused module. Large but cohesive around AI offering/copy generation; good candidate for continued direct tests. |
| `src/pages/admin/AdminLeads.tsx` | 2111 | Improved. Scaffold/generation helpers moved out, but CRM, search, import, duplicate review, filters, and UI are still mixed. |
| `src/components/SiteRenderer.tsx` | 1878 | Needs refactor carefully. Visitor renderer is shared by `/demo`, `/:businessId`, and export preparation, so extraction should preserve behavior. |
| `src/components/GenerationJobsTable.tsx` | 497 | Improved. Drawer, retry orchestration, and job helpers moved into focused `generation-jobs/*` modules; remaining responsibility is table data loading/search/filter/rendering. |
| `src/lib/siteStylePresets.ts` | 1106 | Watchlist. Large but mostly registry/config; split only if editing gets painful. |
| `src/pages/admin/AdminSites.tsx` | 822 | Improved. Scaffold/generation helpers moved out; generated-site management UI can be split later. |
| `src/pages/admin/AdminSettings.tsx` | 823 | Watchlist. Could split settings sections after higher-risk files. |
| `functions/api/places/handler.ts` | 1117 | Focused module for Places search/details/cache trim/manual import/photo/history/duplicate handling, including prospect upsert and website precheck. Large but cohesive around Places/prospect ingestion. |
| `functions/api/sites/handler.ts` | 710 | New focused module for site list/read/copy brief/generate save orchestration, final D1/R2 writes, lead/prospect updates, and generation job status updates. |
| `functions/api/ai/readiness.ts` | 611 | New focused module for AI readiness, remote model validation cache, provider failure diagnostics, and provider health endpoints. |
| `functions/api/generationJobs/handler.ts` | 413 | New focused module for Jobs API. Keep behavior stable and test through endpoint-level fixtures later. |
| `functions/api/_shared/db.ts` | 298 | New shared module for D1 binding access, column checks, common upsert/update helpers, settings lookup, and daily usage counters. |
| `functions/api/sites/storage.ts` | 322 | New focused module for R2 JSON storage, asset upload, compact manifests, and migration. |
| `functions/api/_shared/schema.ts` | 197 | New shared module for required column lists, table setup, and database repair reporting. |
| `functions/api/payments/handler.ts` | 293 | New focused module for checkout creation, payment provider selection, checkout-pending lead/activity writes, and manual/mock fallback links. |
| `functions/api/domains/handler.ts` | 125 | New focused module for RDAP/DNS domain availability pre-checks and already-owned domain setup signals. |
| `functions/api/providerCooldowns/handler.ts` | 201 | New focused module for provider cooldown rows, history feed, event insert, and event pruning. |
| `functions/api/prospects/handler.ts` | 125 | New focused module for prospect list filters, status updates, and selected photo/palette saves. |
| `functions/api/leads/handler.ts` | 74 | New focused module for lead list/status/ping handling. |
| `functions/api/settings/handler.ts` | 60 | New focused module for private/public settings endpoints. |
| `functions/api/stats/handler.ts` | 51 | New focused module for dashboard stats and recent activities. |

## Priority 1: Cloudflare API Function

File: `functions/api/[[path]].ts`

Current mixed responsibilities:

- D1 schema setup, repair, column migration, common DB writes, and response helpers now live in `functions/api/_shared/*`.
- Settings and public settings now live in `functions/api/settings/handler.ts`.
- Daily usage counters now live in `_shared/db.ts` and are surfaced through `functions/api/stats/handler.ts`.
- AI provider readiness, remote validation cache, failure diagnostics, provider health, provider cooldowns, and cooldown event pruning now live in focused modules.
- Google Places handlers now live in `functions/api/places/handler.ts`: search, details, cache trim, manual import, prospect upsert, website precheck, photo proxy, search history hydration, and manual duplicate review/merge.
- Prospects now live in `functions/api/prospects/handler.ts`; leads live in `functions/api/leads/handler.ts`; stats/activity feed live in `functions/api/stats/handler.ts`.
- Site CRUD/generate save orchestration and final D1/R2 manifest writes now live in `functions/api/sites/handler.ts`.
- Payments and domain checking now live in focused modules.
- Top-level route dispatch.

Recommended extraction boundaries:

1. `functions/api/_shared/response.ts`
   - Done: `json`, `errorJson`, `corsHeaders`, `readJsonBody`, parse/string/hash helpers.

2. `functions/api/_shared/db.ts`
   - Done: D1 binding access, `tableColumns`, `ensureColumn`, `ensureRequiredColumns`, common insert/update helpers, settings lookup, and daily usage counters.

3. `functions/api/_shared/settings.ts`
   - `getSetting` is done in `_shared/db.ts`; settings endpoint handlers now live in `functions/api/settings/handler.ts`.

4. `functions/api/ai/*`
   - Partially done in `siteGeneration.ts`: JSON provider calls, JSON repair, offering outline, copy patch, copy audit, and deterministic merge now live outside the router.
   - Done in `readiness.ts`: AI readiness, remote model validation cache, provider failure diagnostics, and provider health endpoints.
   - Future split, if needed: `providers.ts`, `jsonRepair.ts`, `offeringOutline.ts`, `copyPatch.ts`, `copyAudit.ts`.

5. `functions/api/places/*`
   - Done in `places/handler.ts`: search, details, cache trim, manual import, prospect upsert, website precheck, photo proxy, search history hydration, and manual duplicate review/merge now live outside the router.

6. `functions/api/sites/*`
   - Done in `sites/storage.ts`: R2 public URL, image filename normalization, image asset upload, JSON upload/read, compact manifest, site summary, and migrate-to-R2 helper.
   - Done in `sites/handler.ts`: site list/read/copy brief, generate save orchestration, deterministic visual/font/favicon defaults, final D1/R2 manifest writes, lead/prospect updates, and generation job success/failure updates.

7. `functions/api/generationJobs/*`
   - Done in `generationJobs/handler.ts`: job listing, counts, preflight/cooldown failure recording, chunked start, run-step, and retry metadata updates.

8. `functions/api/providerCooldowns/*`
   - Done in `providerCooldowns/handler.ts`: cooldown reads/writes, history feed, event insert, and pruning.

9. `functions/api/payments/*` and `functions/api/domains/*`
   - Done in `payments/handler.ts`: payment config, checkout creation, checkout-pending CRM writes, and mock/manual fallback links.
   - Done in `domains/handler.ts`: RDAP primary check and Google Public DNS fallback signal.

10. Keep `functions/api/[[path]].ts` as a thin router.
   - Done: the catch-all is now mostly dependency wiring, DB bootstrap, and route dispatch.

Why this matters:

- Site generation save changes are now isolated from payments/domains/Places routes.
- Remaining router risk is concentrated in dependency wiring and endpoint dispatch order.
- Cloudflare Pages Functions free-tier constraints make it important to reason about expensive operations; usage counters, Places calls, AI readiness, generation, R2, and retries should be easier to review independently.

Suggested order:

1. Extract pure helpers that do not touch `db`, `env`, or `request`.
2. Done: extract AI provider/JSON repair/offering outline/copy patch helpers.
3. Done: extract generation job handlers, including chunked `outline`, `siteCopy`, `offeringCopy`, and `finalize`.
4. Done: extract site storage/R2 modules.
5. Done: extract Places search/details/manual import module.
6. Done: extract remaining Places photo/history/manual duplicate handlers.
7. Done: extract AI readiness/provider cooldown modules.
8. Done: extract payments/domains.
9. Done: split site CRUD/generate save orchestration.
10. Done: extract shared DB/response/schema helpers.
11. Done: extract settings, stats/activity, leads, and prospects handlers.

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

- `src/lib/generatedSiteScaffold.ts` now creates the initial scaffold for both admin paths.
- `/api/sites/generate` applies AI offering outline, AI copy patch, and post-processes saved JSON.
- `SiteRenderer` normalizes old/missing structures at runtime, including fallback palette options for older generated sites.
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
   - Done. Fallback site JSON builder is now centralized here.

5. `src/lib/generatedSiteOfferings.ts`
   - Next candidate for extracted pure logic: offering ID/slug generation, outline normalization, stale detail-page cleanup, nav child rebuild, and services aggregate page rebuild.

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

This was split after chunked job progress and per-step retry pushed too much behavior into one component.

- Done: filter/sort/copy-audit helpers live in `src/components/generation-jobs/jobUtils.ts`.
- Done: chunked progress drawer/details and copy audit drawer/details live in `src/components/generation-jobs/GenerationJobDetailsDrawer.tsx`.
- Done: retry action hook for full-job retry and chunked step retry lives in `src/components/generation-jobs/useGenerationJobRetry.ts`.
- Still possible later: export button/helper if export payload grows.

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

Status checklist:

- [x] Implemented `src/lib/generatedSitePostProcess.ts`.
- [x] Added fixture coverage in `tests/generatedSitePostProcess.test.ts`.
- [x] Moved services, contact, feedback, and gallery page insertion behind `applyGeneratedSitePageInserts()`.
- [x] Centralized generated-site scaffold creation in `src/lib/generatedSiteScaffold.ts`.
- [x] Updated `/admin/leads` and `/admin/sites` to use `buildGeneratedSiteScaffold()` before AI enrichment.
- [x] Centralized admin generate/regenerate orchestration in `src/lib/adminSiteGeneration.ts`.
- [x] Added shared chunked generation client helper `postChunkedGenerateSite()`.
- [x] Updated `/admin/leads`, `/admin/sites`, and Jobs retry to use chunked generation for AI paths.
- [x] Preserved palette options and active palette export across generated preview/download paths.
- [x] Extract offering outline normalization/apply helpers out of `functions/api/[[path]].ts`.
- [x] Extract chunked generation job handlers out of `functions/api/[[path]].ts`.
- [x] Add direct tests for offering outline normalization and copy audit behavior.
- [x] Add direct tests for chunked step UI state.

Target functions:

- `ensureContactPage`
- `ensureGalleryPage`
- `ensureServicesPage`
- `ensureFeedbackPage`
- `applyGeneratedSitePageInserts`
- gallery image collection helpers
- contact source section detection
- offering outline normalization/apply helpers
- chunked generation step handlers

Why first:

- It directly reduces drift between generator, renderer, and export.
- It is smaller than splitting the entire API function.
- It protects recent product behavior around `#contact`, services, feedback, and gallery pages.
- It can be validated with fixture JSON without needing live Cloudflare/D1.

Expected outcome:

- Done: site generation behavior is easier to test for page inserts and scaffold creation.
- Partially done: renderer/export drift around palette options is reduced.
- Done: `functions/api/[[path]].ts` is smaller after moving AI offering/copy/chunked job logic into focused modules.
- Done: move R2/site storage logic into a focused module.
- Done: move Places search/details/manual import logic into a focused module.
- Done: move Places photo/history/manual duplicate review into the focused Places handler module.
- Still needed: renderer can eventually consume the same normalization logic or at least match it intentionally.
