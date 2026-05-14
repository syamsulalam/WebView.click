# Repository Instructions

## Project Context
- This is the WebView.click app at https://webview.click.
- The app uses React, Vite, Express, TypeScript, Clerk, and SQLite.

## Development Rules
- Do not run a local development server for this repo.
- Do not run `npm run dev`, `npm run preview`, `npm run start`, or other commands that start a local HTTP server unless the user explicitly asks to override this rule.
- The user intends to test changes directly in production at https://webview.click.
- Prefer verification commands that do not start a server, such as `npm run lint` and `npm run build`.

## Editing Guidelines
- Keep changes narrowly scoped to the requested behavior.
- Preserve existing user changes in the worktree.
- Use existing project patterns before introducing new abstractions.
