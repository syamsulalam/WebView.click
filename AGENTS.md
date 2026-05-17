# Repository Instructions

## Project Context
- This is the WebView.click app at https://webview.click.
- The app uses React, Vite, Express, TypeScript, Clerk, and SQLite.
- Production architecture is Cloudflare Pages + Pages Functions + D1 + R2. Express/SQLite exists as older/local architecture context, but production work should prioritize Cloudflare Pages Functions and D1/R2 compatibility.

## Product Goal
- WebView.click is a lead prospecting and AI website generation tool for finding Google Business Profile / Google Maps businesses, especially businesses without websites, then generating personalized demo websites for them.
- The commercial goal is to target high-value local businesses, especially US businesses, create strong personalized website demos from Google Places data, and convert owners into paid setup/hosting/domain customers.
- The free flow lets a business owner download a static website package. The paid flow is a done-for-you setup offer where WebView.click handles domain, hosting, DNS, upload, and setup.
- Prioritize workflows that help the admin find no-website prospects, gather accurate Google Business data, generate richer non-thin websites, preview/compare against the real listing, and convert the business owner.

## Existing Codebase Resources
- Admin CRM/prospecting lives mainly in `src/pages/admin/AdminLeads.tsx`.
- Generated/gathered site management lives in `src/pages/admin/AdminSites.tsx`.
- Public website preview rendering lives in `src/components/SiteRenderer.tsx`.
- Shared download/setup/domain/payment panel lives in `src/components/WebsiteActionPanel.tsx` and must stay shared by `/demo` and `/:businessId`.
- Cloudflare Pages Functions API lives in `functions/api/[[path]].ts`.
- Owner static HTML/zip export logic lives in `src/lib/exportSiteHtml.ts`.
- Niche style presets live in `src/lib/siteStylePresets.ts`.
- Font pairing presets live in `src/lib/fontPairings.ts`.
- Domain extension and domain pre-check logic lives in `src/lib/domainExtensions.ts` and `/api/domains/check`.
- AI pricing/model reference lives in `src/lib/aiPricing.ts` and `docs/AI_MODELS_RESEARCH.md`.
- Google Places data reference and photo strategy live in `docs/GOOGLE_PLACES_DATA_INVENTORY.md` and `docs/GOOGLE_PLACES_PHOTO_STRATEGY.md`.
- Codebase/page reference lives in `docs/CODEBASE_REFERENCE.md`; update it when behavior changes.

## Proactive Improvement Rule
- After completing a task, include a short "Suggested next improvement" note when there is an obvious next step that helps the product goal.
- Suggestions should be concrete and tied to conversion, prospect quality, generation quality, admin workflow speed, reliability, or export quality.
- Do not turn final answers into long roadmaps unless the user asks; keep the suggestion brief and actionable.
- If a discovered issue directly blocks the product goal, fix it when it is small and in-scope; otherwise mention it as the suggested next improvement.

## Development Rules
- Do not run a local development server for this repo.
- Do not run `npm run dev`, `npm run preview`, `npm run start`, or other commands that start a local HTTP server unless the user explicitly asks to override this rule.
- The user intends to test changes directly in production at https://webview.click.
- Do not run `npm run lint` for this repo anymore. The workspace intentionally may not have local TypeScript dependencies installed, and the user wants to avoid dependency/storage churn. Prefer lightweight checks such as `git diff --check`, JSON parsing, and targeted static inspection.

## Editing Guidelines
- Keep changes narrowly scoped to the requested behavior.
- Preserve existing user changes in the worktree.
- Use existing project patterns before introducing new abstractions.
- When adding a new admin feature, control, badge, status, or workflow action whose behavior is not obvious from the label alone, add a concise tooltip using the shared `src/components/HelpTooltip.tsx` component.
- When adding or materially changing a page, component, or Pages Function endpoint, update `docs/CODEBASE_REFERENCE.md` in the same change with its purpose, APIs, important state/logic, and debugging notes.
- Features added to `/demo` that affect visitor-facing website preview, download, checkout, domain selection, or setup flow must also be available on public preview routes `/:businessId`.
- Prefer one shared component for `/demo` and `/:businessId` behavior, with an explicit mode/variant prop for demo-specific differences, instead of maintaining duplicate UI logic in both places.
