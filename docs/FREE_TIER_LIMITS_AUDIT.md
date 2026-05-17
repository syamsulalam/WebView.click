# Free Tier Limits and Function Call Audit

Last reviewed: 2026-05-17.

Purpose: keep WebView.click friendly to the Cloudflare Pages Free tier and avoid surprise usage from Google Places, AI providers, Clerk, R2, and payment/domain integrations. Treat these limits as planning guardrails, not as guaranteed billing advice. Recheck the linked vendor pages before increasing automation volume.

## Verified Limits To Design Around

Sources:
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Google Maps Platform billing/pricing: https://developers.google.com/maps/billing-and-pricing/overview
- Clerk pricing: https://clerk.com/pricing

Cloudflare Pages Free:
- 500 builds per month.
- 1 concurrent build.
- 20 minute build timeout.
- 20,000 files per site.
- 25 MiB max single Pages asset.
- Pages Functions requests count toward Workers plan quota.

Cloudflare Workers Free, relevant because Pages Functions run on Workers:
- 100,000 requests per day.
- 50 subrequests per request.
- 10 ms CPU time per HTTP request.
- 128 MB memory.
- 6 simultaneous outgoing connections per request.

Cloudflare D1 Free:
- 5 million rows read per day.
- 100,000 rows written per day.
- 5 GB total storage.
- D1 free daily limits reset at 00:00 UTC.

Cloudflare R2 Free:
- 10 GB-month storage per month.
- 1 million Class A operations per month. PutObject and ListObjects are Class A examples.
- 10 million Class B operations per month. GetObject and HeadObject are Class B examples.
- Internet egress is free for Standard storage.

Google Maps Platform:
- Billing is SKU based and pay-as-you-go.
- Google documents monthly free billable events per SKU/category, but the exact safe monthly usage depends on the enabled APIs, billing account, SKU category, and current price list.
- Do not assume a large free Google Places budget inside the app. Bound search, detail, photo, and website precheck calls explicitly.

Clerk:
- Hobby includes 50,000 monthly retained users per app.
- Dashboard seats and machine auth/API key limits have their own pricing limits. Recheck Clerk pricing before adding server-side Clerk polling, machine-to-machine auth, or team-seat heavy workflows.

External paid providers:
- OpenRouter, OpenAI, Gemini, KIE.ai, Lemon Squeezy, RDAP, and Google Public DNS are not Cloudflare free-tier resources.
- Some calls are free or metadata-only, but they still consume Pages Function requests and Workers subrequests.

## Current Function Call Hotspots

`GET /api/places/search`
- External calls: 1 Google Places Text Search on cache miss or `refresh=1`.
- Optional extra calls: `websitePrecheck=1` runs Place Details calls for the top `precheckLimit` results. The current server cap is 20.
- D1 work: reads/writes `places_search_cache` and upserts `places_prospects`.
- Risk: a single admin search can become 1 + N Google Places requests when website precheck is enabled.
- Guardrail: keep `precheckLimit` bounded, default conservative, and avoid automatic refresh loops.

`GET /api/places/details`
- External calls: usually 1 Google Place Details call.
- No Google call for `manual:*`, `cid:*`, or complete local manual records. `maps:*` query placeholders fail clearly because they are not valid Place IDs.
- D1 work: updates detail fields, website status, phone, address, rating, maps URL, and cached details JSON.
- Risk: repeated gather attempts can burn Places quota without improving data.
- Guardrail: keep disabled UI states for placeholder IDs and surface last error instead of encouraging retries.

`GET /api/places/photo`
- External calls: 1 Google Places Photo proxy request per rendered image request.
- Risk: image galleries and repeated previews can create many photo requests.
- Guardrail: only render the selected/visible photos in admin, cap gallery candidates, and prefer cached browser images while reviewing.

`GET/POST /api/ai/readiness`
- External calls with `remoteValidate=1`:
  - OpenRouter: model list plus endpoint metadata, up to 2 provider calls.
  - OpenAI: model retrieve, 1 provider call.
  - Gemini: model retrieve/list metadata, 1 provider call.
  - KIE.ai and Opencode: local registry only today.
- D1 work: reads provider key/settings and caches supported remote validation results in `ai_readiness_cache` for 2 minutes per provider/model/key hash.
- Risk: repeated badge refreshes across pages/tabs can consume Workers requests and provider metadata calls.
- Guardrail: keep browser cache at 30 seconds, keep server remote-validation cache at 2 minutes, provide manual refresh with `refresh=1`, and avoid per-row readiness checks inside long lists.

