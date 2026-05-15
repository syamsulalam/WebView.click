# Repository Instructions

## Project Context
- This is the WebView.click app at https://webview.click.
- The app uses React, Vite, Express, TypeScript, Clerk, and SQLite.

## Development Rules
- Do not run a local development server for this repo.
- Do not run `npm run dev`, `npm run preview`, `npm run start`, or other commands that start a local HTTP server unless the user explicitly asks to override this rule.
- The user intends to test changes directly in production at https://webview.click.
- Do not run `npm run lint` for this repo anymore. The workspace intentionally may not have local TypeScript dependencies installed, and the user wants to avoid dependency/storage churn. Prefer lightweight checks such as `git diff --check`, JSON parsing, and targeted static inspection.

## Editing Guidelines
- Keep changes narrowly scoped to the requested behavior.
- Preserve existing user changes in the worktree.
- Use existing project patterns before introducing new abstractions.
- When adding or materially changing a page, component, or Pages Function endpoint, update `docs/CODEBASE_REFERENCE.md` in the same change with its purpose, APIs, important state/logic, and debugging notes.
- Features added to `/demo` that affect visitor-facing website preview, download, checkout, domain selection, or setup flow must also be available on public preview routes `/:businessId`.
- Prefer one shared component for `/demo` and `/:businessId` behavior, with an explicit mode/variant prop for demo-specific differences, instead of maintaining duplicate UI logic in both places.
