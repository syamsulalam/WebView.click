# Dynadot API Summary

Last updated: 2026-05-28.

## Fit For WebView.click

Dynadot is a practical fallback registrar adapter when Cloudflare Registrar access or TLD coverage is insufficient. The API is mature, supports sandbox calls, and can return account-specific availability pricing.

Score: 7.5.

## Required Configuration

- `DYNADOT_API_KEY`
- `DYNADOT_ENV`: `sandbox` or `production`
- Account balance sufficient for registration
- Default contacts/nameservers configured in Dynadot, or explicit contact support
- Optional max registration price setting, default `$17`

## Quote / Availability Flow

Use the `search` command with `show_price=1` and `currency=USD`.

Recommended JSON endpoint shape:

- Production: `https://api.dynadot.com/api3.json`
- Sandbox: `https://api-sandbox.dynadot.com/api3.json`
- Query: `key=...&command=search&domain0=example.com&show_price=1&currency=USD`

Normalize response fields into `DomainQuote`:

- `provider: "dynadot"`
- `domain` from `DomainName`
- `registrable` from `Available === "yes"`
- `registrationUsd` parsed from `Price`
- `premium` inferred from price text when present
- `reason` from error/status fields or unavailable state

## Registration Flow

Use the `register` command only after a fresh search quote, paid order verification, and admin confirmation. Dynadot requires enough account balance to process the registration order.

First-release payload should stay narrow:

- `command=register`
- `domain`
- `duration=1`
- optional contact IDs only after defaults are verified
- never set `premium=1` in the MVP

## DNS / Pages Connection

Dynadot can set nameservers. The preferred Pages flow is to set the domain nameservers to Cloudflare, then manage DNS and Pages custom-domain status through Cloudflare.

## Risks / Guardrails

- API style is older and response parsing needs defensive normalization.
- Regular account rate limit is low enough that retries should be conservative.
- Registration depends on prepaid account balance.
- Premium domains must remain blocked in the first release.

## Official Docs

- Dynadot API commands: https://www.dynadot.com/domain/api-commands
- Dynadot API overview: https://www.dynadot.com/domain/api
