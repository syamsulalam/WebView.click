# Admin Jobs User Guide

This guide is for `/admin/jobs`, the generation job audit and retry tool.

## What this page is for

Use this page when a generate/regenerate attempt fails, stops midway, uses fallback copy, or produces thin service pages.

The safest rule is:

- Use `Resume ...` or `Retry ...` step buttons when a chunked job stopped midway.
- Use `Improve services` when service/detail pages are thin.
- Use `Retry copy chunks` when AI copy ran but did not rewrite much.
- Use `Full retry` only when you want a brand-new generation attempt from the current saved site.

## The row actions

Each job row has several controls. They are intentionally separate because they do different things.

| Control | Use it for | What it does |
| --- | --- | --- |
| `Open preview` | Inspect the generated public site | Opens `/:businessId` in a new tab. |
| `Resume Outline`, `Resume Site copy`, `Resume Service copy`, `Resume Finalize` | A chunked job is still `running` but stopped midway | Runs only the waiting chunked step. This is the normal fix for a Pages Function/provider interruption. |
| `Retry Outline`, `Retry Site copy`, `Retry Service copy`, `Retry Finalize` | A chunked job is `failed` | Retries only the failed chunked step. |
| `Improve services` | Service pages are thin or service coverage is low | Reruns only the service/offering copy chunk, then finalizes. |
| `Retry copy chunks` | AI patch applied but copy did not meaningfully change | Reruns site-copy plus service-copy chunks, then finalizes. |
| `Full retry` | You want a new full attempt from current saved site data | Starts a new generation job from the current copy brief. This is heavier than resuming a chunk. |
| `Provider details` | Check selected provider/model/key/readiness and last provider failure | Opens the AI readiness panel only. This is not the job drawer. |
| `Job details` | Inspect a job, see chunked step state, copy audit, raw metadata, and step controls | Opens the right-side generation job drawer. |

## Provider details versus Job details

These are easy to confuse:

- `Provider details` is the small AI readiness panel. It shows key/model status and the last provider failure.
- `Job details` opens the right-side drawer. This is where chunked job progress, retry-step buttons, AI returned work, audit, and raw metadata live.

If the panel title says `AI provider details`, you are looking at provider readiness, not the job drawer.

If the drawer title says `Generation job drawer`, you are in the correct place for job debugging.

## How to retry a job that failed midway

1. Find the row for the business.
2. Look at the status badge.
3. If you see a row button like `Resume Service copy` or `Retry Outline`, click that first.
4. Wait for the message to say the step completed.
5. If the row or drawer now shows `Resume Finalize` or `Run Finalize`, click it to save the generated site.
6. Refresh jobs.
7. Open the newest final save job or preview the site.

Do not use `Full retry` first unless the step-specific resume fails repeatedly or the saved site data has changed and you intentionally want a new full attempt.

## How to use the job drawer

Click `Job details` on a row. A right-side panel opens with a visible `Job drawer` rail.

The important parts are near the top:

- `Next action`: tells you whether the job can continue from a specific chunk.
- `Chunked generation`: shows `Outline`, `Site copy`, `Service copy`, and `Finalize`.
- Step button: runs only the waiting or failed step.

Advanced/debug sections are lower in the drawer:

- `AI returned work`: raw AI JSON for outline/copy chunks.
- `AI copy audit`: what changed, stayed the same, or fell back.
- `Raw metadata`: full job metadata JSON.

## What the chunked steps mean

| Step | Meaning |
| --- | --- |
| `Outline` | AI infers service/product lines and page structure. |
| `Site copy` | AI rewrites homepage, meta, and general site copy. |
| `Service copy` | AI writes service/product detail copy, highlights, and FAQs. |
| `Finalize` | Saves the patched JSON as the generated site. |

If a provider returns HTTP 502, 503, 504, HTML, timeout, or temporary upstream failure, retry the same chunk once. If the same provider keeps failing, switch provider/model before running a full retry or new batch.

## Understanding service coverage

`services changed/total` is a quick signal for whether service/product pages were actually rewritten.

- `services 0/5`: service pages are likely thin.
- `services 3/5`: some service pages changed.
- `services 5/5`: service copy coverage is strong.
- `services ?/5`: older job or patch data exists but before/after coverage was not recorded.

Use `Improve services` when service coverage is low.

## Compact export for QA

`Export compact` copies visible jobs as JSON. It includes:

- job/provider/model/status
- failure stage and failure message
- AI readiness/cooldown metadata
- copy audit summary
- `offeringCopyCoverage`
- `copyOnlyRetryCoverageDelta`
- `copyOnlyRetryChangedDelta`

Use `copyOnlyRetryChangedDelta` to sort retry improvements quickly. Positive numbers mean the retry changed more service pages than before.
