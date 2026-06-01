# Admin Leads US Local Prospecting Plan

Purpose: make `/admin/leads` a fast workflow for finding US local businesses that likely need a website, are still owner-involved, and can value a free personalized site enough to respond.

## Target Profile

Best-fit businesses:
- Local service businesses with visible buyer intent.
- Owner-operated or small teams where the phone likely reaches the owner, manager, estimator, or dispatcher.
- Established enough to have reviews, photos, and active operations.
- Not so large that all inbound communication goes through corporate staff.
- No website, broken website, weak landing page, or Facebook-only presence.

Avoid or deprioritize:
- National chains, franchises, and multi-location brands with corporate marketing.
- Businesses with very polished sites and dedicated marketing teams.
- Hospitals, large clinics, banks, big law firms, government offices.
- Listings with no phone, no reviews, or unclear business identity unless the niche is high value.

## High-Value Niches

Primary owner-operated service niches:
- Concrete contractor
- Ready mix concrete
- Asphalt paving
- Excavation contractor
- Demolition contractor
- Septic service
- Tree service
- Roofing contractor
- Fence contractor
- Garage door repair
- HVAC contractor
- Plumbing contractor
- Electrician
- Foundation repair
- Pool repair
- Pressure washing
- Landscaping
- Lawn care
- Irrigation repair
- Pest control
- Appliance repair
- Mobile mechanic
- Auto glass repair
- Towing service
- Locksmith
- Security camera installer
- Commercial cleaning
- Junk removal
- Dumpster rental
- Moving company
- Painting contractor
- Flooring contractor
- Cabinet maker
- Countertop installer

Secondary local-business niches:
- Dental clinic with weak web presence
- Med spa
- Massage therapy
- Physical therapy clinic
- Chiropractic office
- Barber shop
- Hair salon
- Pet grooming
- Dog training
- Wedding photographer
- Event rental
- Catering
- Food truck
- Local restaurant with no site

## Search Query Pattern

Use specific niche + city + state:
- `concrete contractor Tulsa OK`
- `tree service Greenville SC`
- `pool repair Phoenix AZ`
- `garage door repair Fort Worth TX`
- `septic service Ocala FL`
- `fence contractor Knoxville TN`

Use modifiers when a niche is too broad:
- `residential`
- `emergency`
- `near me` only when testing city-level behavior
- `contractor`
- `repair`
- `service`
- `installer`

Do not put `no website` in the Google Places query. Let the app gather/check website status.

## State And City Checklist

Track each niche/city pass with: searched, gathered, generated, outreach sent, follow-up due, skipped. The app uses curated starter data in:

- `src/data/usLocalProspectingMarkets.json`
- `src/data/usLocalProspectingNiches.json`

External dataset candidates for a later full import:

- `countries-states-cities-database` for broad country/state/city JSON.
- `US-states-and-cities-json` for a compact US-only state/city map.
- `US-Cities-Database` for SQL city/state/county/lat/lon data.

Texas:
- [ ] Dallas
- [ ] Fort Worth
- [ ] Arlington
- [ ] Plano
- [ ] Frisco
- [ ] McKinney
- [ ] Austin
- [ ] San Antonio
- [ ] Houston suburbs
- [ ] Waco
- [ ] Lubbock

Florida:
- [ ] Tampa
- [ ] Orlando
- [ ] Jacksonville
- [ ] St. Petersburg
- [ ] Sarasota
- [ ] Lakeland
- [ ] Ocala
- [ ] Fort Myers
- [ ] Cape Coral
- [ ] Pensacola

Arizona:
- [ ] Phoenix
- [ ] Mesa
- [ ] Chandler
- [ ] Gilbert
- [ ] Glendale
- [ ] Scottsdale
- [ ] Tucson

North Carolina:
- [ ] Charlotte
- [ ] Raleigh
- [ ] Durham
- [ ] Greensboro
- [ ] Winston-Salem
- [ ] Fayetteville
- [ ] Asheville

South Carolina:
- [ ] Greenville
- [ ] Spartanburg
- [ ] Columbia
- [ ] Charleston
- [ ] Myrtle Beach

