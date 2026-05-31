# Owner Download PDF and Upsell Plan

Last updated: 31 Mei 2026.

Purpose: turn the owner download package into a stronger perceived-value asset, replace plain `.txt` handoff files with a branded personalized PDF, and define ethical upsell/sidesell paths that can raise average order value without weakening the free-site offer.

## Progress Tracker

- [x] Capture strategy and implementation plan in this document.
- [x] Decide whether the first release includes the PDF only, or PDF plus temporary fallback `.txt` files. Decision: PDF only, per latest direction.
- [x] Create a reusable owner package guide data builder from `siteData`, pricing settings, preview URL, and selected domain/setup context. First pass uses `siteData`, preview URL, business ID, and hardcoded current offer prices.
- [x] Create branded A4 HTML sections for the owner package guide.
- [x] Add client-side PDF generation during `downloadOwnerSiteZip()`.
- [x] Replace `README-FIRST.txt` and `SETUP-GUIDE.txt` with `WebView.click Website Package Guide.pdf`.
- [ ] Add PDF export QA for page breaks, file size, business-specific personalization, clickable links, selectable text, and no hidden admin/tool UI.
- [x] Update `docs/CODEBASE_REFERENCE.md` when implementation changes the zip contents.

## Core Positioning

The current offer is intentionally low-ticket:

- Free generated static website package.
- Optional done-for-you launch at `$180/year` hosting, plus `$17/year` domain only if WebView.click registers the domain.
- Optional page/edit work from the existing add-on flow.

That is a good foot-in-the-door offer. The goal should not be to make the first purchase expensive. The goal is to make the first yes easy, then offer higher-value services after the owner already believes the site is real and useful.

The free package should feel like:

> A real starter website asset prepared for your business, with a clear path to launch it yourself or have WebView.click launch and improve it for you.

The PDF should make the download feel less like a random zip and more like a professional handoff packet.

## Internal SEO Reality Check

The idea "more unique domains can create more chances to appear in search" has a kernel of truth, but it is dangerous if sold too simply.

Google can show results from multiple domains, but extra domains do not automatically create ranking power. If the sites are thin, duplicated, or built mainly to funnel searchers to the same business, that can look like doorway abuse. Google Search Central's spam policies specifically call out multiple domains or pages targeted at similar regions/cities that funnel users to one destination as a doorway pattern.

So the upsell should not be:

> Buy more cheap websites to dominate Google.

The safer and more durable framing is:

> Build additional web assets only when each one has a real, distinct purpose: a separate location, separate service line, separate campaign, separate brand angle, or genuinely useful local content.

Use "SERP real estate" language carefully. The benefit is increased surface area from useful assets, not guaranteed domination.

Owner-facing rule:

> Do not teach the business owner SEO spam/jargon. Keep the PDF and outreach noob-friendly: "additional focused site for another location, business, campaign, or service" and "more useful pages for customers." Internally, we keep the guardrail so we steer them to pages/sites that have a real business reason.

References checked:

- Google Search spam policies, especially doorway abuse: https://developers.google.com/search/docs/essentials/spam-policies
- Google SEO Starter Guide on useful, unique, clear pages: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google LocalBusiness structured data docs: https://developers.google.com/search/docs/appearance/structured-data/local-business

## Upsell and Sidesell Ladder

### 1. Base Launch

Current offer:

- `$180/year` managed hosting for owned-domain customers.
- `$197/year` if WebView.click registers the domain: `$180/year hosting + $17/year domain`.
- Includes upload, DNS help, SSL check, launch setup, and keeping the generated static site live.

Why it works:

- Low friction.
- Very easy to understand.
- Avoids scaring owners who did not ask for a website.
- Good first paid conversion after a free preview.

Boundary:

- This should launch the generated site as-is.
- It should not include custom redesign, repeated revisions, custom SEO strategy, complex integrations, or monthly consulting.

PDF language:

> Best if you want this website online without touching hosting, DNS, SSL, or file upload.

How we deliver:

- Use the existing static export.
- Upload the same generated files.
- Connect domain/DNS.
- Verify SSL and contact links.

### 2. Launch Plus

Suggested positioning:

- `$297-$397 first year`.
- Includes Base Launch.
- Adds one polish pass: copy cleanup, CTA improvements, image ordering, phone/email/map test, and basic page QA.

Why it fits:

- Owner may like the free site but want small corrections before going live.
- This turns "cheap hosting" into "done-for-you launch with quality check."

PDF language:

> Best if you want the site launched and lightly polished before customers see it.

How we deliver:

- Use generated site JSON and existing renderer.
- Patch copy/images/page content.
- Re-export and republish.
- Keep scope to one polish pass so fulfillment stays simple.

