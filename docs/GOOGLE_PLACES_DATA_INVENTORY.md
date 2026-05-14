# Google Places API Data Inventory for WebView.click

Last researched: 14 Mei 2026.

Dokumen ini merangkum data bisnis yang bisa ditarik dari Google Places API dan bagaimana data tersebut relevan untuk CRM lead finder serta AI site builder WebView.click.

Sumber utama:
- Place Data Fields (New): https://developers.google.com/maps/documentation/places/web-service/data-fields
- Place resource reference: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Text Search (New): https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText
- Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
- Place Photos (New): https://developers.google.com/maps/documentation/places/web-service/place-photos
- Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies

## Executive Summary

Google Places can provide enough structured business data to identify strong website prospects, especially:
- Businesses with no `websiteUri`.
- Businesses with active `businessStatus`.
- Businesses with phone, address, hours, ratings, review count, reviews, photos, and service/amenity flags.
- Service-area businesses such as plumbers, cleaners, contractors, and other local services via `pureServiceAreaBusiness`.

For our product, the highest-value lead signal is:

`businessStatus == OPERATIONAL && !websiteUri`

Secondary lead-quality signals:
- Has `nationalPhoneNumber` or `internationalPhoneNumber`.
- Has strong `rating` and `userRatingCount`.
- Has `photos` that can inspire branding and layout.
- Has `reviews`, `reviewSummary`, or `generativeSummary` for personalization.
- Has specific service flags or type metadata that can generate better landing page sections.

## Current vs Recommended API Pattern

Current implementation:
- Uses legacy `https://maps.googleapis.com/maps/api/place/textsearch/json`.
- Returns `results` with legacy-style fields.
- Good for quick proof of concept, but less explicit about field masks and pricing.

Recommended production path:
1. Use Text Search (New): `POST https://places.googleapis.com/v1/places:searchText`.
2. Use `X-Goog-FieldMask` to request only fields needed for CRM list display.
3. For selected lead, call Place Details (New): `GET https://places.googleapis.com/v1/places/{placeId}` with a richer field mask.
4. Use Place Photos (New) for selected photo resources.

Why:
- New API requires field masks, which avoids over-fetching and helps control billing.
- Search can filter/rank better and return richer structured fields.
- Details can fetch expensive fields only after admin chooses a promising lead.

## Text Search Request Inputs

Text Search (New) supports:
- `textQuery`: required free text query, e.g. `concrete contractor Dallas Texas`.
- `languageCode`: localize returned details.
- `regionCode`: region formatting/filtering context.
- `rankPreference`: `RELEVANCE` or `DISTANCE`.
- `includedType`: one supported place type.
- `openNow`: only currently open businesses.
- `minRating`: minimum rating.
- `locationBias`: bias results around circle/rectangle.
- `locationRestriction`: restrict results to rectangle.
- `includePureServiceAreaBusinesses`: include service-area businesses that visit/deliver to customers and may not expose address/location.
- `includeFutureOpeningBusinesses`: include businesses that will open later.

For WebView.click, add UI controls later:
- Query text.
- Location/city/state.
- `openNow`.
- Min rating.
- Include service-area businesses.
- Show only no-website leads.
- Sort by no website, review count, rating, and operational status.

## Search Response Data

Text Search (New) can return:
- `places[]`: matched place objects.
- `routingSummaries[]`: route summaries aligned with places.
- `contextualContents[]`: experimental contextual reviews/photos/justifications relevant to the query.
- `nextPageToken`: pagination.
- `searchUri`: Google Maps search link.

For our CRM list:
- Use `places[]` as the main lead rows.
- Keep `nextPageToken` for "Load more".
- Use `searchUri` for debugging/admin traceability.
- Consider contextual contents later for AI copywriting, but mark as experimental.

## Core Place Fields

### Identification

Useful fields:
- `name`: resource name like `places/{placeId}`.
- `id`: unique place ID.
- `displayName`: human-readable localized business/place name.
- `types`: type tags.
- `primaryType`: main supported type.
- `primaryTypeDisplayName`: localized display name for primary type.
- `googleMapsTypeLabel`: type label shown on Google Maps.

