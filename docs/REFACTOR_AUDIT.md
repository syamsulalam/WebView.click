# Refactor Audit

Date: 2026-05-19
Last updated: 2026-05-21

Scope: source files with high line count, mixed responsibilities, or high change frequency in the WebView.click app. This is an audit only; it does not propose behavior changes in this pass.

## Executive Summary

The codebase would benefit from targeted refactoring. The main issue is not style preference; it is that several files now combine unrelated responsibilities, which makes small product fixes riskier than they need to be.

The highest-priority refactor target is `functions/api/[[path]].ts`. It is the production API surface for Cloudflare Pages Functions and now contains database setup, Google Places, manual imports, duplicate handling, AI readiness, AI generation, R2 storage, site post-processing, payments, domains, and routing in one file. This is the largest maintenance risk because unrelated edits can conflict and regression-test scope is hard to reason about.

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
- [x] Added D1-backed chunked generation jobs: `outline`, `copy`, and `finalize`.
- [x] Added per-step chunked progress and retry controls in the Jobs drawer.
- [x] Improved palette/photo parity between `/admin/leads`, `/admin/sites`, `/demo`, public `/:businessId`, and static download export.
- [x] Updated `docs/CODEBASE_REFERENCE.md` for the new generation and Jobs behavior.
- [x] Extracted AI offering outline, JSON repair, copy patch, copy audit, and deterministic merge helpers into `functions/api/ai/siteGeneration.ts`.
- [x] Extracted generation job listing, preflight/cooldown failure rows, chunked start, and chunked run-step handling into `functions/api/generationJobs/handler.ts`.
- [x] Extracted remaining site storage/R2 helpers into `functions/api/sites/storage.ts`.
- [x] Extracted Places search, details, cache trim, manual import, prospect upsert, and website precheck helpers into `functions/api/places/handler.ts`.

Still to do today if time allows:

- [x] Split chunked generation job API helpers out of `functions/api/[[path]].ts`.
- [x] Split AI provider call, JSON repair, offering outline, copy patch, and copy audit helpers out of `functions/api/[[path]].ts`.
- [x] Extract remaining site storage/R2 helpers out of `functions/api/[[path]].ts`.
- [x] Extract Places search/details/manual import helpers out of `functions/api/[[path]].ts`.
- [ ] Extract `GenerationJobsTable` drawer/details into smaller components or a `useGenerationJobRetry` hook.
- [x] Add targeted tests for offering outline normalization and copy audit behavior.
- [x] Add targeted tests for chunked job step state.
- [ ] After production deploy, manually verify one `/admin/leads` generate and one `/admin/sites` generate against the same gathered record.

## Largest Files

| File | Lines | Audit Result |
| --- | ---: | --- |
| `functions/api/[[path]].ts` | 3485 | Improved. AI site generation, generation jobs, R2/site storage, and Places search/details/manual import moved out; remaining risk is Places photo/history/duplicates, payments, domains, and router still living together. |
| `functions/api/ai/siteGeneration.ts` | 1342 | New focused module. Large but cohesive around AI offering/copy generation; good candidate for continued direct tests. |
| `src/pages/admin/AdminLeads.tsx` | 2111 | Improved. Scaffold/generation helpers moved out, but CRM, search, import, duplicate review, filters, and UI are still mixed. |
| `src/components/SiteRenderer.tsx` | 1878 | Needs refactor carefully. Visitor renderer is shared by `/demo`, `/:businessId`, and export preparation, so extraction should preserve behavior. |
| `src/components/GenerationJobsTable.tsx` | 1006 | Needs split soon. Chunked progress/retry drawer pushed this beyond watchlist size. |
| `src/lib/siteStylePresets.ts` | 1106 | Watchlist. Large but mostly registry/config; split only if editing gets painful. |
| `src/pages/admin/AdminSites.tsx` | 822 | Improved. Scaffold/generation helpers moved out; generated-site management UI can be split later. |
| `src/pages/admin/AdminSettings.tsx` | 823 | Watchlist. Could split settings sections after higher-risk files. |
| `functions/api/places/handler.ts` | 751 | New focused module for Places search/details/cache trim/manual import, including prospect upsert and website precheck. |
| `functions/api/generationJobs/handler.ts` | 413 | New focused module for Jobs API. Keep behavior stable and test through endpoint-level fixtures later. |
| `functions/api/sites/storage.ts` | 322 | New focused module for R2 JSON storage, asset upload, compact manifests, and migration. |

## Priority 1: Cloudflare API Function

File: `functions/api/[[path]].ts`

Current mixed responsibilities:

- D1 schema setup, repair, and column migration.
- Settings and public settings.
- Daily usage counters.
- AI provider readiness, remote validation cache, failure diagnostics, and provider health.
- Provider cooldowns and cooldown event pruning.
- Google Places photo/history/manual duplicate review. Search, details, cache trim, manual import, prospect upsert, and website precheck now live in `functions/api/places/handler.ts`.
- Manual duplicate detection and merge.
- Prospects, leads, CRM activity.
- Generation jobs and retry/preflight failure recording.
- AI offering outline prompt, JSON repair, copy patch prompt, provider calls, response parsing, copy audit, deterministic merge.
- Chunked generation step orchestration for outline/copy/finalize.
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
   - Partially done in `siteGeneration.ts`: JSON provider calls, JSON repair, offering outline, copy patch, copy audit, and deterministic merge now live outside the router.
   - Future split, if needed: `providers.ts`, `jsonRepair.ts`, `offeringOutline.ts`, `copyPatch.ts`, `copyAudit.ts`.

5. `functions/api/places/*`
   - Partially done in `places/handler.ts`: search, details, cache trim, manual import, prospect upsert, and website precheck now live outside the router.
   - Still to do: move photo proxy, search history hydration, and manual duplicate review/merge.

6. `functions/api/sites/*`
   - Partially done in `sites/storage.ts`: R2 public URL, image filename normalization, image asset upload, JSON upload/read, compact manifest, site summary, and migrate-to-R2 helper.
   - Still to do: split site CRUD/generate handler itself after Places/manual import is isolated.

7. `functions/api/generationJobs/*`
   - Done in `generationJobs/handler.ts`: job listing, counts, preflight/cooldown failure recording, chunked start, run-step, and retry metadata updates.

8. `functions/api/payments/*` and `functions/api/domains/*`
   - payment config/mock provider logic and domain checks.

9. Keep `functions/api/[[path]].ts` as a thin router.

Why this matters:

- AI/provider changes currently happen near Places, payments, and domains code.
- Site generation failures are harder to isolate because prompt, provider call, storage, and DB update are in one control flow.
- Cloudflare Pages Functions free-tier constraints make it important to reason about expensive operations; usage counters, Places calls, AI readiness, generation, R2, and retries should be easier to review independently.

Suggested order:

1. Extract pure helpers that do not touch `db`, `env`, or `request`.
2. Done: extract AI provider/JSON repair/offering outline/copy patch helpers.
3. Done: extract generation job handlers, including chunked `outline`, `copy`, and `finalize`.
4. Done: extract site storage/R2 modules.
5. Done: extract Places search/details/manual import module.
6. Extract AI readiness/provider cooldown modules.
7. Leave routing extraction for last.

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

This grew past watchlist size after adding chunked job progress and per-step retry. It should be split after the higher-risk API extraction, or sooner if Jobs UI needs more controls.

- filter/sort helpers
- retry action hook for full-job retry and chunked step retry
- chunked progress drawer section
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
- Still needed: move Places photo/history/manual duplicate review into focused modules.
- Still needed: renderer can eventually consume the same normalization logic or at least match it intentionally.
