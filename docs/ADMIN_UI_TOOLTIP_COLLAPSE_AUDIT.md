# Admin UI Tooltip and Collapse Audit

Last updated: 25 May 2026.

Purpose: keep production QA faster by making compact admin actions self-explanatory on hover, and by keeping dense settings controls collapsed until needed.

## Compact Icon-Only Action Targets

- [x] `src/components/AdminAiReadinessRefreshButton.tsx` - support icon-only refresh with hover explanation.
- [x] `src/components/AdminProviderCooldownBadge.tsx` - make provider cooldown clear action compact/icon-first with hover explanation.
- [x] `src/components/generation-jobs/GenerationJobDetailsDrawer.tsx` - add hover tooltips to close, retry, copy error, copy audit, copy metadata, and chunk step retry actions.
- [x] `src/components/GenerationJobsTable.tsx` - make search submit, compact export, refresh jobs, retry, details, and load more icon-only with hover tooltips.
- [x] `src/pages/admin/AdminLeads.tsx` - make repeated utility buttons icon-only: trim cache, capture helper, manual import, search history refresh, duplicate refresh, filter reset/reload, search refresh, bulk select/generate/jobs, payment export/refresh, row details/skip/gather/generate, payment modal close, and prospect details drawer close.
- [x] `src/pages/admin/AdminSites.tsx` - make repeated utility buttons icon-only: page refresh, ready-prospect maps/data/generate, generated-site preview/maps/data/brief/regen, and JSON/data modal close.
- [x] `src/pages/admin/AdminSchema.tsx` - make schema repair and D1-to-R2 migration actions icon-only with hover tooltips.
- [x] `src/pages/admin/AdminDashboard.tsx` - make generation-job review link icon-only with hover tooltip.
- [ ] Continue scanning high-risk destructive or irreversible actions before converting them; keep text when the label is needed to avoid accidental operation.

## Button Density Rule

- Utility/repeated actions should be icon-only with `HoverTooltip` and `aria-label`: refresh, export, copy, close, retry, details/data/brief, open external, reset, reload, inspect, and row-level workflow actions.
- Primary form-submit actions may keep text if the user is choosing between meaningfully different outcomes or the action is high-risk.
- Bulk and row actions should prefer stable square dimensions (`h-9 w-9` or `h-10 w-10`) so tables do not become visually noisy.

## Settings Collapse Targets

- [x] `/admin/settings` AI provider credentials collapsed by default.
- [x] `/admin/settings` Google Places key collapsed by default.
- [x] `/admin/settings` Payment Setup collapsed by default.
- [x] `/admin/settings` Prospect Scoring collapsed by default.
- [x] `/admin/settings` AI cost/readiness estimator collapsed by default.
- [x] `/admin/settings` Provider cooldown history nested inside the estimator and visible only after expanding that settings section.

## Payment Setup Visibility

- [x] Show offer/conversion fields for all payment processors.
- [x] Show only the active processor setup fields for `xendit`, `midtrans`, `doku`, `paypal`, `wise`, `payoneer`, `mock`, or legacy Lemon Squeezy.
- [x] Show PayPal risk guardrails only when PayPal is the active processor or a PayPal link/account-mode is already configured.
- [ ] After PayPal Business credentials are ready, add a production QA checklist item for webhook signature verification with real sandbox events.
