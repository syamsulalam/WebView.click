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
- Keep token use lean during routine changes: use small targeted file reads, avoid dumping long diffs unless needed for diagnosis, skip unnecessary explanation, and keep progress/final notes short unless deeper reasoning is required.

## AI Job Reliability Rule
- Any new AI-powered workflow must be implemented as a chunked, resumable job instead of one large request. Split work into small steps such as preflight, outline/planning, site/general copy, one service/product detail copy item or micro-batch, deterministic post-process, and finalize/save.
- Avoid adding browser calls or Pages Function endpoints that ask AI to rewrite a whole site, all services, design strategy, and final save in one invocation. Cloudflare 502/HTML, 503, 504, 524, provider temporary errors, and timeouts should fail only the current chunk and be retryable/resumable.
- Default AI copy detail chunks should be conservative: prefer one service/product per `offeringCopy` request unless the code has explicit provider/model evidence that a larger batch is safe. Expose progress and next-step metadata in `generation_jobs.metadata_json` so Admin UI can show progress bars and resume/retry from the failed chunk.
- Before adding or changing an AI job, check existing chunked flow in `functions/api/generationJobs/handler.ts` and `src/lib/adminSiteGeneration.ts`; reuse it when possible instead of creating a separate one-off AI call.

## Work Reporting Preference
- Prefer completing the requested task end-to-end before reporting back.
- Do not send progress updates after every small step during normal implementation.
- Report only when the task is finished, blocked, or a meaningful approval/decision is needed.
- Keep final reports concise: changed files, verification performed, and the next production-testing step.

## Session Summary Rule
- Do not update `SESSION_SUMMARY.md` during normal task iteration, review/fix cycles, follow-up revisions, or because a single implementation step appears complete.
- Create or update `SESSION_SUMMARY.md` only when the user explicitly asks for a session summary, says the session is ending/closing, says usage limit is almost reached, or asks to wrap up/checkpoint the work.
- The session summary must be in table format and include WIB timestamps with date, hour, minute, and second.
- Insert new summary rows directly below the table header so the newest context is at the top.
- Summaries should capture what changed, important files, verification performed, tests intentionally not run, and the next production-testing step.
- Keep the summary factual and concise enough to resume work without rereading the whole conversation.

## Editing Guidelines
- Keep changes narrowly scoped to the requested behavior.
- Preserve existing user changes in the worktree.
- Use existing project patterns before introducing new abstractions.
- Code new features modularly from the start. If a page/component is gaining a distinct workflow, state cluster, table/card renderer, modal/drawer, or API action group, create a focused component or hook in the same change instead of letting one file grow into a later refactor target. As a rough trigger, avoid adding large JSX blocks or multiple unrelated state groups to files that are already several hundred lines long.
- Before adding admin UI controls, inspect the surrounding controls and preserve their density and pattern. In compact row action clusters that use square icon-only buttons, add new actions as matching icon-only buttons with tooltip/aria labels rather than wider text buttons that disrupt the layout.
- For admin collapsible card/section headers, use the shared `src/components/AdminCollapsibleSectionHeader.tsx` pattern: left icon before the heading, concise help tooltip near the title, optional action icons hidden while collapsed, and a right-aligned chevron. Do not mix one-off header layouts in the same admin page.
- When adding a new admin feature, control, badge, status, or workflow action whose behavior is not obvious from the label alone, add a concise tooltip using the shared `src/components/HelpTooltip.tsx` component.
- When adding or materially changing a page, component, or Pages Function endpoint, update `docs/CODEBASE_REFERENCE.md` in the same change with its purpose, APIs, important state/logic, and debugging notes.
- Features added to `/demo` that affect visitor-facing website preview, download, checkout, domain selection, or setup flow must also be available on public preview routes `/:businessId`.
- Prefer one shared component for `/demo` and `/:businessId` behavior, with an explicit mode/variant prop for demo-specific differences, instead of maintaining duplicate UI logic in both places.