### 3. Growth Setup

Suggested positioning:

- `$497-$997 first year`.
- Includes Base Launch.
- Adds 3-5 service/location pages, local SEO foundation, Search Console guidance, lead capture QA, and stronger conversion copy.

Why it fits:

- This is where the $300/month agency comparison belongs.
- The owner who wants more visibility should buy useful content and setup depth, not just another copy of the same site.

PDF language:

> Best if your goal is not only "have a website," but create more useful pages for customers searching by service, city, and problem.

How we deliver:

- Reuse the existing add/edit page flow.
- Generate new pages from saved business/service data.
- QA mobile layout, buttons, and sitemap.
- Avoid custom integration work in this tier.

### 4. Multi-Site / SERP Real Estate Pack

This is the idea you raised, but it needs careful product boundaries.

Good use cases:

- Multi-location business: one site or landing package per real location.
- Separate service line: e.g. emergency plumbing, water heater installation, bathroom remodeling, commercial maintenance.
- Separate brand/campaign: seasonal offer, financing campaign, recruitment page, event page, or niche-specific landing asset.
- Separate audience: residential vs commercial, homeowners vs property managers, local city page vs county-wide page.

Bad use cases:

- Ten near-identical domains with swapped city names.
- Thin doorway sites that only point users to one main site.
- Same homepage rewritten with minor synonyms.
- Claims that Google must show more results just because domains are unique.

Recommended offer:

- "Additional web asset" or "campaign site," not "ranking clone."
- `$149-$299/year` per additional simple static site if generated mostly from existing data.
- `$299-$699` per additional site when it includes unique copy, unique images, different service focus, and QA.
- Bundle: "3-site visibility pack" at `$497-$997/year` only if each site has a distinct legitimate focus.

PDF language:

> If you have another location, another business, or a separate service line, we can create an additional focused website for that situation.

How we deliver:

- Reuse the existing site generation pipeline.
- Treat each additional site as a separate business/campaign/location brief.
- Generate unique copy, pages, and domain plan.
- Keep it static so launch/hosting remains easy.

### 5. Service Page Pack

Suggested price:

- `$225-$499` for 3-5 service pages.
- Higher if each page needs manual SEO/copy QA.

What it includes:

- Unique service page headings.
- Problem/outcome copy.
- FAQ.
- CTA.
- Internal links.
- LocalBusiness/Service schema roadmap later.

Why it matters:

- Usually safer than extra domains.
- Makes the main site deeper and more useful.
- Easier for owner to understand.

PDF language:

> More pages for your real services can help customers understand what you do before they call.

How we deliver:

- Generate pages inside the current site.
- Add links in navigation/footer where useful.
- Keep content business-owner friendly and service-specific.
- Re-run export so sitemap and PDF reflect the added pages.

### 6. Service Area / City Page Pack

Suggested price:

- `$299-$699`, depending on count and quality.

Rules:

- Only build pages for places the business genuinely serves.
- Each page needs unique useful information, not just city-name swaps.
- Should mention service area, travel/coverage context, and relevant local proof when available.

PDF language:

> If you serve several nearby areas, we can add useful service-area pages. These should be written for real customers in those areas, not copied doorway pages.

How we deliver:

- Use existing service-area data or owner-provided area list.
- Generate one page per real area only when the business genuinely serves it.
- Add area links to the site.
- Keep each page useful and readable for a normal customer.

### 7. Lead Capture Pro

Suggested price:

- `$99-$149 setup` plus `$10-$25/month`, or `$149-$299/year`.

What it includes:

- Contact form delivery test.
- Spam reduction.
- Email/WhatsApp/SMS routing option.
- Lead log export or simple admin notification.
- "Missed lead" prevention checklist.

Why it fits:

- Business owners care about calls and leads more than websites.
- It complements the cheap hosting offer without requiring a redesign.

PDF language:

> Best if you want every form submission and contact button tested before sending traffic to the site.

How we deliver:

- Use simple static-site behavior first: `tel:`, `mailto:`, WhatsApp link, sticky CTA, and prefilled message context.
- Add a floating call or WhatsApp button.
- For WhatsApp, include the current page/title in the message so the owner knows what the visitor was viewing.
- Avoid messy third-party CRM integrations in the first version.

### 8. Automation / Operations Add-Ons

This is the higher-ticket bridge toward the kind of `$300/month` offer you mentioned.

Potential offers:

- Floating WhatsApp button with page context.
- Floating call button.
- Quote intake section with clearer fields.
- Click-to-message buttons per service page.
- Missed-call follow-up workflow.
- Review request workflow.
- Monthly content/update retainer.
- Basic reporting email.

