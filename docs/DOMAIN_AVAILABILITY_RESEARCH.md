# Domain Availability Research

Last updated: 15 Mei 2026.

Tujuan dokumen ini: mencari cara gratis atau murah untuk mengecek domain availability sebelum user membeli paket `$197/year` WebView.click.

## Current Implementation

Endpoint:
- `GET /api/domains/check?domain=example.com`

Primary check:
- `rdap.net`
- Endpoint example: `https://rdap.net/domain/example.com`
- `rdap.net` is a free RDAP redirect service that redirects to authoritative RDAP servers using IANA bootstrap files.

Fallback signal:
- Google Public DNS JSON API `https://dns.google/resolve?name={domain}&type=SOA`
- This only checks DNS existence, not registrar availability.

Result interpretation:
- RDAP `200`: domain appears registered.
- RDAP `404`: candidate available, but final registrar purchase must confirm.
- Other status: inconclusive.
- DNS no answer: useful signal only, not proof of availability.
- For already-owned domains, RDAP `200` is a useful ownership/setup signal rather than a purchase blocker. The response can include registrar and nameserver data for setup guidance.

Important limitation:
- RDAP was built for registration data lookup, not guaranteed shopping-cart availability.
- Some domains can be reserved, premium, blocked, in grace/delete state, or unsupported even when RDAP returns no registration data.
- Final availability must be confirmed during registrar purchase.
- RDAP does not prove the visitor owns the domain; it only proves the domain exists. Ownership must be confirmed operationally during setup by asking the user to change nameservers or add DNS records.

## Already-Owned Domain Flow

Best UX:
- Let the user choose "I already own a domain" instead of forcing a new domain search.
- Ask for the full domain, for example `example.com`.
- Run the same `/api/domains/check` endpoint.
- If RDAP returns registered, show registrar/nameserver signals and allow the user to continue.
- During setup, ask the user to either:
  - Change nameservers at their registrar to the Cloudflare nameservers we provide.
  - Or keep current nameservers and add DNS records we provide, usually `A`, `AAAA`, `CNAME`, or Cloudflare Pages custom-domain records depending on the hosting target.

Recommended wording:
- New domain: "Looks available from pre-check. Final availability is confirmed during purchase."
- Existing domain: "Domain is registered. We can help point it to your new site after you update nameservers or DNS records."

Debug notes:
- If registrar/nameservers are empty, the RDAP registry may not publish those fields consistently.
- If RDAP says candidate available for a claimed existing domain, ask the user to verify spelling, remove `www`, and confirm the domain in their registrar account.
- If DNS fallback returns records but RDAP is inconclusive, treat it as a setup signal but not as ownership proof.

## Free / Low-Cost Provider Options

### 1. RDAP via `rdap.net`

Source:
- https://www.rdap.net/
- https://www.iana.org/help/rdap-requirements
- https://www.icann.org/en/announcements/details/icann-update-launching-rdap-sunsetting-whois-27-01-2025-en

Pros:
- Free.
- No API key.
- Uses IANA bootstrap to route to authoritative RDAP service.
- Good first-pass signal.

Cons:
- Not a purchase/availability API.
- `404` means no RDAP registration data, not guaranteed purchasable.
- Some ccTLDs and edge cases may be inconclusive.
- Rate limits are not a commercial SLA.

Use:
- Primary free check.
- Cache result briefly if traffic grows.

### 2. Direct Registry RDAP via IANA Bootstrap

Source:
- https://data.iana.org/rdap/dns.json
- https://www.iana.org/help/rdap-requirements

Pros:
- Avoids depending on `rdap.net`.
- Still free.
- Lets us rotate per TLD directly to the registry RDAP base URL.

Cons:
- Need implement bootstrap cache and TLD matching.
- Some TLDs may have multiple RDAP services.
- Still not guaranteed availability.

Use:
- Phase 2 fallback if `rdap.net` has issues.

### 3. Domainr / Fastly Domain Research API

Source:
- https://domainr.com/docs/api

Pros:
- Built specifically for domain search/status.
- Status endpoint returns availability-style summaries.
- RapidAPI route historically supports free/lower-volume usage.

Cons:
- Requires API key.
- Original Domainr API docs are deprecated after Fastly acquisition.
- Free tier/limits can change.

Use:
- Optional configured provider for better accuracy.
- Rotate after RDAP when key exists.

### 4. Namecheap API

Source:
- https://www.namecheap.com/support/api/methods/domains/check/

Pros:
- Purpose-built availability check.
- Returns availability, premium status, registration price, renewal price, and ICANN fee.
- Can check up to 50 domains in one request.

Cons:
- Requires Namecheap account/API key and whitelisted client IP.
- Cloudflare Pages Functions IP can be hard to whitelist reliably.
- XML response parsing required.

Use:
- Good if later we run a stable backend IP or move checkout workflow to a worker/server with fixed egress.

### 5. Registrar APIs to Research Later

Candidates:
- Porkbun API
- Dynadot API
- Name.com API
- GoDaddy Domains API
- Cloudflare Registrar API, if account/domain support fits our workflow

Expected tradeoff:
- More registrar APIs provide true availability but require keys, accounts, partner access, paid account, or IP restrictions.
- Useful as purchase-time confirmation, not necessarily free public pre-check.

## Roll Strategy

Phase 1:
- Use RDAP via `rdap.net`.
- Use Google DNS as only a fallback signal.
- Show UI wording: "looks available" not "guaranteed available."

Phase 2:
- Add direct IANA RDAP bootstrap cache.
- If `rdap.net` returns inconclusive, query authoritative RDAP directly.

Phase 3:
- Add optional provider keys in `/admin/settings`:
  - `DOMAINR_API_KEY`
  - `NAMECHEAP_API_KEY`
  - `NAMECHEAP_API_USER`
  - `NAMECHEAP_CLIENT_IP`
- Rotate providers in order:
  1. configured registrar API,
  2. Domainr/Fastly,
  3. direct registry RDAP,
  4. rdap.net,
  5. DNS signal fallback.

Phase 4:
- At payment time, always re-check availability with the registrar we will use to purchase.
- If unavailable after payment, offer alternate extension or refund.

## UI Copy Rule

Use:
- "Looks available"
- "Appears registered"
- "Final availability is confirmed during setup"

Avoid:
- "Guaranteed available"
- "Reserved for you"
- "Purchased"

This protects us from RDAP false positives, premium domains, and registry-reserved names.