Use in WebView.click:
- `id` becomes canonical `google_place_id`.
- `displayName.text` becomes `business_name`.
- `primaryType`/`types` become `niche`.
- `googleMapsTypeLabel` can seed industry-specific templates.

### Address and Location

Useful fields:
- `formattedAddress`: full readable address.
- `shortFormattedAddress`: compact address.
- `postalAddress`: structured postal address.
- `addressComponents`: locality/state/country/zip components.
- `plusCode`: plus code for location.
- `location`: latitude/longitude.
- `viewport`: map viewport.
- `addressDescriptor`: landmarks/areas where available.
- `utcOffsetMinutes` and `timeZone`.

Use in WebView.click:
- Generate Contact/Location section.
- Infer city/state for slug and SEO.
- Create local SEO title: `{service} in {city}, {state}`.
- Create "Serving {city}" copy for service businesses.
- For service-area businesses, location may be omitted. Use `pureServiceAreaBusiness` to avoid assuming they have walk-in premises.

### Contact and Links

Useful fields:
- `nationalPhoneNumber`.
- `internationalPhoneNumber`.
- `websiteUri`.
- `googleMapsUri`.
- `googleMapsLinks`.

Use in WebView.click:
- `websiteUri` is the key lead filter. If missing, label lead as `No Website`.
- Phone drives CTA buttons (`Call Now`, `Text`, possibly WhatsApp only for relevant markets).
- `googleMapsUri` should be stored as source link/admin reference.
- `googleMapsLinks` can power "Directions", "Reviews", or "View on Google" buttons.

Important lead scoring:
- Highest target: operational business, has phone, no website.
- Exclude or de-prioritize businesses with `websiteUri` unless offering redesign.

### Business Status

Useful fields:
- `businessStatus`.
- `openingDate`.
- `movedPlace`.
- `movedPlaceId`.

Use in WebView.click:
- Prioritize `OPERATIONAL`.
- Hide/de-prioritize `CLOSED_TEMPORARILY`.
- Exclude `CLOSED_PERMANENTLY`, unless `movedPlaceId` exists and we want to follow the replacement.
- Future opening businesses can be a lead type, but copy must avoid "open now" claims.

### Hours

Useful fields:
- `regularOpeningHours`.
- `currentOpeningHours`.
- `regularSecondaryOpeningHours`.
- `currentSecondaryOpeningHours`.

Use in WebView.click:
- Contact section with weekly schedule.
- Hero trust detail: `Open today until ...`.
- For restaurants/retail, add "Hours" block.
- Secondary hours can describe drive-through, pickup, delivery, takeout, etc.

### Ratings and Reviews

Useful fields:
- `rating`: 1.0 to 5.0.
- `userRatingCount`: total number of reviews.
- `reviews`: up to 5 reviews sorted by relevance.
- `reviewSummary`: AI-generated summary from reviews.
- `consumerAlert`: alerts for suspicious review activity or policy issues.

Use in WebView.click:
- Social proof section.
- Testimonial cards.
- Trust bar: `4.8 stars from 320 reviews`.
- AI copywriting can infer strengths from reviews.
- `consumerAlert` should warn admin before using reviews as marketing proof.

Policy note:
- Reviews and photos require attribution when displayed.
- Be careful with caching/storing Google Maps content. Google policy allows Place IDs more freely than full Places content. Treat Google-derived content as source data for preview/admin workflow, not as unrestricted owned content.

### Photos and Visual Assets

Useful fields:
- `photos`: up to 10 photo references on Place resource.
- Place Photos API returns media for a requested photo resource name.
- Photo responses may include `authorAttributions`.

Use in WebView.click:
- Admin selects likely logo/brand image.
- Extract palette colors from selected photo/logo.
- Choose hero/gallery imagery.
- Generate image placeholders or use own/generated images if Google photo licensing/attribution is not appropriate.
- Free preview sites should hotlink/proxy Google Places photos at runtime through `/api/places/photo`, not copy them to R2.
- Paid sites should replace Google Places photos with owner-provided, generated, or otherwise owned assets before long-term hosting.

