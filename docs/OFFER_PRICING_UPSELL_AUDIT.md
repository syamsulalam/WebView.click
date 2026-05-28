# WebView.click Offer, Pricing, and Upsell Audit

Last updated: 29 Mei 2026.

Purpose: evaluate whether the current free-demo + paid setup offer is priced sensibly for US local businesses, define what the basic offer must deliver before upsells, and list upsells that can be added without weakening the foot-in-the-door strategy.

## Progress Tracker

- [x] Make page add/edit pricing safer for US buyers: checkout UI now uses `$50/action`, checkout API enforces a `$50` minimum, and Settings defaults/tooltips reflect the new minimum.
- [x] Strengthen free exported site SEO perception: owner ZIP now includes `sitemap.xml`, `robots.txt`, and LocalBusiness JSON-LD in `index.html`.
- [x] Improve free demo presentation: desktop navbar is tighter/uppercase and hero sections use the business photo as a soft background layer behind a readable text panel.
- [x] Add crawlable service-area support: generated JSON can provide `locationServed` / `servedAreas`, renderer adds an `Areas Served` nav item and homepage section when data exists.
- [ ] Add admin QA badges for SEO foundation, lead capture verified, schema present, and image variety.
- [ ] Add one-click link test for phone, map, email, and contact form routes.
- [ ] Add LocalBusiness schema preview/debug drawer in `/admin/sites`.

## Short Answer

The current core offer is good as a foot-in-the-door product, but the manual-service parts are underpriced for a US client base.

- `$197/year` with a new domain is acceptable only if the site generation, hosting setup, DNS, SSL, and support are highly automated and tightly scoped.
- `$180/year` for owned-domain hosting/setup is very low if it includes meaningful manual support, launch coordination, revisions, or troubleshooting.
- `$50` for adding a page or editing a page is a more realistic first floor for US buyers, but SEO-heavy new pages should still be priced higher.
- Keep the free site/free preview positioning, but separate "infrastructure setup" from "custom work." The custom work should have higher, clearer pricing.

## Market Context

References:

- US Bureau of Labor Statistics: web developers and digital designers had median wages around `$90k-$98k/year` in May 2024, which implies real US labor is expensive even before business overhead. Source: https://www.bls.gov/ooh/computer-and-information-technology/web-developers.htm
- Google SEO Starter Guide emphasizes clear titles, useful snippets, good link text, and helpful content structure. Source: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google LocalBusiness structured data documentation recommends structured local business data for hours, departments, and business details. Source: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Google Business Profile guidelines recommend a phone number that connects to the individual business location and a website that represents that location. Source: https://support.google.com/maps/answer/100006
- Upwork SEO marketplace pages show broad SEO pricing ranges and reinforce that SEO work has real hourly value, especially for proven results. Source: https://www.upwork.com/hire/seo-specialists/

Interpretation:

- A US local business may compare you against DIY builders at `$15-$40/month`, cheap overseas freelancers, and local agencies charging hundreds or thousands upfront.
- Your advantage is not "cheapest website." Your advantage is "I already built a personalized working preview for your business, and you can go live with almost no effort."
- That means the base price can stay low, but fulfillment scope must be narrow.

## Current Offer Assessment

Current buyer-facing structure:

- Free generated website preview.
- Done-for-you setup:
  - `$180/year` managed hosting.
  - `$17/year` domain fee only if WebView.click registers the domain.
  - SSL, DNS/upload, launch setup included.
- Optional page add/edit now starts at `$50/action` with bulk discounts.

Assessment:

- Base offer: strong for conversion because it removes risk and creates urgency.
- Domain fee: clear enough.
- Hosting/setup fee: low, but usable if positioned as a simple annual infrastructure package.
- Page add/edit: improved to `$50/action` minimum, but still needs clear scope so customers understand this is light page work, not full SEO strategy.

Recommended immediate adjustment:

- Keep base setup price as-is until conversion data exists.
- Raise page work before promoting it heavily.
- Add clearer scope limits to the base package.

## Basic Offer Must Be Solid First

Before adding aggressive upsells, every generated site should pass these checks.

### Visual Quality

- Looks good on mobile, tablet, and desktop.
- Header, nav, hero, services, gallery, contact, and footer do not overlap.
- Images are varied when multiple gallery photos exist.
- Font pairing and palette feel different across businesses, even in the same industry.
- CTA buttons are obvious and not visually overloaded.

### SEO Foundation

- Unique title and meta description per site/page.
- Business name, service, and city/area appear naturally in headings and body copy.
- LocalBusiness JSON-LD includes business name, URL, phone, address when available, opening hours when available, and sameAs/social links when available.
- Pages use clean internal links and descriptive anchor text.
- Sitemap and robots output are correct for downloaded/hosted sites.
- Images include useful alt text where possible.

### Conversion and Lead Capture

- Phone links use `tel:` and work on mobile.
- Email links use `mailto:` and include useful prefilled context where appropriate.
- Contact form submissions are deliverable or clearly fall back to email.
- Primary CTA is repeated in hero, service sections, and footer.
- Maps/directions link works.
- Business address and service area are visible and crawlable as text.
- The site makes the business look reachable within 5 seconds on mobile.

### Copy Quality

