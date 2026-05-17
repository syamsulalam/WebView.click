# Google Maps Manual Import Plan

## Goal

Add an `/admin` fallback flow for prospecting when Google Places API quota is exhausted. The admin can paste a Google Maps / Google Business Profile URL and optionally paste captured listing JSON from a browser helper. Imported businesses become normal `places_prospects` records so they can feed the existing details, AI generation, and JSON-site workflows.

## Constraints

- Server-side scraping Google Maps HTML is brittle and often blocked by consent pages, bot protection, and client-rendered markup.
- Cloudflare Pages Functions should not depend on a headless browser runtime.
- A search-result Maps URL usually does not expose all visible businesses in the URL itself. The reliable manual path is to capture visible listing/detail data from the admin browser while the admin is already viewing Google Maps.
- The first implementation should store usable prospect drafts without changing the existing paid/demo generation flow.

## Implementation

1. Add an admin "Manual Google Maps import" panel in `/admin/leads`.
   - URL input accepts Google Maps listing URLs or search-result URLs.
   - Optional textarea accepts captured JSON from a browser helper/extension.
   - Tooltips explain when URL-only import is enough and when captured JSON is required.

2. Add `POST /api/places/manual-import`.
   - Detect whether the URL looks like a single listing or a search page.
   - If captured JSON is provided, normalize every captured business into `places_prospects`.
   - If only a listing URL is provided, create a single prospect draft from URL-derived fields so the admin can enrich/generate later.
   - If only a search URL is provided, return a clear "browser capture required" result instead of pretending the server can read the page.

3. Add a Chrome/Opera unpacked extension helper under `public/tools/google-maps-capture-extension`.
   - Runs only on `google.com/maps`.
   - Captures visible place links/cards and the currently opened detail panel using DOM heuristics.
   - Copies JSON that can be pasted into the admin manual import textarea.

4. Documentation and QA.
   - Update `docs/CODEBASE_REFERENCE.md` with the new admin panel, endpoint, and extension helper.
   - Run lightweight checks only (`git diff --check`) per repo instructions.

## Expected Admin Workflow

1. Open Google Maps manually.
2. For one listing, paste the listing URL into `/admin/leads` and import.
3. For search results, use the extension on the Google Maps tab to copy visible listing JSON, then paste that JSON into `/admin/leads` with the search URL.
4. Review imported prospect drafts in the normal pipeline, gather details where possible, then generate the website.

## Later Improvements

- Add direct extension-to-admin posting after authentication/session handling is reviewed.
- Add duplicate review UI when the same manual listing is captured with slightly different names or URLs.
- Add richer DOM parsing for categories, hours, popular times, photos, and owner response snippets when visible in Google Maps.
