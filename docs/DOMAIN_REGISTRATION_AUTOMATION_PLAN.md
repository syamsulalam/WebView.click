# Domain Registration Automation Plan

Last updated: 2026-05-28.

## Goal

Make the done-for-you setup flow easier to fulfill:

- New-domain buyers should be able to check real-time availability and price before payment.
- After payment, WebView.click should be able to register the selected domain in our registrar account with a clear audit trail.
- Existing-domain buyers should be able to enter their full domain, confirm ownership, and get registrar-specific DNS/nameserver instructions.
- Admin should get one copyable fulfillment note containing the domain request, payment reference, and page add/edit instructions.

The recommended hosting target remains Cloudflare Pages. The registrar automation should reduce manual domain purchase work, not replace the existing Cloudflare Pages + D1/R2 architecture.

## Recommended Architecture

Use a provider-neutral domain adapter layer:

```ts
type DomainProvider = "cloudflare_registrar" | "name_com" | "dynadot" | "spaceship";

type DomainQuote = {
  provider: DomainProvider;
  domain: string;
  registrable: boolean;
  currency: "USD" | string;
  registrationUsd?: number;
  renewalUsd?: number;
  premium?: boolean;
  reason?: string;
  checkedAt: string;
  expiresAt: string;
};

type DomainRegistrationResult = {
  provider: DomainProvider;
  domain: string;
  status: "submitted" | "registered" | "pending" | "failed";
  providerOrderId?: string;
  providerRaw?: unknown;
};
```

Add backend-only API endpoints:

- `POST /api/domains/quote` for real-time registrar availability and pricing.
- `POST /api/domains/register` for paid/admin-confirmed domain registration.
- `POST /api/domains/connect-pages` for Cloudflare zone/DNS/Pages custom-domain connection.
- `GET /api/domains/owned-check?domain=...` for RDAP/DNS registrar and nameserver summary.

Frontend should never call registrar APIs directly. Registrar keys belong in Cloudflare environment secrets, not D1 settings.

## Provider Implementation Scope

Rating is for WebView.click's current use case: US local-business demos, one-year domain included in a `$197/year` checkout, Cloudflare Pages hosting, low operational friction, and safe production automation.

Implementation scope is limited to registrars with score 7.0 or above.

| Provider | Rating | Best fit | API fit | Pros | Cons / Risks | Recommendation |
| --- | ---: | --- | --- | --- | --- | --- |
| Cloudflare Registrar API | 9.0 | Primary MVP if beta access is available | Search, check, current pricing, register, Cloudflare-native auth | Same platform as Pages/DNS, returns pricing, no registrar markup positioning, direct path to Cloudflare zone and Pages custom domain | Registrar API is beta; programmatic registration only supports a listed subset of TLDs; max 100 domains/account noted in API docs; successful registrations are billable and non-refundable; premium domains unsupported via API | Best first implementation. Block premium/unsupported domains and require admin confirmation before registration. |
| Name.com CORE API | 8.0 | General fallback registrar API | Search/register/manage/DNS, sandbox, REST JSON | Modern API, sandbox, clear rate limits, production/test separation | 2FA-enabled accounts are not supported by API per docs; pricing/registration flow needs careful integration | Good fallback if Cloudflare Registrar API is unavailable or too limited. |
| Dynadot API | 7.5 | Practical low-friction registrar fallback | Search/register/bulk register/DNS, XML/JSON, sandbox | Mature automation commands, price included in search with `show_price=1`, broad domain-management commands | Older API style; reseller/contacts details need careful implementation | Good fallback for domain automation if Cloudflare is blocked. |
| Spaceship API | 7.0 | Cheap registrar fallback to test | Availability, domain management, contacts, DNS, billing permissions | External API has granular permissions, availability endpoint, contact and DNS operations | Newer ecosystem; need sandbox/live billing verification before trusting automated purchase | Worth testing after Cloudflare. |

Provider-specific summaries:

- `docs/domain-providers/CLOUDFLARE_REGISTRAR_API_SUMMARY.md`
- `docs/domain-providers/NAME_COM_API_SUMMARY.md`
- `docs/domain-providers/DYNADOT_API_SUMMARY.md`
- `docs/domain-providers/SPACESHIP_API_SUMMARY.md`

## Deferred Providers Below Score 7

These providers remain useful context for owned-domain instructions, but they are not part of the registrar automation implementation scope.