`POST /api/generation-jobs/preflight-failure`
- External calls: none.
- D1 work: inserts one failed job and may update `places_prospects.last_error`.
- Risk: repeated blocked clicks can write many rows.
- Guardrail: show the Jobs `Preflight blocked` filter and readiness message clearly so admins fix settings instead of retrying blindly.

`POST /api/sites/generate`
- External calls: one AI generation call when AI copy patch is required.
- Possible R2 calls: upload final JSON and non-Google external image assets.
- D1 work: generation job insert/update, site manifest writes, prospect status update, activity writes.
- Risk: this is the most expensive app action because it can combine AI cost, D1 writes, R2 writes, and external asset fetches.
- Guardrail: run AI readiness before generation, send only the enrichment brief to AI, keep full JSON/schema generation deterministic, and avoid re-uploading Google Places photos to R2.

`GET /api/sites/:businessId`
- External calls: none expected.
- R2 calls: 1 GetObject if the site JSON is stored in R2.
- D1 work: lookup site manifest/row.
- Risk: public previews can add R2 Class B ops.
- Guardrail: keep JSON small enough for fast R2 reads and avoid fetching full JSON in list pages.

`GET /api/sites`
- External calls: none expected.
- D1 work: list site manifests.
- Risk: row reads grow with generated site count.
- Guardrail: keep paginated/list summaries in D1 and avoid reading R2 JSON per row.

`POST /api/sites/migrate-r2`
- External calls: none expected.
- R2 calls: PutObject per migrated site JSON.
- D1 work: reads old JSON and updates manifest/storage fields.
- Risk: batch migration can consume R2 Class A ops and D1 writes.
- Guardrail: run manually in small batches.

`POST /api/payments/checkout`
- External calls: 1 Lemon Squeezy checkout request if configured.
- D1 work: records checkout pending lead/activity.
- Risk: repeated checkout attempts can create duplicate payment records and external calls.
- Guardrail: keep checkout button intentional and continue recording mock checkout only when Lemon Squeezy is missing.

`GET /api/domains/check`
- External calls: RDAP via `rdap.net`, with Google Public DNS SOA fallback when needed.
- D1 work: none expected.
- Risk: domain typing/checking can create many external requests.
- Guardrail: use explicit Check action rather than checking on every keystroke.

Admin list endpoints such as `/api/stats`, `/api/activities`, `/api/leads`, `/api/prospects`, `/api/places/history`, and `/api/generation-jobs`
- External calls: none expected.
- D1 work: reads lists/counts.
- Risk: unbounded lists and global counts can scan too many rows as data grows.
- Guardrail: keep limits, offsets, indexes, and search scopes. For Jobs, server-backed filters should isolate specific failure classes without loading every row.

## Implementation Rules For Future Features

Before adding a new Pages Function endpoint, document:
- Worker request count: how many browser clicks or page loads call it.
- External subrequests: Google, AI, Lemon Squeezy, RDAP, DNS, R2, or other fetches.
- D1 rows read/written: expected and worst case.
- R2 Class A/Class B operations: expected and worst case.
- Retry behavior: whether the UI encourages repeated clicks.
- Cache behavior: browser cache, D1 cache, Cache API, or no cache.

Prefer:
- Manual refresh over background polling.
- Bounded limits over "all rows".
- Server-side pagination for admin history.
- D1/R2 cached data over repeated provider fetches.
- One readiness check per selected provider/model/action, not per table row.
- Preflight failure rows over failed full generation attempts when the issue is key/model/provider routing.

Avoid:
- Automatically remote-validating AI models for every job row.
- Automatically prechecking websites for every search result beyond a small cap.
- Rendering all Google Places photos at once.
- Fetching full R2 JSON in list views.
- Domain checks on every input character.
- Retry loops that call AI or Google without a changed input.

## Practical Daily Budgets

These are conservative operating budgets for staying well below the free tier while the product is still single-admin/manual:
- Places searches with website precheck: keep to tens per day, not hundreds.
- Place Details gathers: gather only promising prospects and avoid retrying placeholder rows.
- AI generations: generate only after Places data is gathered and readiness is green.
- R2 migrations: run in small manual batches.
- Jobs review: use filters such as `Preflight blocked`, `Failed`, and `No rewrite` instead of loading or retrying everything.

## Known Follow-Up

Add lightweight usage counters for high-risk endpoints such as Places search/detail, AI readiness remote validation, and site generation so daily admin activity can be compared against these guardrails.