- Copy should name the customer's problem before pitching services.
- Copy should include proof signals from Google data when available: rating, review count, years/opening signal, service categories, photos, and location.
- Each service card should explain the outcome, not only list a service name.
- Avoid generic "trusted professionals" filler unless supported by gathered data.
- Use industry-specific objections:
  - Contractors: reliability, scheduling, estimates, licensed/insured if known.
  - Medical/wellness: comfort, clarity, booking.
  - Restaurants: menu, hours, directions, photos.
  - B2B/local services: response speed, service area, quote request.

## Pricing Recommendation

Keep the current base offer temporarily:

- New domain: `$197/year`.
- Owned domain: `$180/year`.

But rename internally:

- Base annual infrastructure + launch setup.
- No included custom page work beyond generated site launch.
- Minor typo fixes can be included, but not page rewrites.

Change add/edit pricing:

- Tiny text/image swap: `$19-$29`.
- Existing page copy edit: `$49-$79`.
- New generated service page with QA: `$79-$149`.
- New city/service-area page with SEO intent: `$99-$199`.
- Custom landing page or heavy rewrite: `$199+`.

Pragmatic first implementation:

- Replace `$10/page action` with `$50/action` plus existing bulk discount:
  - 5-9 page actions get 10% off.
  - 10+ page actions get 20% off.
  - Keep SEO-heavy city/service-area pages as a later upsell above this base page-work price.

Why:

- `$10` is acceptable only for a fully automated, no-review, no-client-discussion action.
- If a human reads instructions, edits copy, checks layout, and QA's mobile, `$10` will lose money or force rushed work.

## Upsell Ideas

Prioritize upsells that either increase lead capture or reduce owner friction.

### High-Priority Upsells

1. Lead Capture Pro
   - Adds tested contact form routing, spam protection, email notification, WhatsApp/SMS optional routing, and lead log export.
   - Suggested price: `$99 setup + $10-$25/month`, or `$149/year`.

2. Local SEO Launch Pack
   - Adds title/meta polish, LocalBusiness schema QA, sitemap submission guidance, Search Console setup guidance, and NAP consistency checklist.
   - Suggested price: `$199-$399 one-time`.

3. Service Page Pack
   - Adds 3-5 SEO-ready service pages based on business categories and local search intent.
   - Suggested price: `$225-$499`.

4. Service Area / City Page Pack
   - Adds pages for nearby cities or service areas.
   - Suggested price: `$299-$699`, depending on count and QA.

5. Copy Polish / Trust Upgrade
   - Rewrites hero, service copy, FAQ, proof points, and CTA language for stronger conversion.
   - Suggested price: `$149-$399`.

### Medium-Priority Upsells

- Review/Testimonials section setup: `$79-$149`.
- Gallery cleanup and image selection: `$49-$149`.
- Logo/favicon polish from business name/photo: `$49-$99`.
- Booking link integration: `$49-$149`.
- Menu/catalog/product section formatting: `$99-$299`.
- Email address setup guidance: `$49-$99`.
- Monthly change retainer: `$49-$149/month`.

### Do Later

- Full CRM.
- Advanced analytics dashboard.
- Online payments/ecommerce.
- Blog/content subscriptions.
- AI chat widget.

These are larger support surfaces and can distract from making the launch offer reliable.

## Recommended Packaging

Keep three simple choices:

### Launch

- `$197/year` with new domain or `$180/year` with owned domain.
- Generated site as-is.
- Hosting, SSL, DNS/upload, launch setup.
- No custom page work.

### Launch Plus

- `$297-$397/year`.
- Includes Launch.
- Includes one copy polish pass or one full-page edit.
- Includes lead capture QA.

### Growth Setup

- `$497-$997 first year`.
- Includes Launch.
- Includes 3-5 service/city pages.
- Includes Local SEO Launch Pack.
- Includes conversion copy polish.

Keep the first screen focused on Launch. Present Plus/Growth after the buyer has accepted the term/domain flow or as a post-checkout upgrade.

## Product Improvements To Support The Basic Offer

Admin/generation improvements:

- Add a generated-site QA checklist score per site: mobile layout, image variety, CTA links, phone link, map link, form route, schema presence, title/meta presence.
- Add "lead capture verified" badge on `/admin/sites`.
- Add one-click "Test phone/map/email/form links" in preview/admin.
- Add LocalBusiness schema preview in site data drawer.
- Add "SEO foundation ready" badge with missing fields.
- Add generated copy audit: generic copy, missing location, missing service outcome, weak CTA.
- Add image audit: duplicate service images, missing alt text, low variety.

Owner-facing improvements:

- Show a short "What is included" summary before payment.
- Make optional custom work clearly optional and priced as custom work.
- Put "Your site can go live as-is" near the domain step.
- After payment, show the exact next steps: domain, DNS/access, launch confirmation.

## Final Recommendation

Do not raise the base price yet unless fulfillment becomes painful. The base offer is a conversion wedge.

Do keep add/edit pricing at or above the new `$50/action` floor before you sell it at scale. For US local businesses, `$10` should be reserved for automated micro-edits only. SEO-oriented pages should still be priced higher.

The best next product work is not another upsell. It is making the generated site reliably pass the basic promise:

- looks good,
- loads fast,
- has correct business data,
- has working contact paths,
- has local SEO basics,
- and gives the owner confidence that the demo is already usable.
