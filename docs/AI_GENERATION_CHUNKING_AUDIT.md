# AI Generation Chunking Audit

Last updated: 26 Mei 2026.

## Goal

Generated WebView.click sites should not feel like thin Google Business Profile summaries. The target output is:

- grounded in Google Places facts: name, category, address, phone, hours, rating, reviews, and Maps URL;
- written in first-person owner voice, as if the business is speaking directly to customers;
- expanded into plausible high-intent services/products for the business category;
- each important service/product has a dedicated detail page with beefy summary, description, benefits, included steps, FAQ, and CTA;
- every AI step is auditable in `/admin/jobs`, including what AI returned and what was finally saved.

## What The Recent Report Shows

The reported job had `AI copy audit` data and 38 changed fields, but `AI returned outline` and `AI returned copy patch` were empty.

That can happen in two cases:

1. Older jobs were created before raw `offeringOutline` and `copyPatch` were stored in `generation_jobs.metadata_json`.
2. Chunked generation creates a parent job and a finalize child save job. If the admin opens the child row and the parent metadata was not carried forward, the child can show final audit but not the raw AI output.

The content itself also shows a generation-quality issue:

- Many service/detail fields stayed as scaffold copy.
- The homepage changed more than service pages.
- Some FAQ array fields show `Missing after`, meaning the patch and final shape drifted.
- The outline was not visible, so we could not confirm whether AI inferred a richer service list or whether the scaffold services were reused.

## What The Outline Is For

The outline step is not meant to write full website copy. It should infer the business's likely products/services from Google Places facts, category, business name, search query, and review themes.

For example, for a Dallas concrete pourer, the outline should create high-intent service records such as driveway concrete pouring, slab pours, patio/walkway concrete, commercial pour coordination, or ready-mix scheduling, as long as they are plausible and do not invent certifications, exact prices, warranties, staff size, equipment, or completed projects.

Code then validates that outline and deterministically rebuilds:

- `products` / `services`
- homepage offer cards
- services aggregate navigation
- one detail page per service/product
- navbar submenu entries

## Root Causes

1. The previous metadata was not enough for audit.
   Raw parsed `offeringOutline` and `copyPatch` were not always stored on the row the admin opened.

2. The copy prompt was too broad.
   One copy patch asked AI to improve meta copy, homepage sections, offers, every offering record, and detail-page copy in one response. For businesses with many sections, the model can satisfy the schema with partial/minimal changes.

3. Service detail copy competed with homepage copy.
   The model saw many homepage targets first and could spend most of its output budget there, leaving detail-page fields unchanged.

4. Progress UI hid the quality boundary.
   The tracker showed `outline`, `copy`, `finalize`, but not whether the copy work was homepage/site copy or service/offering copy.

## Implemented Fix Direction

- Store raw parsed AI outline and copy patch metadata on new jobs.
- Carry parent outline/copy/audit metadata into the finalize child job, including the separate site-copy and offering-copy patches.
- Split the chunked flow from `outline -> copy -> finalize` into:
  - `outline`: infer service/product records and rebuild deterministic pages.
  - `siteCopy`: rewrite homepage/meta/general site copy.
  - `offeringCopy`: focus only on service/product records and their detail pages.
  - `finalize`: merge patches and save the site.
- Mirror the extra chunk in `/admin/leads`, `/admin/sites`, and `/admin/jobs` progress/status surfaces.
- Micro-batch `offeringCopy` by provider/model speed mode. The visible step stays `Service copy`, but metadata stores `offeringCopyCursor`, `offeringCopyTotal`, per-item hashes, cumulative `offeringCopyPatch`, and cumulative coverage so a slow KIE response only risks one service item rather than the whole service-copy pass. `/admin/settings` stores `AI_SERVICE_COPY_PROVIDER_MODES_JSON`; slow mode caps service copy to 1 item/request, while standard mode can allow 1-4 items/request for faster models.

## Expected Result After Deploy

New generation jobs should show:

- `AI returned outline` populated for successful outline steps.
- `AI returned combined copy patch` populated with the merged site/offering patch used for final save.
- `AI returned site copy patch` and `AI returned offering copy patch` populated on the latest job row opened from `/admin/sites`.
- higher AI rewrite coverage on service/product summaries, descriptions, highlights, included items, and detail-page FAQ.
- `Offering copy coverage` badge in `/admin/jobs` showing how many services/products changed summary, description, highlights, or FAQ.
- server-backed `Low service copy` filter in `/admin/jobs` for jobs where fewer than half of services/products changed those key detail fields.
- one-click `Service copy` retry from low-coverage rows, which reruns `offeringCopy` and `finalize` without rebuilding the outline or full generation, then opens the new final save job drawer with a before/after coverage delta.
- service-copy progress such as `service copy 3/8` while the row is still resumable, plus pre-click estimates for remaining requests based on the provider/model speed mode.
- `Recommended: Slow mode` badge beside service-copy retry controls when recent local job history for that provider/model shows timeout/provider-temporary signals.
- fewer thin placeholder lines such as "Built around the needs customers usually search for...".

## Production QA

After deploying:

1. Generate a new no-website local service prospect from `/admin/leads` or `/admin/sites`.
2. Open `/admin/sites`, click the colored `Jobs` action for that site.
3. Confirm the drawer opens the latest job.
4. Confirm `Chunked generation` shows `Outline`, `Site copy`, `Offering copy`, and `Finalize`.
5. Confirm `AI returned outline`, `AI returned copy patch`, and `AI copy audit` are populated.
6. Confirm the `services changed/total` badge is green or amber; red means too many service pages stayed thin.
7. Use `/admin/jobs` filter `Low service copy` to find red/thin jobs across older pages.
8. Click `Improve services` or `Resume Service copy` on a low-coverage/stalled row and confirm service-copy progress advances item by item before `Finalize`.
9. Inspect public preview service pages and check that each service has owner-voice detail copy, practical benefits, included steps, FAQ, and contact CTA.