| Provider | Rating | Best fit | API fit | Pros | Cons / Risks | Recommendation |
| --- | ---: | --- | --- | --- | --- | --- |
| Amazon Route 53 Domains | 6.5 | AWS-centric fallback | Check availability/register via AWS APIs | Strong SDK/IAM/audit tooling; reliable API | Adds AWS dependency, often more expensive, DNS still needs Cloudflare delegation for Pages apex flow | Usable but not ideal for this product unless AWS is already part of ops. |
| Namecheap API | 6.0 | Existing Namecheap account with API already enabled | Availability/register/DNS/XML API | Established API and sandbox; supports domain create/check | Production API eligibility requires account criteria; API requires IPv4 allowlisting, which is awkward from Cloudflare Pages Functions due variable egress IPs | Avoid for first build unless using a fixed outbound proxy or already-enabled account. |
| OpenSRS / Tucows | 6.0 | Larger reseller operation | Reseller API, domain registration | Proper reseller model and mature domain operations | More onboarding/compliance/ops than current scale needs | Revisit if WebView.click becomes a higher-volume registrar-like reseller. |
| GoDaddy Domains API | 4.0 | Existing GoDaddy portfolio only | Availability/purchase/manage exists, but access is gated | Large registrar, OTE test environment | API access is plan/domain/spend gated; some updates requiring 2FA are not API-supported; not the smoothest automation path | Do not use for MVP. Keep only as owned-domain instruction target. |

## New Domain Flow

1. Buyer opens Done-for-you setup.
2. Buyer chooses new domain.
3. UI calls `POST /api/domains/quote` for the selected domain.
4. Backend checks provider availability/pricing in real time.
5. UI displays:
   - available/unavailable
   - first-year price
   - renewal price if available
   - premium/unsupported warning
6. Checkout stores the selected `DomainQuote` in `lead_payments.raw_json`.
7. After payment capture/manual verification, `/admin/orders` shows:
   - `Register domain` action
   - quote age
   - exact domain/price
   - warning if quote expired
8. Admin clicks `Register domain`; backend re-checks availability/pricing immediately before registration.
9. Backend registers only if:
   - payment status is `paid`
   - domain still matches buyer's order
   - domain is standard/non-premium
   - price is within configured max, default `$17`
   - admin confirmation token is present
10. Backend writes `domain_orders` row and appends result to `lead_payments.raw_json`.
11. Backend creates/updates Cloudflare zone and Pages custom domain linkage.

Important: do not auto-register immediately on browser checkout success. Domain registrations are usually non-refundable. Keep a paid/admin-confirmed step first.

## Existing Domain Flow

1. Buyer chooses `I own one`.
2. Input accepts the full domain while typing, including dots.
3. Buyer must check: `I confirm this is my domain and I can update DNS or give setup access.`
4. UI calls existing/improved owned-domain check.
5. Backend resolves:
   - normalized domain
   - registrar from RDAP when available
   - nameservers
   - DNS signals
   - whether Cloudflare is already authoritative
6. UI displays plain instructions:
   - If Cloudflare nameservers are already active: "We can connect this directly."
   - If another registrar/nameserver is active: "We will send nameserver instructions or ask for delegated access."
   - If inconclusive: "We need owner confirmation/support follow-up."
7. Checkout stores `ownedDomainConfirmation`, registrar, nameservers, and RDAP summary in `lead_payments.raw_json`.
8. `/admin/orders` fulfillment note includes registrar/nameserver hints.

## Cloudflare Pages Connection

For Cloudflare Pages:

- Apex domain (`example.com`) requires the domain to be a Cloudflare zone and nameservers pointed to Cloudflare.
- Subdomain (`www.example.com`) can use a CNAME at the current DNS provider, but Pages custom domain association must still be created first.
- If Cloudflare manages the DNS zone, Cloudflare can add the CNAME automatically after the custom domain is confirmed.

Implementation path:

1. Register or verify domain.
2. Ensure Cloudflare zone exists.
3. Set DNS:
   - apex: Cloudflare Pages custom-domain flow / CNAME flattening
   - `www`: CNAME to WebView.click Pages target
4. Add Pages custom domain through Cloudflare API.
5. Poll status until active or manual action required.

## Data Model

Start with `lead_payments.raw_json` for low-risk rollout:

```json
{
  "domainMode": "new",
  "requestedDomain": "example.com",
  "domainQuote": {
    "provider": "cloudflare_registrar",
    "registrable": true,
    "registrationUsd": 10.44,
    "renewalUsd": 10.44,
    "checkedAt": "2026-05-28T00:00:00.000Z",
    "expiresAt": "2026-05-28T00:15:00.000Z"
  },
  "setupRequest": {
    "newPages": 2,
    "editedPages": 1,
    "setupNote": "Pages to add..."
  }
}
```