Tennessee:
- [ ] Nashville
- [ ] Knoxville
- [ ] Chattanooga
- [ ] Murfreesboro
- [ ] Clarksville

Georgia:
- [ ] Atlanta suburbs
- [ ] Marietta
- [ ] Alpharetta
- [ ] Savannah
- [ ] Augusta
- [ ] Macon

Ohio:
- [ ] Columbus
- [ ] Cincinnati
- [ ] Cleveland suburbs
- [ ] Dayton
- [ ] Akron
- [ ] Toledo

Pennsylvania:
- [ ] Pittsburgh suburbs
- [ ] Philadelphia suburbs
- [ ] Allentown
- [ ] Lancaster
- [ ] Harrisburg
- [ ] Scranton

Missouri / Kansas:
- [ ] Kansas City
- [ ] St. Louis suburbs
- [ ] Springfield MO
- [ ] Wichita
- [ ] Overland Park

Colorado:
- [ ] Denver suburbs
- [ ] Colorado Springs
- [ ] Aurora
- [ ] Fort Collins
- [ ] Pueblo

## Daily Workflow

1. Pick one state and 3-5 cities.
2. Pick 3-5 niches for that pass.
3. Search niche + city + state.
4. Filter for no website / active pipeline.
5. Gather Google details for promising rows.
6. Skip chains, obvious corporate listings, bad data, and weak prospects.
7. Generate the site for high-fit rows.
8. Open generated site briefly to verify it is not broken.
9. Copy owner outreach template from `/admin/sites`.
10. Track contacted and follow-up filters.
11. After 2-3 days, follow up if contacted but not viewed/downloaded/paid.

## Lead Scoring Heuristics

Good signals:
- 10-150 reviews.
- Rating 4.2+.
- Real phone number.
- Photos exist.
- Address/service area is local.
- Business name sounds local, not corporate.
- Services are high-value or urgent.
- No website or weak web presence.

Warning signals:
- Too many locations.
- Phone routes to call center.
- Very generic business name.
- No photos and no reviews.
- Listing looks like spam.
- Website already looks strong.

## `/admin/leads` Improvement Ideas

Search productivity:
- Add saved query templates by niche.
- Add state/city checklist panel with progress counters.
- Add "next city" queue so admin can run a planned route.
- Add one-click search chips: niche + selected city/state.
- Add separate "owner-operated likely" score.
- Add "chain/franchise suspected" warning based on name/location count.

Prospect triage:
- Add compact decision buttons: gather, generate, skip, maybe later.
- Add skip reason menu: chain, has good site, bad data, not local, too big, low value.
- Add "phone available" and "no website confirmed" as strong visible badges.
- Add "call center risk" indicator for toll-free numbers or corporate-looking names.

Batch speed:
- Add batch gather for filtered visible rows, capped and sequential.
- Add batch generate for selected high-fit rows, already cooldown-aware.
- Add progress by query: searched, gathered, generated, contacted.
- Add hotkeys for skip/gather/generate on selected row.

Outreach readiness:
- Show whether owner review link, email, phone, and template are ready.
- Add bulk "copy next outreach" queue for rows with generated sites.
- Backfill phone/email from generated JSON and Google source where possible.

Follow-up:
- Add city/niche filters in CRM follow-up queues.
- Add follow-up due count by original search query.
- Add "Downloaded but not setup" warm queue with setup template.

## Progress Tracker Template

Use this table per prospecting sprint.

| Date | State | City | Niche | Query | Searched | Gathered | Generated | Contacted | Follow-up due | Notes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| 2026-06-01 | TX | Dallas | Concrete contractor | concrete contractor Dallas TX | 0 | 0 | 0 | 0 | 0 |  |

## Immediate Next Build Priorities

- [x] Add state/city checklist data model in localStorage first.
- [x] Add query template chips for target niches.
- [ ] Add city progress counters from existing prospects/leads.
- [ ] Add skip reason capture.
- [ ] Add owner-operated likelihood score.
- [ ] Add batch gather for filtered visible rows.
- [ ] Add one-click "next route" from selected state/city/niche.
