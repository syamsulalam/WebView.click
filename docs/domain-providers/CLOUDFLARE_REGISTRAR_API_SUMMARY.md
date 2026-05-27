# Cloudflare Registrar API Summary

Last updated: 2026-05-28.

## Fit For WebView.click

Cloudflare Registrar is the preferred first registrar adapter if the WebView.click account has Registrar API beta access. It is the lowest-friction match because production already uses Cloudflare Pages, D1, R2, and Cloudflare DNS.

Score: 9.0.

## Required Configuration

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` with scoped Registrar permissions
- Default registrant contact configured in the Cloudflare account
- Default payment profile configured in Cloudflare
- Optional max registration price setting, default `$17`

## Quote / Availability Flow

Use Cloudflare Registrar search/check endpoints through a server-side adapter only. The normalized `DomainQuote` should store:

- `provider: "cloudflare_registrar"`
- `domain`
- `registrable`
- `currency`
- `registrationUsd`
- `renewalUsd`
- `premium`
- `reason`
- `checkedAt`
- `expiresAt`
- raw provider payload for audit

Cloudflare marks search results as non-authoritative, so registration must be preceded by a fresh domain-check request. Block unsupported extensions and premium domains.

## Registration Flow

Use `POST /accounts/{account_id}/registrar/registrations` only after payment is verified and admin confirms the exact domain and price. Keep the first version minimal by passing only `domain_name` unless WebView.click intentionally overrides contact data.

Cloudflare registrations are billable and non-refundable after success. The endpoint can return `201 Created` or async `202 Accepted`; do not retry a `202` as a failure. Store the workflow link, poll registration status, and persist terminal status in `domain_orders`.

## Cloudflare Pages Connection

After registration:

- Ensure the Cloudflare zone exists for the domain.
- Add the Pages custom domain.
- Add DNS records for apex and `www` when the zone is controlled by WebView.click.
- Poll until active or manual action is required.

## Risks / Guardrails

- Registrar API is beta.
- Programmatic registration supports only a subset of TLDs.
- Premium domains are not supported by the API.
- Registration should be admin-confirmed, not automatic on browser checkout success.
- Treat `action_required`, `blocked`, and `failed` workflow states as requiring admin review.

## Official Docs

- Cloudflare Registrar API: https://developers.cloudflare.com/registrar/registrar-api/
- Cloudflare Registrar API reference: https://developers.cloudflare.com/api/resources/registrar/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
