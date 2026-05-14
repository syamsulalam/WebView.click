# Site Builder JSON and Renderer Upgrade Plan

Last updated: 14 Mei 2026.

Tujuan dokumen ini: merencanakan upgrade schema JSON dan renderer supaya WebView.click bisa menghasilkan situs yang benar-benar customized, personalized, dan terlihat profesional, bukan hanya layout generic dari sample JSON.

Input utama:
- Current demo: `/demo` render dari `JSON/template-schema.json`.
- Google Places data inventory: `docs/GOOGLE_PLACES_DATA_INVENTORY.md`.
- Current renderer: `src/components/SiteRenderer.tsx`.

## Diagnosis Current `/demo`

Masalah utama:
- Homepage thin content: hanya hero + feature sederhana untuk tab home.
- Layout terasa primitif karena renderer belum memanfaatkan variasi section, spacing, imagery, sticky CTA, trust proof, dan responsive composition yang matang.
- Banyak data di JSON belum dipakai secara visual: rating, reviews, social proof, logo SVG/image, gallery, opening hours, contact details, services, menu, and footer socials.
- Current renderer banyak placeholder gambar, bukan image-aware composition.
- Styling terlalu hardcoded di renderer, sehingga JSON belum bisa mengontrol layout style secara granular.

Kesimpulan:
- Kita tidak cukup hanya menaruh `customCss` di JSON.
- Kita perlu upgrade dua sisi:
  1. JSON schema yang lebih kaya dan grounded dari Google Places.
  2. Renderer yang punya section components modern dan token-driven styling.

## Core Product Direction

WebView.click harus membangun situs B2B lokal yang terasa:
- Lokal dan relevan dengan bisnisnya.
- Dipersonalisasi dari data asli Google Business Profile.
- Modern, cepat, dan conversion-focused.
- Cukup fleksibel untuk banyak niche: contractor, cafe, plumber, salon, dentist, restaurant, landscaper, cleaning, auto repair, etc.

Homepage ideal harus minimal punya:
- Hero dengan value proposition spesifik.
- Trust proof dari rating/review count.
- CTA jelas: call, quote, directions, booking.
- Services/products section.
- Why choose us / differentiators.
- Reviews/testimonials.
- Gallery/work samples.
- Hours/location/contact.
- FAQ.
- Sticky mobile CTA.

## Recommended JSON Schema Additions

### 1. Source Data Block

Tambahkan `sourceData` agar generator dan renderer tahu field mana berasal dari Google Places.

```json
{
  "sourceData": {
    "provider": "google_places",
    "placeId": "ChIJ...",
    "resourceName": "places/ChIJ...",
    "googleMapsUri": "https://maps.google.com/...",
    "lastSyncedAt": "2026-05-14T00:00:00Z",
    "businessStatus": "OPERATIONAL",
    "pureServiceAreaBusiness": false,
    "hasWebsite": false,
    "websiteUri": null,
    "attributions": []
  }
}
```

Why:
- Enables CRM badges.
- Helps renderer avoid storefront language for service-area businesses.
- Keeps compliance/source trace.

### 2. Brand Block

Current color extraction should become explicit.

```json
{
  "brand": {
    "logoImageUrl": "",
    "logoSvg": "",
    "palette": ["#111827", "#4F46E5", "#F3F4F6"],
    "mood": "warm-local-premium",
    "visualStyle": "modern-local-service",
    "imageTreatment": "rounded-editorial",
    "preferredHeroImage": "",
    "photoSource": "google_places",
    "googlePhotoReference": "",
    "photoCaption": "Photo from Google Business Profile",
    "photoAttributions": []
  }
}
```

Why:
- Separates brand from global header config.
- Lets renderer consistently use logo/palette/image treatment.

### 3. Business Profile Block