Suggested pricing:

- `$99-$299` setup for one simple automation.
- `$49-$149/month` light maintenance/reporting.
- `$300/month+` only when real ongoing automation, monitoring, reporting, and support are included.

PDF language:

> Once the site is live, we can connect it to simple follow-up workflows so inquiries are easier to manage.

How we deliver:

- Start with code-only/static upgrades inside the site.
- Prefer URL/message prefill, mailto body context, and visible sticky CTAs.
- Only add third-party integrations after the owner already has a launched site and a clear need.

## Recommended PDF Contents

The PDF should replace the feeling of "a zip with some files" with "a professional handoff."

Recommended filename:

`WebView.click Website Package Guide - {Business Name}.pdf`

### Page 1: Cover / Value Summary

Content:

- WebView.click logo/brand.
- Business name.
- Preview/download URL.
- Generated date.
- "Starter website package value: $997"
- "Portfolio sample credit: -$997"
- "Your download today: $0"
- 3 short bullets:
  - Static website files included.
  - Host anywhere.
  - Optional launch help available.

Goal:

- Make the free download feel valuable.
- Reassure owner there is no payment required for the files.

### Page 2: What Is Included

Content from current `WebsiteActionPanel` and export logic:

- `index.html`
- `sitemap.xml`
- `robots.txt`
- `img/` folder
- LocalBusiness structured data in `index.html`
- Local image copies where export could package them
- Mobile-friendly static site
- Navigation/contact behavior preserved in exported HTML

Add site-specific details:

- Business name.
- Main services/offers detected.
- City/service area if available.
- Phone/email/address if available.
- Number of pages included.

Goal:

- Show they are receiving a complete package, not only a template.

### Page 3: Self-Hosting Setup Guide

Compress the old text guide into a designed checklist:

1. Buy or choose a domain.
2. Choose hosting.
3. Upload `index.html`, `sitemap.xml`, `robots.txt`, and `img/`.
4. Connect DNS.
5. Enable SSL/HTTPS.
6. Test desktop/mobile/contact links.
7. Keep domain/hosting renewed.

Goal:

- Keep owner autonomy.
- Make self-setup possible but visibly technical.

### Page 4: Done-For-You Launch Offer

Content:

- "Skip the technical setup."
- `$180/year` managed hosting.
- `$17/year` domain only if WebView.click registers the domain.
- New domain total: `$197/year`.
- Owned domain total: `$180/year`.
- Includes:
  - hosting setup,
  - domain/DNS help,
  - upload,
  - SSL check,
  - launch verification.

Goal:

- Make paid setup the obvious choice if self-hosting feels inconvenient.

### Page 5: Growth Options

Present as optional add-ons, not pressure:

- Launch Plus.
- Growth Setup.
- Service Page Pack.
- Service Area / City Page Pack.
- Additional focused campaign site.
- Lead Capture Pro.
- Automation/maintenance.

Goal:

- Plant the idea that the free site is the starting point, not the ceiling.

### Page 6: Recommended Next Step

Dynamic recommendation based on owner context:

- If no website: "Best next step: launch this site on your domain."
- If business has many services: "Best next step: add service pages before promoting it heavily."
- If downloaded but no setup: "Best next step: ask WebView.click to handle launch."
- If phone/email missing: "Best next step: confirm contact details before launch."

CTA:

- Email: `email@codev.id`
- Preview URL.
- Business ID / reference.

Goal:

- Give the owner a clear reply path.

## PDF Visual Style

Use a printable A4 design:

- White background.
- Restrained WebView.click brand color.
- 8px or smaller radius for cards.
- Strong typographic hierarchy.
- Tables for value/pricing.
- Checklist rows.
- Page footer with business name, WebView.click, and page number.

Avoid:

- Giant marketing hero pages.
- Heavy gradients.
- Dense paragraphs.
- Tiny text that prints badly.
- Anything that looks like a legal invoice.

Page handling:

- Build the PDF as real text/vector PDF content, not screenshots.
- Keep text selectable and links clickable.
- Let long sections continue onto the next page instead of clipping content.

## Implementation Plan

### Recommended Technical Path

Current dependencies already include:

- `jszip`
- `file-saver`

No PDF dependency is currently present.

Implemented first pass:

- No new dependency.
- `SelectablePdfGuide` writes text, boxes, and clickable link annotations directly into a PDF.
- Text remains selectable.
- Preview and email links remain clickable.
- Content paginates when a section grows beyond one page.
- The zip no longer includes `.txt` guide files.

### Files Likely To Change

