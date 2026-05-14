# Niche Style Presets

Last updated: 14 Mei 2026.

Dokumen ini merancang sistem `design.stylePreset` agar site builder tidak hanya mengganti warna, tetapi juga mengganti nuansa visual per niche.

## Implementation Contract

JSON field:

```json
{
  "design": {
    "stylePreset": "contractor-rugged"
  }
}
```

Renderer:
- `SiteRenderer` membaca `design.stylePreset`, `design.themeVariables.stylePreset`, atau fallback `brand.visualStyle`.
- Renderer menambahkan class `wv-preset-{preset}` di root site.
- Registry preset ada di `src/lib/siteStylePresets.ts`.
- CSS preset diekspor sebagai `siteStylePresetCss` dan diinjeksi oleh `SiteRenderer` sebagai layer kecil di atas Tailwind.
- Preset tidak boleh menyembunyikan CTA, attribution, atau konten penting.

JSON sample juga membawa:
- `design.stylePreset`
- `design.stylePresetConfig`
- `design.styleSystem.allowedPresets`
- `design.styleSystem.selectionRule`

`/demo` memiliki selector style preset supaya visual QA bisa dilakukan tanpa mengedit JSON manual.

## Presets Implemented in Code

### `local-clean`

Default untuk bisnis lokal umum.
- Clean cards.
- Neutral spacing.
- Minimal visual effects.

### `contractor-rugged`

Untuk concrete, roofing, construction, HVAC, plumbing, electrician, paving, remodeling.
- Stronger shadows.
- Slight industrial section texture.
- Better with dark primary + amber/orange accent.
- Use for trust, quote, before/after gallery, service area.

### `legal-authority`

Untuk law firm, attorney, tax, notary, immigration, accounting.
- Smaller radius.
- More formal composition.
- Less playful effects.
- Better with navy, charcoal, white, gold accent.

### `garden-organic`

Untuk landscaping, lawn care, tree service, nursery, florist.
- Softer radius.
- Organic green ambient section texture.
- Better with green/cream/earth accents, but avoid making the entire site beige.

### `pool-aqua`

Untuk pool cleaning, pool builder, spa, aquatic services.
- Aqua section wash.
- Light blue borders.
- Bright CTA contrast.

### `dental-clean`

Untuk dentist, orthodontist, clinic, medical office.
- Clean cyan-ish shadows.
- Bright whitespace.
- Calm, clinical, low-noise UI.

### `cafe-warm`

Untuk cafe, bakery, restaurant, bar, food service.
- Warm depth.
- Editorial image treatment.
- Works well with menu highlights and review sections.

## Presets to Add Next

### `auto-shop-steel`

Niche:
- Auto repair
- Tire shop
- Body shop
- Detailing

Visual:
- Dark steel header.
- High contrast cards.
- Subtle diagonal/garage texture.
- Bold CTA strips.

### `salon-soft-luxe`

Niche:
- Salon
- Spa
- Massage
- Beauty clinic
- Nail studio

Visual:
- Soft shadows.
- Elegant thin borders.
- Large image focus.
- Pastel accent but avoid one-note pink/purple.

### `fitness-energy`

Niche:
- Gym
- Personal trainer
- Martial arts
- Yoga studio

Visual:
- Punchy CTA.
- Strong rhythm sections.
- Progress/process blocks.
- Dark/light alternating bands.

### `restaurant-editorial`

Niche:
- Restaurant
- Fine dining
- Bar
- Catering

Visual:
- Editorial hero.
- Menu cards.
- Dark footer with reservation CTA.
- Image grid with captions.

### `real-estate-premium`

Niche:
- Realtor
- Property manager
- Home staging

Visual:
- Spacious layout.
- Premium listing cards.
- Muted luxury palette.
- Strong contact form.

### `home-cleaning-fresh`

Niche:
- Cleaning service
- Janitorial
- Maid service
- Pressure washing

Visual:
- Fresh bright background.
- Blue/green accent.
- Checklist-heavy cards.
- Before/after sections.

### `security-trust`

Niche:
- Locksmith
- Security systems
- Fire safety

Visual:
- Strong trust badges.
- Dark primary.
- Yellow/red caution accent used sparingly.
- Emergency CTA prominent.

### `education-friendly`

Niche:
- Tutoring
- Preschool
- Music school
- Training center

Visual:
- Friendly but professional.
- Rounded cards.
- Class/program grid.
- Testimonials and schedule emphasis.

### `pet-care-friendly`

Niche:
- Vet
- Groomer
- Boarding
- Pet training

Visual:
- Friendly cards.
- Warm accent.
- Service packages.
- Review-heavy homepage.

### `financial-trust`

Niche:
- Insurance
- Bookkeeping
- Financial advisor
- Mortgage broker

Visual:
- Conservative layout.
- Trust badges.
- Subtle green/blue accents.
- Strong compliance-friendly copy.

## Current Registry

Source of truth:
- `src/lib/siteStylePresets.ts`

Exported helpers:
- `siteStylePresets`
- `normalizeStylePreset(value)`
- `getStylePreset(value)`
- `inferStylePresetFromText(value)`
- `siteStylePresetCss`

Consumers:
- `SiteRenderer` renders class + CSS.
- `AdminLeads` infers preset from Places text/types and writes `design.stylePreset`.
- `/demo` exposes selector from `siteStylePresets`.
- AI prompt sees allowed presets from `JSON/template-schema.json`.

## Preset Selection Logic

Current CRM generation uses `inferStylePresetFromText()` keyword/type matching:
- contractor/concrete/roof/plumb/electric/HVAC -> `contractor-rugged`
- law/attorney/legal/notary/tax -> `legal-authority`
- landscape/garden/lawn/tree/florist -> `garden-organic`
- pool/spa/swimming -> `pool-aqua`
- dentist/dental/clinic/doctor -> `dental-clean`
- cafe/coffee/bakery/restaurant/bar/food -> `cafe-warm`
- fallback -> `local-clean`

Later improvement:
- Use Places `primaryType`, `types`, review text, and query intent.
- Let admin override preset before generate.
- Add `/demo` preset selector to QA all styles.

## CSS Guardrails

Allowed:
- shadows
- border radius
- section background texture
- image treatment
- card surface depth
- CTA emphasis

Avoid:
- absolute-positioned content
- hidden attribution
- hidden CTA
- global font scaling by viewport width
- one-color themes
- decorative blobs/orbs
- arbitrary AI CSS that breaks layout