```json
{
  "businessProfile": {
    "name": "Kopi Senja Jakarta",
    "primaryType": "cafe",
    "typeLabel": "Coffee shop",
    "categories": ["cafe", "bakery", "breakfast"],
    "shortPitch": "Neighborhood cafe with local beans and a comfortable work-friendly setting.",
    "serviceArea": ["Jakarta Selatan", "Senopati"],
    "address": {
      "formatted": "",
      "short": "",
      "city": "",
      "state": "",
      "postalCode": "",
      "country": ""
    },
    "contact": {
      "phoneNational": "",
      "phoneInternational": "",
      "email": "",
      "bookingUrl": "",
      "directionsUrl": ""
    }
  }
}
```

Why:
- Makes copy and contact modules source-driven.

### 4. Trust Proof Block

```json
{
  "trust": {
    "rating": 4.8,
    "reviewCount": 320,
    "reviewSummary": "",
    "reviews": [
      {
        "authorName": "Andi W",
        "rating": 5,
        "text": "Kopinya enak banget...",
        "relativePublishTimeDescription": "2 months ago",
        "attribution": ""
      }
    ],
    "badges": ["Open now", "Local favorite", "Fast response"]
  }
}
```

Why:
- Trust proof should be first-viewport visible for local business sites.
- Badges can be generated from rating, hours, review count, and service flags.

### 5. Offers / Services Block

```json
{
  "offers": [
    {
      "title": "Concrete Pouring",
      "description": "Driveways, patios, slabs, and small commercial pours.",
      "priceHint": "Free estimate",
      "image": "",
      "cta": { "text": "Request Quote", "href": "#contact" }
    }
  ]
}
```

Why:
- Current `gridCards` is generic. Offers should become reusable source-of-truth.
- For restaurants, same block can represent menu highlights.

### 6. Amenities / Capabilities Block

Generated from Google Places boolean flags.

```json
{
  "capabilities": [
    { "label": "Delivery", "enabled": true, "source": "google_places.delivery" },
    { "label": "Outdoor seating", "enabled": true, "source": "google_places.outdoorSeating" }
  ]
}
```

Why:
- Allows renderer to show icon badges or omit unavailable items.

### 7. Location and Hours Block

```json
{
  "location": {
    "formattedAddress": "",
    "mapEmbedUrl": "",
    "directionsUrl": "",
    "latitude": null,
    "longitude": null,
    "isServiceAreaBusiness": false
  },
  "hours": {
    "timezone": "America/Chicago",
    "openNow": true,
    "regular": [],
    "current": []
  }
}
```

Why:
- Need proper Contact/Hours/Map section.

### 8. Conversion Block

```json
{
  "conversion": {
    "primaryCta": { "text": "Call Now", "href": "tel:+1..." },
    "secondaryCta": { "text": "Get Directions", "href": "https://maps.google.com/..." },
    "stickyMobileCta": true,
    "leadForm": {
      "enabled": true,
      "fields": ["name", "phone", "message"],
      "submitLabel": "Request a Free Quote"
    }
  }
}
```

Why:
- Local business sites need conversion primitives, not just visual content.

### 9. SEO Block

```json
{
  "seo": {
    "title": "",
    "description": "",
    "localBusinessSchema": {},
    "keywords": [],
    "cityLandingPhrase": "Concrete contractor in Dallas, TX"
  }
}
```

Why:
- We can generate structured data from Google Places + business type.

## Renderer Upgrade Plan

### Phase 1: Modernize Existing Renderer

Keep `SiteRenderer.tsx`, but split into section components:
- `HeroSection`
- `TrustBar`
- `FeatureGrid`
- `OfferGrid`
- `ReviewSection`
- `GallerySection`
- `HoursLocationSection`
- `ContactSection`
- `FaqSection`
- `StickyMobileCta`

Immediate visual upgrades:
- Use full-width section bands with constrained inner content.
- Use stronger typography hierarchy.
- Add trust bar directly below hero.
- Use responsive two-column hero with image/background when image exists.
- Use modern cards only for repeated items, not page section wrappers.
- Add mobile sticky CTA.
- Render logo SVG/image in header.
- Render social proof from `trust`.
- Convert placeholder image boxes into real `img` when URL exists, fallback placeholder only if no image.