Owner-photo note:
- Places API exposes photo references and attribution metadata, but it does not expose a reliable first-party flag such as `isOwnerPhoto`.
- WebView.click therefore uses a best-effort priority in CRM: photos whose attribution/display name resembles the business name first, photos without exposed attribution second, and clearly attributed UGC third.
- Truly verified owner media would require access through Google Business Profile style owner/manager APIs or direct files from the business owner.
- Store/display `brand.photoAttributions` whenever a Google Places photo is used in preview or generated JSON, because attribution obligations still apply.

Policy note:
- If displaying Google photos, show required attributions.
- For client websites, prefer generating/replacing assets or getting owner-provided images instead of permanently rehosting Google photos.
- See `docs/GOOGLE_PLACES_PHOTO_STRATEGY.md` for the current free-vs-paid image handling rule.

### Pricing and Business Model Fields

Useful fields:
- `priceLevel`.
- `priceRange`.
- `paymentOptions`.

Use in WebView.click:
- Service/menu pricing cues.
- "Affordable/premium/local favorite" positioning.
- Payment badges, if reliable.
- Avoid inventing exact prices unless source data provides them.

### Service and Amenity Flags

Food/restaurant flags:
- `takeout`, `delivery`, `dineIn`, `curbsidePickup`, `reservable`.
- `servesBreakfast`, `servesLunch`, `servesDinner`, `servesBrunch`.
- `servesBeer`, `servesWine`, `servesCocktails`, `servesCoffee`, `servesDessert`, `servesVegetarianFood`.
- `menuForChildren`.

General amenity flags:
- `outdoorSeating`.
- `liveMusic`.
- `goodForChildren`.
- `goodForGroups`.
- `goodForWatchingSports`.
- `allowsDogs`.
- `restroom`.

Use in WebView.click:
- Auto-generate features/amenities section.
- Render icon grid.
- Create richer copy that is grounded in available data.
- Select niche-specific modules: restaurant menu, contractor services, cafe amenities, family-friendly block, etc.

### Accessibility

Useful fields:
- `accessibilityOptions`.

Use in WebView.click:
- Accessibility section or feature badges.
- Important for public-facing business websites.

### Industry-Specific Fields

Transport/energy:
- `fuelOptions`.
- `evChargeOptions`.
- `evChargeAmenitySummary`.

Use in WebView.click:
- Only render for gas stations, EV charging, convenience stores, etc.

Containment/location context:
- `containingPlaces`.
- `subDestinations`.
- `neighborhoodSummary`.

Use in WebView.click:
- "Located inside..." or "Nearby..." context.
- Useful for mall locations, complexes, airports, or tourist/business districts.

### AI-Generated Google Fields

Useful fields:
- `generativeSummary`.
- `reviewSummary`.
- `neighborhoodSummary`.
- `evChargeAmenitySummary`.

Use in WebView.click:
- Use as admin reference or copywriting input.
- Do not blindly rewrite Google-provided editorial text if policy requires exact presentation.
- Mark as premium/costlier fields because they are in higher pricing tiers.

## Recommended CRM Lead Schema Additions

Current `leads` table should eventually store:
- `google_place_id`
- `google_resource_name`
- `business_name`
- `primary_type`
- `types_json`
- `formatted_address`
- `short_formatted_address`
- `city`
- `state`
- `postal_code`
- `country`
- `latitude`
- `longitude`
- `national_phone_number`
- `international_phone_number`
- `google_maps_uri`
- `website_uri`
- `has_website` boolean
- `business_status`
- `pure_service_area_business`
- `rating`
- `user_rating_count`
- `price_level`
- `price_range_json`
- `regular_opening_hours_json`
- `photos_json`
- `reviews_json`
- `amenities_json`
- `place_details_json` for raw structured snapshot
- `google_attributions_json`
- `last_google_sync_at`

For the dashboard:
- Add badges: `No Website`, `Has Phone`, `Service Area`, `High Rating`, `Many Reviews`, `Operational`, `Closed`.
- Add sort/filter:
  - No website first.
  - Operational only.
  - Has phone.
  - Min rating.
  - Min review count.
  - Service-area businesses.
  - Business type.

## Suggested Field Masks

