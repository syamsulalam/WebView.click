# Admin UI Tooltip and Collapse Audit

Last updated: 25 May 2026.

Purpose: keep production QA faster by making compact admin actions self-explanatory on hover, and by keeping dense settings controls collapsed until needed.

## Compact Icon-Only Action Targets

- [x] `src/components/AdminAiReadinessRefreshButton.tsx` - support icon-only refresh with hover explanation.
- [x] `src/components/AdminProviderCooldownBadge.tsx` - make provider cooldown clear action compact/icon-first with hover explanation.
- [x] `src/components/generation-jobs/GenerationJobDetailsDrawer.tsx` - add hover tooltips to close, retry, copy error, copy audit, copy metadata, and chunk step retry actions.
- [x] `src/components/GenerationJobsTable.tsx` - add hover tooltips to clear search, refresh jobs, and load more controls.
- [x] `src/pages/admin/AdminLeads.tsx` - add hover tooltips to payment verification modal close and prospect details drawer close.
- [x] `src/pages/admin/AdminSites.tsx` - add hover tooltip to JSON/data modal close.
- [ ] Continue scanning row-level compact actions in `/admin/leads` for older icon buttons that still rely only on visible labels or browser title behavior.

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
