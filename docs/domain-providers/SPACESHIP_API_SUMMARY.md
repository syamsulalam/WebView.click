# Spaceship API Summary

Last updated: 2026-05-28.

## Fit For WebView.click

Spaceship is a low-cost registrar fallback worth testing after Cloudflare and Name.com. The API is JSON-based and exposes availability, registration, nameserver, privacy, and domain-management operations with API key/secret authentication.

Score: 7.0.

## Required Configuration

- `SPACESHIP_API_KEY`
- `SPACESHIP_API_SECRET`
- `SPACESHIP_ENV` if sandbox/live separation becomes available in the account
- Contact/profile setup suitable for registrations
- Optional max registration price setting, default `$17`

## Quote / Availability Flow

Use `GET /api/v1/domains/{domain}/available`.

Normalize response fields into `DomainQuote`:

- `provider: "spaceship"`
- `domain`
- `registrable` from `result === "available"`
- `registrationUsd` from `premiumPricing` item where `operation === "register"` when present
- `premium` when premium pricing exists or price exceeds configured standard threshold
- `currency`
- raw provider payload for audit

## Registration Flow

Use `POST /api/v1/domains/{domain}` after payment is verified and admin confirms the fresh quote. Spaceship registration requires a fully qualified domain name and a registration request body; verify contact and nameserver requirements in the live account before enabling production purchases.

## DNS / Pages Connection

Spaceship can update nameservers. For WebView.click, prefer switching nameservers to Cloudflare and then performing DNS/Page custom-domain steps in Cloudflare.

## Risks / Guardrails

- Treat this as a later fallback until sandbox/live billing behavior is production-tested.
- API rate limits are endpoint-specific; writes like nameserver/contact updates have tighter per-domain limits.
- Block premium/unsupported domains for the MVP.
- Do not expose API key or secret to the browser.

## Official Docs

- Spaceship API docs: https://docs.spaceship.dev/