### Phase 2: Token-Driven Styling

Keep style controlled by JSON tokens:

```json
{
  "design": {
    "themeVariables": {
      "colors": {},
      "typography": {},
      "uiTokens": {}
    },
    "layout": {
      "heroVariant": "split-image",
      "sectionDensity": "comfortable",
      "cardStyle": "clean-border",
      "navStyle": "sticky-solid",
      "ctaStyle": "high-contrast"
    }
  }
}
```

Important:
- Avoid arbitrary raw CSS as the primary customization system.
- Allow `customCss` as escape hatch, but renderer should support common professional variants natively.

Why not rely on custom CSS only:
- Raw CSS from AI can be inconsistent and hard to debug.
- Tailwind utility classes in renderer are safer and more predictable.
- JSON tokens can select known layout variants.

### Phase 3: Industry-Specific Templates

Use `primaryType` and `types` to choose modules:

Contractor/service business:
- Hero: service + location + "Free estimate"
- Services grid
- Project gallery
- Service area
- Reviews
- FAQ
- Quote form

Restaurant/cafe:
- Hero with atmosphere/menu image
- Menu highlights
- Hours
- Reviews
- Gallery
- Location/directions
- Reservation/call CTA

Medical/dental:
- Services
- Insurance/payment info
- Reviews
- Team
- Appointment CTA
- Hours/location

Salon/spa:
- Services/pricing
- Gallery
- Reviews
- Booking CTA
- Hours/location

Auto repair:
- Services
- Certifications/trust badges
- Reviews
- Quote/call CTA
- Location/hours

### Phase 4: Demo as QA Surface

`/demo` should evolve into:
- Sample selector: cafe, contractor, plumber, salon, dentist.
- JSON inspector panel with missing/unused fields.
- Toggle desktop/mobile preview width.
- Highlight which Google Places fields powered each section.
- Visual QA list: missing logo, missing CTA, missing reviews, missing contact, etc.

## Google Places to JSON Mapping

| Places data | JSON target | Renderer output |
| --- | --- | --- |
| `displayName` | `businessProfile.name` | Header/logo text, hero |
| `primaryTypeDisplayName` | `businessProfile.typeLabel` | Hero eyebrow, service context |
| `websiteUri` missing | `sourceData.hasWebsite = false` | CRM badge, no website lead |
| `nationalPhoneNumber` | `businessProfile.contact.phoneNational` | Call CTA |
| `googleMapsUri` | `businessProfile.contact.directionsUrl` | Directions CTA |
| `formattedAddress` | `location.formattedAddress` | Contact/location section |
| `regularOpeningHours` | `hours.regular` | Hours section |
| `rating`, `userRatingCount` | `trust.rating`, `trust.reviewCount` | Trust bar |
| `reviews` | `trust.reviews` | Testimonials |
| `photos` | `brand.preferredHeroImage`, gallery | Hero/gallery |
| amenity booleans | `capabilities[]` | Icon badges/features |
| `pureServiceAreaBusiness` | `location.isServiceAreaBusiness` | Service-area copy |
| `priceLevel`, `priceRange` | `offers.priceHint` or `businessProfile.pricePositioning` | Pricing cues |
| `reviewSummary` | `trust.reviewSummary` | Review summary section |

## Recommended JSON Section Types

Add or improve:
- `trustBar`
- `serviceArea`
- `offers`
- `reviews`
- `hoursLocation`
- `faq`
- `stickyCta`
- `beforeAfterGallery`
- `credentials`
- `processSteps`
- `mapBlock`
- `quoteForm`

Each section should have:
- `id`
- `type`
- `variant`
- `content`
- optional `sourceFields`
- optional `visibilityRules`

Example:

```json
{
  "type": "trustBar",
  "variant": "rating-phone-location",
  "sourceFields": ["trust.rating", "trust.reviewCount", "businessProfile.contact.phoneNational"],
  "content": {
    "items": [
      { "label": "Google Rating", "value": "4.8" },
      { "label": "Reviews", "value": "320+" },
      { "label": "Call", "value": "(214) 555-0123" }
    ]
  }
}
```