Add `domain_orders` once registration automation starts:

```sql
CREATE TABLE IF NOT EXISTS domain_orders (
  id TEXT PRIMARY KEY,
  lead_payment_id TEXT,
  business_id TEXT,
  provider TEXT,
  domain TEXT,
  domain_mode TEXT,
  status TEXT DEFAULT 'pending',
  amount_usd REAL DEFAULT 0,
  quote_json TEXT,
  provider_order_id TEXT,
  provider_raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Guardrails

- Block premium domains.
- Block unsupported TLDs.
- Block registration if live provider price exceeds configured max, default `$17`.
- Require payment status `paid`.
- Require admin click for first release.
- Re-check availability immediately before registration.
- Store full quote and provider response for dispute/audit trail.
- Do not expose registrar API keys to browser.
- Terms must say whether WebView.click holds the domain in its account as managed infrastructure, or whether the customer is the registrant/contact.
- Renewal policy must be explicit because auto-renew can charge the provider account later.

## Implementation Progress

- [x] Phase 1 - Small UX fixes:
  - [x] Add `/admin/orders` `Copy fulfillment note`.
  - [x] Fix owned-domain input so `.` is not stripped while typing.
  - [x] Add ownership confirmation checkbox for existing domain flow.
  - [x] Make generated new-domain suggestions avoid inserting hyphens from business-name spaces/punctuation.
  - [x] Create provider-specific docs for all score 7.0+ registrars.
- [ ] Phase 2 - Provider-neutral backend scaffolding:
  - [x] Add settings/env key names for `cloudflare_registrar`, `name_com`, `dynadot`, and `spaceship`.
  - [x] Add shared `DomainQuote` parser/normalizer.
  - [x] Add provider adapter interface.
  - [x] Add quote caching in checkout raw JSON.
  - [x] Add admin-visible provider health/status endpoint.
- [ ] Phase 3 - Cloudflare Registrar read-only quote:
  - [x] Add `POST /api/domains/quote`.
  - [x] Capture real-time quote from `WebsiteActionPanel` while keeping buyer-facing copy at the included `$17/year` domain fee.
  - [x] Return `premium`, `withinMaxPrice`, and `supportedForMvp` so the UI can block premium/unsupported domains.
  - [ ] Re-check immediately before checkout finalization.
- [ ] Phase 4 - Owned-domain RDAP instruction upgrade:
  - [ ] Improve `/api/domains/check` output for registrar/nameserver.
  - [ ] Add admin fulfillment note fields.
  - [ ] Add registrar-specific instruction snippets for external DNS.
- [ ] Phase 5 - Paid/admin-confirmed registration:
  - [ ] Add `domain_orders`.
  - [ ] Add `/admin/orders` `Register domain` button.
  - [ ] Re-check quote before purchase.
  - [ ] Require admin confirmation token for billable registration.
  - [ ] Persist provider order/workflow result.
- [ ] Phase 6 - Cloudflare Pages connection:
  - [ ] Add custom domain to Pages.
  - [ ] Add DNS records when zone is in our Cloudflare account.
  - [ ] Show manual instructions when customer keeps external DNS.
- [ ] Phase 7 - Optional fallback provider:
  - [ ] Add Name.com adapter if Cloudflare Registrar API/TLD coverage is insufficient.
  - [ ] Add Dynadot adapter if Name.com cost/coverage does not fit.
  - [ ] Add Spaceship adapter only after sandbox/live billing behavior is verified.

## Research Sources

- Cloudflare Registrar API: https://developers.cloudflare.com/api/resources/registrar/
- Cloudflare Create Registration API: https://developers.cloudflare.com/api/resources/registrar/subresources/registrations/methods/create/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Name.com CORE API overview: https://docs.name.com/api/v1/overview
- Name.com check availability: https://docs.name.com/api/v1/reference/domains/check-availability
- Name.com reseller quickstart: https://docs.name.com/guides/quickstart
- Spaceship API docs: https://docs.spaceship.dev/
- Dynadot domain API commands: https://www.dynadot.com/domain/api-commands
- Namecheap API FAQ: https://www.namecheap.com/support/knowledgebase/article.aspx/9739/63/api-faq/
- Namecheap domain API methods: https://www.namecheap.com/support/api/methods/domains/
- Amazon Route 53 Domains API: https://docs.aws.amazon.com/Route53/latest/APIReference/API_domains_CheckDomainAvailability.html
- GoDaddy domain-related API access: https://www.godaddy.com/help/how-do-i-access-domain-related-apis-42424
- GoDaddy Domains API: https://developer.godaddy.com/doc/endpoint/domains