- `src/lib/exportSiteHtml.ts`
  - Replace `ownerReadmeFirst()` and `ownerSetupGuide()` with a PDF builder.
  - Keep data extraction helpers.
  - Add zip file `WebView.click Website Package Guide - {Business Name}.pdf`.
  - Remove `README-FIRST.txt` and `SETUP-GUIDE.txt`.

- `src/components/WebsiteActionPanel.tsx`
  - Keep visible owner-facing offer copy aligned with the PDF.
  - Reuse the same pricing/value wording where possible.

- `docs/CODEBASE_REFERENCE.md`
  - Update export zip contents after implementation.

### Suggested Code Structure

Add helpers inside `src/lib/exportSiteHtml.ts` first, then extract only if it grows too large:

- `ownerPackageGuideData(siteData, businessId)`
- `ownerPackageGuidePdf(siteData, businessId)`
- `SelectablePdfGuide`
- `pdfTextPagesToBlob(pages, width, height)`

If the PDF logic becomes large, extract later:

- `src/lib/ownerPackageGuidePdf.ts`

## Data To Personalize

From `siteData`:

- business name,
- business ID,
- phone/email/address,
- business category,
- services/offers/products,
- pages included,
- service area,
- review/rating if available,
- canonical/preview URL,
- selected font/palette if useful,
- generated date.

From runtime:

- current owner preview URL,
- download date,
- whether `owner=1` review link is present,
- countdown/archive date if available.

From settings later:

- setup email,
- pricing,
- package names,
- support/contact URL,
- managed hosting copy.

For first implementation, hardcode current known public offer:

- `email@codev.id`
- `$180/year` hosting
- `$17/year` domain fee when WebView.click registers domain
- `$197/year` new-domain total
- `$997` starter value anchor

Later, read pricing from API/settings if needed.

## ZIP Content Recommendation

Target final zip:

- `index.html`
- `sitemap.xml`
- `robots.txt`
- `img/`
- `WebView.click Website Package Guide - {Business Name}.pdf`

Remove:

- `README-FIRST.txt`
- `SETUP-GUIDE.txt`

Current implementation:

- PDF only.
- `.txt` files removed from the zip.

## Copy Blocks For The PDF

### Cover

`Your starter website package is ready`

`This website package was prepared for {Business Name} as a portfolio/sample project. The static site files are yours to download for $0 during the review window. You can host them anywhere, or WebView.click can launch the site for you.`

### Value Table

| Item | Value |
| --- | ---: |
| Starter website package | `$997` |
| Portfolio sample credit | `-$997` |
| Your download today | `$0` |

### Done-For-You Setup

`If you do not want to manage hosting, DNS, file upload, SSL, and launch testing yourself, WebView.click can handle the launch.`

`Owned domain: $180/year. New domain through WebView.click: $197/year including the $17/year domain fee.`

### Multi-Asset Upsell

`If your business has another location, another business, or a separate service line, we can create an additional focused website for that situation.`

### No-Pressure Close

`If this website is not useful, no reply is needed. If you want help launching or improving it, contact email@codev.id with your business name and preview link.`

## Risks and Guardrails

- Do not promise Google ranking or SERP domination.
- Do not sell duplicate domains as an SEO trick.
- Current first pass lets PDF generation run as part of the zip creation, so owner testing should focus on whether the PDF reliably generates. Add fallback later if production owner downloads show failures.
- Do not include private admin metadata or raw generated JSON.
- Do not include `WebsiteActionPanel`, owner countdown, admin tools, or modal UI in `index.html`; current export cleanup must remain.
- Keep PDF file size reasonable. Page images can bloat quickly.
- Test long business names, missing phone/email, missing address, and many services.

## Success Criteria

The implementation is good enough when:

- The owner zip contains a readable branded PDF.
- PDF pages are A4-sized and print without awkward cutoffs.
- The PDF is personalized for the business.
- The PDF clearly explains free download value, included files, self-hosting, done-for-you setup, and upsells.
- The PDF opens correctly after download.
- No internal admin/tool UI appears in the exported website or PDF.
- Admin/business owner copy stays consistent with `WebsiteActionPanel`.

## Suggested First Build Scope

Build only this first:

1. PDF guide with 5-6 pages.
2. Hardcoded current offer prices.
3. Business-specific fields from `siteData`.
4. PDF added to zip.
5. Keep `.txt` files temporarily if PDF generation fails.

Defer:

- Payment-settings-driven PDF pricing.
- Dynamic recommendation scoring.
- Multi-site checkout flow.
- Add-on checkout for Growth Setup.
- PDF analytics/tracking.

This gives the download package an immediate perceived-value upgrade without making the checkout system more complex yet.
