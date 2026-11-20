# 🗺️ Master CLI Operational Guide: SMB Site Generation & Outreach Engine

**Target:** Scale to 1,000 SMB contacts at a sustainable, ban-proof pace of **15 contacts / day**.  
**Dedicated Headless Staging:** `https://wpwv.codev.id` (OracleServer `codev-wpwv`)  
**Live Edge House:** `https://sites.webview.click` (Cloudflare Worker + R2)  
**Edge ZIP Magic:** Zero duplicate ZIP uploads — `sites.webview.click/<slug>/download` generates streaming ZIPs on the fly via `client-zip`!  
**Contact Tooling:** `gog.exe` (Go static binary at `C:\Users\THINKPAD\scripts\gog.exe`).  
**Core Invariant (JIT Generation):** Sites are generated **ONLY upon human reply to the initial identity check** — zero compute/storage wasted on unresponsive numbers!  
**SOP & Policy Authority:** [`SOP.md`](file:///C:/Users/THINKPAD/WebView.click/SOP.md) | City DB: [`data/cities.json`](file:///C:/Users/THINKPAD/WebView.click/data/cities.json) | Niche DB: [`data/smb_niches.json`](file:///C:/Users/THINKPAD/WebView.click/data/smb_niches.json)

---

## 📋 Interactive Progress Tracker

- [x] **Phase 1: Cloudflare Edge Infrastructure Setup (`sites.webview.click`)**
  - [x] 1.1 Create Cloudflare R2 bucket `webview-sites`
  - [x] 1.2 Configure R2 CORS policy
  - [x] 1.3 Deploy Cloudflare Worker Router `sites-webview-click` (with dynamic streaming ZIP)
  - [x] 1.4 Verify edge routing & test 404 response
- [x] **Phase 2: Prospect Data Ingestion & Google Contacts Trust Pre-Save**
  - [x] 2.1 Filter high-income cities (`data/cities.json`) and high-ticket niches (`data/smb_niches.json`)
  - [x] 2.2 Harvest candidates and review no-site or unavailable-site eligibility
  - [x] 2.3 Validate E.164 phone numbers & review ratings (≥ 4.0)
  - [x] 2.4 Pre-save prospects to Google Contacts via `gog contacts create` (`[SMB] <Name>`)
  - [x] 2.5 Authenticate `gog.exe` with `admin@alampintar.org` & activate People API (Project `150697655157`)
- [ ] **Phase 3: Stage 1 Outreach — Casual Identity Confirmation (15 Contacts / Day)**
  - [ ] 3.1 Stage daily queue (15 contacts with 300–480s jitter)
  - [ ] 3.2 Dispatch Step 1 strictly asking business identity: *"Hi, is this [Business Name]?"*
  - [ ] 3.3 Await human confirmation (unresponsive contacts expire with 0 wasted generation)
- [ ] **Phase 4: Just-In-Time (JIT) Site Generation (Triggered On Human Reply)**
  - [ ] 4.1 On human confirmation, execute brand enrichment & palette synthesis (`scripts/enrich-business-brand.py`)
  - [ ] 4.2 Provision headless staging on `wpwv.codev.id` through the WebView planner
  - [ ] 4.3 Export flat static files through the Simply Static Free API
  - [ ] 4.4 Push static assets once to `r2://webview-sites/sites/<slug>/`
  - [ ] 4.5 Capture full-page mobile mockup (`mockups/<slug>-mobile.jpg`)
- [ ] **Phase 5: Stage 2 Value Gift Drop & Conversion**
  - [ ] 5.1 Dispatch Step 2: Value gift drop with photo attachment, preview link, and direct ZIP link
  - [ ] 5.2 Respect instant opt-out (`STOP`) to maintain 100% compliance
  - [ ] 5.3 Handle inbound inquiries & done-for-you custom hosting upsells

---

## 🚀 Step-by-Step CLI Execution Runbook

### 1️⃣ Phase 1: Setup Cloudflare Edge Infrastructure (`sites.webview.click`)

The production Worker `sites-webview-click` serves `sites.webview.click` from the private `webview-sites` R2 bucket. Use the Cloudflare account that owns the apex Pages project (account ID `5076c806dec2b4df072e537f1a09500c`). The workstation’s named `cf` profile is `webview`.

#### 1.1 Inspect the account and bucket
```powershell
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
$env:CLOUDFLARE_ACCOUNT_ID = '5076c806dec2b4df072e537f1a09500c'
cf.cmd --profile webview zones list --name webview.click
cf.cmd --profile webview r2 buckets get webview-sites
```

The bucket uses Standard storage in APAC. The active CORS policy matches `cloudflare/r2-cors-webview.json`. Use `cf r2 buckets cors update` if that policy changes.

#### 1.2 Deploy and verify the Worker

Use Wrangler from `cloudflare/sites-worker` with an authenticated session for the account above. The named `cf` profile and Wrangler have separate credential stores. The OneDrive WebView runbook documents how to pass the profile’s current credential directly to the Wrangler child process.

```powershell
Set-Location cloudflare\sites-worker
pnpm exec tsc --noEmit
pnpm exec wrangler deploy
Set-Location ..\..
python scripts\check-sites-edge.py
```

---

### 2️⃣ Phase 2: Prospect Ingestion & Google Contacts Pre-Save

Check the individual Google Maps profile, including its Services link, and search independently for a working official website. Use `--include-listed-websites` to collect candidates for separate availability review. Run `python scripts/compile-smb-site.py <reviewed-brief.json> --verify-website` before queueing a qualified lead. For an unavailable site, use the actual URL, recent listing evidence and an independent replacement search. Describe it as unavailable when checked.

> **Strategic Directive:** Target **Tier 1 High-Income Economies** with >75%–95% WhatsApp adoption (Singapore, UAE, UK, Ireland, Netherlands). Full market comparison & rationale: [`KNOWLEDGE-HIGH-INCOME-WHATSAPP-SMB-TARGETING.md`](file:///C:/Users/THINKPAD/OneDrive/MD/KNOWLEDGE/KNOWLEDGE-HIGH-INCOME-WHATSAPP-SMB-TARGETING.md).

#### 2.1 Harvest High-Potential Leads via CLI

**Option A (Direct Headless Google Maps Scraper — Zero API Keys Required):**
```powershell
cd C:\Users\THINKPAD\WebView.click
# High-Income Targets: Singapore, Dubai/UAE, UK, Ireland
python scripts\scrape-maps-direct.py --query "aircon servicing singapore" --out prospects-today.json --limit 15
# Or: "car detailing dubai", "plumber manchester", "emergency electrician birmingham"
```

**Option B (Serper / Google Places API):**
```powershell
cd C:\Users\THINKPAD\WebView.click
node scripts\harvest-prospects.mjs --query "aircon servicing singapore" --out prospects-today.json --limit 15
```

#### 2.2 Authenticate `gog.exe` for `admin@alampintar.org` (One-Time Setup — Completed)
```powershell
# Set credentials from Google Cloud Desktop App JSON
gog auth credentials set C:\Users\THINKPAD\.config\gdocs\client_secret.json

# Authenticate contacts & people scopes directly
gog auth add admin@alampintar.org --services=contacts,people
```

#### 2.3 Brand & Media Enrichment (Palette + Transparent Logo)
```powershell
python scripts\enrich-business-brand.py `
  --prospect prospects-today.json `
  --photos-dir "assets\prospects\bengkel-jaya-motor\photos" `
  --out-palette "palette.json" `
  --out-prospect "prospects-enriched.json"
```

#### 2.4 Sync Prospects to Google Contacts
```powershell
# Option A: Direct gog.exe command
gog contacts create --account admin@alampintar.org --given-name "Bengkel Jaya Motor" --family-name "[SMB]" --phone "+6281234567890" --org "Bengkel Jaya Motor"

# Option B: Batch script
node scripts\sync-google-contacts.mjs --input prospects-today.json --vcf contacts-today.vcf
```

---

### 3️⃣ Phase 3: Dedicated Headless WordPress Staging (`wpwv.codev.id`)

Generate on the dedicated Astra staging tenant from a reviewed brief. The compiler defaults to the niche-matched Elementor route and validates the original WXR. Set `"builder": "gutenberg"` to use a qualified Gutenberg layout. The Elementor path requires its plugin active on this tenant.

```powershell
powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-smb-pipeline.ps1 -ProspectFile .\prospect-brief.json -Limit 1 -StageOnly
```

Supply a name, address, locality, E.164 phone, locale, tagline, footer, niche or category, sourced offerings, page copy, and a cleared JPEG with caption, alt text, dimensions and attribution. Add `guidance` evidence rows with `source` and `text` for each offering. Include concrete local use cases and typical procedures from credible sources. The local heading uses `locality`.

Run `scripts/draft-smb-service.py <brief> <service-slug> <new-draft.json> --oracle-runner <Invoke-OracleSsh.ps1>` to create the complete copy. It retains successful parts alongside the draft, so retry the same unfinished output to resume. Review the assembled file and mark `reviewed: true` only after approval. Reference it through `offerings[].reviewed_draft`. The compiler rejects stale brief or locality context. Existing briefs can also supply explicitly approved `offerings[].detail` with `what`, `why`, `included`, `when`, `deferral`, `how`, `who` and two to four FAQ pairs. Optional `-TemplateManifest` and `-TemplateCache` inputs support exact reproduction.

In `business_profile`, use `listing_url` for the individually confirmed Maps profile and `map_embed_url` from Google Maps Share → Embed a map. With `details`, group reviewed facts under `hours`, `special_hours`, `accessibility`, `offerings`, `amenities`, `planning`, `payments` or `parking`. Each row has `text`, `source` from the brief's source list, and `confirmed_for_export: true`. An optional `gallery` contains cleared originals. An optional `video` contains `youtube_id`, `title` and `publisher_confirmed: true` for an embeddable business-published video. Google listing photos, videos and reviews open at the listing rather than being copied into the static files.

Gallery uses cleared business photos, embeds and verified listing links. Include cleared owner photos already assigned to page heroes with `gallery.show_service_photos`. Illustration assets stay outside Gallery. A Google Maps photo link is the staging fallback until an owner original or supported display is available. A business can reuse its own original photos after uploading them to Maps. Verify who supplied the file and use the client original, since the public listing also contains customer submissions. For `gallery.reviews`, the compiler displays the three highest-rated distinct entries. A Google review share card uses `origin: public_link`, `reviewer`, `rating`, `source` from the review’s Share action, and `source_label`. For a verified short excerpt, set `excerpt` and `excerpt_verified: true`. The renderer appends an ellipsis and links to the full original review. Existing `summary` briefs remain supported. Home and Services show text-bearing testimonials in the demo's native Elementor positions before the booking action. For cleared review text, use `origin: first_party`, `redistribution_allowed: true`, `text`, and an optional cleared `avatar`. This workflow requires no live review widget or API credential.

Both builders add labeled visual cues and footer links to generated Privacy Policy and Terms of Use pages. Review these starting templates against the business’s data handling and booking practices before launch. To add a static language, collect the text after a fresh export with `python scripts/localize-smb-export.py <export-dir> --collect <source.json>`. Supply a complete reviewed `text` mapping and `tag`, `direction`, `label`, and `source_label`. Rebuild with `-LocalizationFile <catalog.json>`, or run `python scripts/localize-smb-export.py <export-dir> --catalog <catalog.json>` against the same untouched export. The switch points to equivalent routes. Assets are shared.

The writer uses the compiled plan and exports it through Simply Static Free. In `-StageOnly`, review the unique printed `Static artifact` directory. Test all pages, images, navigation, and call or directions links on mobile. The static bundle expects the original `/<slug>/` hosting prefix.

---

### 4️⃣ Phase 4: Single R2 Upload & Mobile Mockup

The production recovery on 2026-11-19 replaced HTTP 522 with a redirect from `https://sites.webview.click/` to `https://webview.click/`. Run `python scripts\check-sites-edge.py` to reverify the hosted fixture and its ZIP. Generated WordPress exports use `/<slug>/` as their hosting prefix.

#### 4.1 Sync Static Assets to Cloudflare R2
```powershell
# Use a reviewed brief and an affirmative reply before publishing.
.\scripts\run-smb-pipeline.ps1 -ProspectFile .\reviewed-prospect.json -Limit 1
```
*Live Links:*
- Preview: `https://sites.webview.click/bengkel-jaya-motor-malang/`
- Download: `https://sites.webview.click/bengkel-jaya-motor-malang/download` *(Generated on the fly by Cloudflare Worker!)*

#### 4.2 Capture High-Impact Mobile Screenshot
```powershell
python scripts\capture-screenshot.py `
  --url "https://sites.webview.click/$Slug/" `
  --output "mockups\$Slug-mobile.jpg"
```

---

### 5️⃣ Phase 5: The 2-Step Value-First WhatsApp Outreach

#### 🛡️ Anti-Spam Safety Rules
1. **Pacing:** Strictly **15 contacts / day**.
2. **Jitter:** Wait **180–480 seconds** (3 to 8 minutes) between sending initial messages.
3. **No Raw Link in Message 1:** Sending a link in the very first message to an unknown number is the fastest way to get your account flagged.
4. **Confident Voice:** Zero apologetic language (*"maaf ganggu"*). Lead with generosity and tangible value.

---

#### 💬 Script Step 1: Casual Confirmation Icebreaker
Sent by LusmoBot:

**English (Tier 1 High-Income: Singapore, UAE, UK, Ireland):**
> *"Hi, is this [Business Name]?"*

**Indonesian (Domestic Legacy):**
> *"Halo, apakah ini dengan [Nama Bisnis]?"*

*(LusmoBot pauses and awaits human reply).*

---

#### 💬 Script Step 2: Value Drop & Demo Link (Post-Confirmation)
Triggered immediately after they reply (e.g., *"Yes it is, how can I help?"*):

Use the sample wording when the business has no official site. For an unavailable site, say “I tried the website linked from your Google listing, and it was unavailable when I checked.” In Indonesian, say “Saya sempat mencoba membuka situs dari profil Google bisnis Anda, tetapi saat saya cek situsnya tidak bisa dibuka.”

*(Attach: `mockups/[slug]-mobile.jpg`)*

**English (Tier 1 High-Income Standard):**
> *"Hey [Business Name/Owner], I'm Syamsul Alam.*
>
> *This might sound unconventional, but I was looking up your Google listing yesterday and noticed you don't have a website set up.*
>
> *I went ahead and designed a clean, mobile-responsive website for your business today:*  
> 🔗 `https://sites.webview.click/[slug]/`
>
> *I've also attached a full-page mobile preview above so you can see how it looks.*
>
> *It's 100% yours for free — no strings attached. You can download the complete static site files right here to host wherever you like:*  
> 📦 `https://sites.webview.click/[slug]/download`
>
> *If you're not technical and would like me to connect a custom domain or host it for you, just let me know. Either way, hope it helps your business!*
>
> *(If you prefer not to hear from me again, simply reply 'STOP' and I will not contact you again.)"*

**Indonesian (Domestic Legacy):**
> *"Saya Syamsul Alam. Mungkin kedengaran aneh karena kita belum kenal, tapi kemarin saya cek Google Business nya saya lihat belum punya website resmi, jadi saya buatkan website untuk bisnisnya.*
>
> *Tampilannya seperti di foto ini, bisa dicek langsung di sini:*  
> 🔗 `https://sites.webview.click/[slug]/`
>
> *Ini 100% gratis buat kalian, silakan dipakai atau di-download file aslinya kalau mau di-hosting sendiri:*  
> 📦 `https://sites.webview.click/[slug]/download`
>
> *Kalau sekiranya kalian repot atau butuh bantuan pasangkan domain dan hostingnya, kabari saja ya."*

---

### ⚡ One-Line Automated CLI Execution

To run the entire pipeline for a batch of 15 prospects with a single command:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\run-smb-pipeline.ps1 `
  -ProspectFile prospects-today.json `
  -Limit 15
```
