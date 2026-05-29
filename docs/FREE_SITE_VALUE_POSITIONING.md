# Free Site Value Positioning

Purpose: make the free generated website feel valuable, credible, and safe to accept, without relying on fake scarcity or misleading claims.

## Core Problem

A free website offer can be ignored because "free" can signal:

- spam,
- low quality,
- hidden catch,
- generic template,
- obligation to buy hosting,
- or a stranger trying to sell something.

The offer needs to answer three questions quickly:

1. Why is this free?
2. What is it worth?
3. What happens if the owner ignores it?

## Positioning Principle

Do not position it as "we are giving away random free websites."

Position it as:

> We built a ready-to-use starter website for your business as a portfolio/sample project. The site package is yours to download for free. If you want us to launch it for you, we can handle hosting/domain/DNS separately.

This creates a reason for the gift, gives the owner control, and makes the paid setup feel optional instead of forced.

## Ethical Scarcity

Avoid false claims like:

> Your site will be deleted in 7 days

if we do not actually delete it.

Safer alternatives:

- "This preview link may be archived after 7 days."
- "I only keep these free previews active for a short review window."
- "If you are not interested, no reply is needed and I will not keep following up."
- "The downloadable files are free during this review window."

If we want to use hard expiry, implement it for the public preview or owner access token, while keeping admin/internal records. Then the claim becomes true.

## Value Anchors

Use a crossed-out price only if it is defensible as a real comparable price.

Possible anchors:

- "Comparable starter site package: $497-$997"
- "Estimated build value: $997"
- "Generated website package value: $497"
- "Portfolio sample credit: 100% off"
- "Today: free static website package"

Best version:

> Starter website package value: $997
> Portfolio credit: -$997
> Your download today: $0

This feels like an invoice/value breakdown, not a coupon gimmick.

## Why It Is Free

Good reasons:

- "We are building a portfolio of local business website examples."
- "We generated this preview from public business profile information."
- "We want a small number of strong local business examples in each category."
- "If you like it, the files are yours. If you want a hands-off launch, we can host it for you."

Avoid:

- "We randomly selected you."
- "No catch" as the main headline.
- "Limited time only" without a real operational reason.

## Owner-Safe Framing

The owner should feel in control:

- "Download the files and host them anywhere."
- "No payment is required to download."
- "No obligation to use WebView.click hosting."
- "Ignore this if it is not useful; no follow-up is needed."
- "If any information is wrong, you can simply not use it."

## Scarcity and Urgency Ideas

Use one or two, not all at once:

- Review window: "Preview held for 7 days."
- Portfolio batch: "I only prepare a few of these sample sites per city/category."
- Support limit: "Free package includes files only; launch help is separate."
- Setup bandwidth: "I can only personally launch a small number of sites each week."
- Owner attention: "If you want it, download it now so you have the files even if the preview link changes."
- No-pressure close: "If you do not want it, ignore this and I will not keep messaging you about it."

## Outreach Copy Angles

### Short Direct Message

Subject: I made a starter website for {Business Name}

Hi {Owner/Business Name},

I made a starter website preview for {Business Name} using your public business profile details.

It is a portfolio/sample project, so the website package is free for you to download. Comparable starter site work is usually around $497-$997, but this one is $0 if you want the files.

You can host it anywhere or ignore it. If it is not useful, no reply is needed and I will not keep following up.

Preview: {previewUrl}

### Slightly Stronger Scarcity

Hi {Owner/Business Name},

I built a starter website preview for {Business Name} as part of a small local-business portfolio batch.

The generated website package is free during the review window. You can download the static files and use any hosting/domain provider you want.

Estimated starter site value: $997
Portfolio sample credit: -$997
Your download: $0

If you want us to launch it for you, we can handle hosting, domain/DNS, SSL, and upload. If not, no problem. If this is not useful, ignore this message and I will not keep bothering you about it.

Preview: {previewUrl}

### No-Pressure Follow-Up

Hi {Owner/Business Name},

Quick follow-up on the free website preview I made for {Business Name}.

If you want it, download the files from the preview page so you have the site package. If you do not want it, no reply is needed. I will leave you alone after this.

Preview: {previewUrl}

## WebsiteActionPanel Implementation Ideas

Current modal headline:

> The generated website files are free.

Better modal structure:

### 1. Value Hero Block

Headline:

> Your starter website package is ready

Value row:

> Estimated starter site value: ~~$997~~
> Portfolio credit: -$997
> Your download today: $0

Supporting copy:

> This preview was prepared as a portfolio/sample project for your business. You can download the static website files for free, host them anywhere, or ask WebView.click to launch it for you.

### 2. Trust/Control Strip

Small checks:

- No payment required to download.
- Host it anywhere.
- No obligation to use our hosting.
- Setup help is optional.

### 3. Review Window Note

Use only if we are comfortable with the operational promise:

> Free review window: download the files now so you have a copy even if this preview link is archived later.

Do not say "deleted in 7 days" unless the public preview/access is actually expired.

### 4. CTA Copy

Current:

> Download your site for free

Better:

> Download my $0 website package

Alternative:

> Claim the free website files

### 5. Paid Setup CTA

Current:

> Host it for me

Better:

> Launch it for me

Supporting copy:

> We handle hosting, domain/DNS, SSL, upload, and launch.

### 6. Main Panel Button Copy

Current:

> Download your free site

Better:

> Claim free site package

Subcopy:

> $997 starter value, yours to host anywhere.

## Suggested `WebsiteActionPanel` Copy Patch

Smallest useful copy-only change:

- Panel CTA title: `Claim free site package`
- Panel CTA subcopy: `$997 starter value. Download files and host anywhere.`
- Modal title: `Your starter website package is ready`
- Modal subtitle: `Review the included files, pages, and launch options.`
- Hero headline: `Estimated starter site value: $997`
- Hero body: `Prepared as a portfolio/sample project for your business. Your download is $0 today, and you can host the files anywhere.`
- Download button: `Download my $0 website package`

## What Not To Do

- Do not create fake deletion/scarcity unless the product actually expires public access.
- Do not imply the owner requested the site.
- Do not imply ownership transfer of trademarks, Google photos, or third-party assets beyond the generated/static package.
- Do not hide the paid setup offer inside the free offer.
- Do not make the free offer sound like a legal invoice.

## Best Next Product Step

Add a real preview expiry field:

- `previewExpiresAt` on generated site metadata.
- Public preview can show "review window active" before expiry.
- Admin can still access archived previews.
- Owner-facing copy can truthfully say the public preview link may be archived after the review window.

This makes scarcity real while preserving internal records.