## Tailwind Renderer Recommendations

Use Tailwind in renderer for:
- Responsive grids: `grid md:grid-cols-2`, `lg:grid-cols-3`.
- Section bands: `py-16 md:py-24`, `bg-white`, `bg-slate-50`.
- Header: sticky, border, logo, CTA.
- Cards: max radius 8-12px, subtle border/shadow.
- Hero: image-aware variants.
- Trust bars: compact, scannable, not oversized.
- Sticky mobile CTA: bottom fixed only on small screens.

Avoid:
- Putting entire sections inside decorative cards.
- One-note color palettes.
- Random AI-generated CSS without constraints.
- Huge hero text inside compact panels.
- Placeholder-only image blocks in production preview.

## Should We Use `customCss` in JSON?

Yes, but as an escape hatch, not the main design engine.

Recommended policy:
- Renderer owns layout quality.
- JSON tokens choose variants.
- `customCss` can add niche-specific effects or minor overrides.
- AI prompt should be instructed not to override structural layout with broad CSS.

Potential safe `customCss` uses:
- Brand-specific hover effect.
- Simple background texture.
- Extra animation class.
- Minor typography adjustment.

Unsafe `customCss` uses:
- Global layout reset.
- Overriding every section.
- Absolute positioning content.
- Hiding required attribution/CTA.

## Implementation Roadmap

### Step 1: Data model

- Status: implemented for the baseline sample and generator prompt.
- Added `sourceData`, `brand`, `businessProfile`, `trust`, `offers`, `capabilities`, `location`, `hours`, `conversion`, `seo`.
- Updated `JSON/template-schema.json`.
- Updated AI prompt in `functions/api/[[path]].ts`.

### Step 2: Places ingestion

- Migrate `/api/places/search` to Places API (New).
- Add field masks.
- Normalize Google data into CRM rows.
- Add no-website sorting/filtering.
- Fetch Place Details before generate.

### Step 3: Renderer

- Status: first renderer pass implemented inside `SiteRenderer.tsx`.
- Added modern variants for hero, trust, offers, reviews, hours/location, contact, FAQ.
- Render real images when absolute/same-origin URLs are available, with safer fallback frames for filenames/placeholders.
- Added sticky mobile CTA.
- Still recommended later: split each section into smaller components after the behavior stabilizes.

### Step 4: Demo QA

- Add multiple sample JSON fixtures.
- `/demo` sample selector.
- Add debug panel for missing/unused fields.
- Add viewport toggles.

### Step 5: Compliance

- Store/display attributions when Google photos/reviews are shown.
- Prefer owner-provided or generated assets for final hosted website.
- Keep Google content usage policy visible in docs and implementation notes.

## Current Next Steps

1. Create one richer contractor sample JSON because "no website local service business" is our core use case.
2. Update `/demo` to choose between cafe and contractor samples.
3. Add `No Website` badge and sort in CRM Leads.
4. Migrate `/api/places/search` to Places API (New) with field masks.
5. Add verified owner-media path later via Business Profile access or direct owner upload.

## Photo Selection Policy

Places API photo data should be treated as Google Places content with attribution requirements. Current implementation:
- Shows photos from the existing Places search response.
- Sorts photos best-effort by likely brand/owner signal:
  1. attribution text resembles the business name,
  2. attribution is not exposed,
  3. visible UGC attribution.
- Stores selected photo attribution metadata in generated JSON under `brand.photoAttributions`.
- Uses selected image only after admin explicitly clicks it.
- Free previews keep Google Places photos as runtime proxy/hotlink images and do not upload those images to R2.
- Paid sites should replace Google Places photos with owner-provided/generated assets before final R2 storage.

Important limitation:
- Places API does not provide a reliable owner-owned flag for photos.
- If we need verified owner media, add a separate Google Business Profile owner-auth workflow or request direct image upload from the business.