### Cheap Search List Mask

Use for initial search list:

```text
places.id,
places.name,
places.displayName,
places.primaryType,
places.primaryTypeDisplayName,
places.types,
places.formattedAddress,
places.shortFormattedAddress,
places.businessStatus,
places.websiteUri,
places.nationalPhoneNumber,
places.internationalPhoneNumber,
places.rating,
places.userRatingCount,
places.photos,
places.googleMapsUri,
places.pureServiceAreaBusiness,
nextPageToken,
searchUri
```

This is enough to identify no-website leads and show a usable CRM list.

### Rich Details Mask for Selected Lead

Use after admin clicks or before generate:

```text
id,
name,
displayName,
types,
primaryType,
primaryTypeDisplayName,
googleMapsTypeLabel,
nationalPhoneNumber,
internationalPhoneNumber,
formattedAddress,
shortFormattedAddress,
postalAddress,
addressComponents,
location,
viewport,
rating,
userRatingCount,
googleMapsUri,
websiteUri,
reviews,
regularOpeningHours,
currentOpeningHours,
regularSecondaryOpeningHours,
currentSecondaryOpeningHours,
photos,
businessStatus,
openingDate,
priceLevel,
priceRange,
paymentOptions,
parkingOptions,
editorialSummary,
generativeSummary,
reviewSummary,
neighborhoodSummary,
takeout,
delivery,
dineIn,
curbsidePickup,
reservable,
servesBreakfast,
servesLunch,
servesDinner,
servesBeer,
servesWine,
servesBrunch,
servesVegetarianFood,
outdoorSeating,
liveMusic,
menuForChildren,
servesCocktails,
servesDessert,
servesCoffee,
goodForChildren,
allowsDogs,
restroom,
goodForGroups,
accessibilityOptions,
pureServiceAreaBusiness,
attributions
```

This is richer and may cost more. Use only for selected leads.

## How Places Data Maps to Website Sections

| Google field(s) | Site builder use |
| --- | --- |
| `displayName`, `primaryType`, `formattedAddress` | Hero headline/subheadline, SEO title |
| `websiteUri` missing | Lead badge and sales positioning |
| `nationalPhoneNumber`, `internationalPhoneNumber` | Header CTA, contact block, sticky call button |
| `rating`, `userRatingCount`, `reviews` | Social proof/testimonials |
| `photos` | Hero image, gallery, palette extraction, brand mood |
| `regularOpeningHours`, `currentOpeningHours` | Hours section |
| `types`, `primaryType`, amenity booleans | Feature cards and industry-specific modules |
| `takeout`, `delivery`, `dineIn`, etc. | Restaurant/cafe services |
| `paymentOptions`, `parkingOptions`, `accessibilityOptions` | FAQ/amenity details |
| `googleMapsUri`, `location` | Map/directions block |
| `reviewSummary`, `generativeSummary` | Copywriting input and admin preview |
| `pureServiceAreaBusiness` | Service-area landing page copy instead of storefront copy |

## Implementation Priority

1. Migrate search endpoint from legacy Text Search to Places API (New) `places:searchText`.
2. Add field masks and return normalized lead fields.
3. Add dashboard filters/sort:
   - No website only.
   - Operational only.
   - Has phone.
   - Minimum rating/review count.
4. Add Place Details fetch before site generation.
5. Store raw details snapshot and structured normalized fields.
6. Update JSON generator prompt to explicitly use Places fields as source-of-truth.
7. Add attribution handling for photos/reviews if rendered.

## Compliance Notes

Google Places content is not the same as first-party owned content. Before storing, displaying, or rehosting photos/reviews/details long-term, review Google Maps Platform policies:
- Apps must include Terms of Use and Privacy Policy incorporating Google terms/privacy.
- Required attributions must be displayed where Google content is displayed.
- Avoid bulk downloading, prefetching, or permanently treating Google content as owned content.

For WebView.click, safest production approach:
- Use Places data for lead discovery and draft generation.
- Store Place IDs and normalized lead metadata needed for CRM.
- Prefer owner-provided or AI-generated assets for final client sites.
- If Google photos/reviews are displayed, retain and display attribution.
