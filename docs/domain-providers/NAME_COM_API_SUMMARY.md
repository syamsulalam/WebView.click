# Name.com CORE API Summary

Last updated: 2026-05-28.

## Fit For WebView.click

Name.com is the strongest non-Cloudflare fallback because CORE API is modern, JSON-based, has sandbox support, and has a clear reseller-oriented flow from search to registration to DNS management.

Score: 8.0.

## Required Configuration

- `NAME_COM_USERNAME`
- `NAME_COM_API_TOKEN`
- `NAME_COM_ENV`: `sandbox` or `production`
- Default contacts configured in Name.com, or explicit contact payload support
- Optional max registration price setting, default `$17`

Important account caveat: Name.com API authentication uses username plus API token. Keep credentials server-side only.

## Quote / Availability Flow

Use `POST /core/v1/domains:checkAvailability` with `purchaseType: "registration"` for predictable first-release behavior. The endpoint accepts multiple names, but WebView.click should start with one requested domain per buyer action to keep error handling simple.

Normalize response fields into `DomainQuote`:

- `provider: "name_com"`
- `domain` from `domainName`
- `registrable` from `purchasable`
- `registrationUsd` from `purchasePrice`
- `renewalUsd` from `renewalPrice`
- `premium`
- `reason`
- `purchaseType` stored in raw/audit metadata

Search results are useful for suggestions, but checkout should re-check availability before registration.

## Registration Flow

Use `POST /core/v1/domains` as the billable create-domain call. Send an `X-Idempotency-Key` tied to the WebView.click payment/order ID so a retry after timeout does not double-purchase.

Recommended first-release create payload:

- `domain.domainName`
- `years: 1`
- `purchaseType: "registration"`
- `purchasePrice` copied from the fresh pre-registration quote
- `privacyEnabled: true`
- `locked: true`
- `autorenewEnabled: true` only after renewal policy is explicit

## DNS / Pages Connection

Name.com can manage DNS records and nameservers. For Cloudflare Pages, WebView.click should normally move nameservers to Cloudflare or create the zone in Cloudflare, then complete Pages custom-domain setup there.

## Risks / Guardrails

- Block aftermarket, backorder, expiring, premium, and claims-period results until explicitly supported.
- Some TLDs require extra registry fields; use TLD requirements before expanding beyond simple gTLDs.
- Contact verification can affect domain resolution; admin should see verification status in later phases.
- Keep sandbox and production credentials separate.

## Official Docs

- Name.com API overview: https://docs.name.com/api/v1/overview
- Check availability: https://docs.name.com/api/v1/reference/domains/check-availability
- Reseller quickstart: https://docs.name.com/guides/quickstart
- Create domain reference: https://docs.name.com/coreapi/namecom.api/domains/getdomain
