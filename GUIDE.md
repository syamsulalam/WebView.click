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
  - [x] 2.2 Harvest no-website prospects via `scripts/scrape-maps-direct.py` (SG, UAE, UK, IE)
  - [x] 2.3 Validate E.164 phone numbers & review ratings (≥ 4.0)
  - [x] 2.4 Pre-save prospects to Google Contacts via `gog contacts create` (`[SMB] <Name>`)
  - [x] 2.5 Authenticate `gog.exe` with `admin@alampintar.org` & activate People API (Project `150697655157`)
- [ ] **Phase 3: Stage 1 Outreach — Casual Identity Confirmation (15 Contacts / Day)**
  - [ ] 3.1 Stage daily queue (15 contacts with 300–480s jitter)
  - [ ] 3.2 Dispatch Step 1 strictly asking business identity: *"Hi, is this [Business Name]?"*
  - [ ] 3.3 Await human confirmation (unresponsive contacts expire with 0 wasted generation)
- [ ] **Phase 4: Just-In-Time (JIT) Site Generation (Triggered On Human Reply)**
  - [ ] 4.1 On human confirmation, execute brand enrichment & palette synthesis (`scripts/enrich-business-brand.py`)
  - [ ] 4.2 Auto-provision headless staging on `wpwv.codev.id` (`wp st-companion create`)
  - [ ] 4.3 Export flat static site via Simply Static (`wp simply-static run`)
  - [ ] 4.4 Push static assets once to `r2://webview-sites/sites/<slug>/`
  - [ ] 4.5 Capture full-page mobile mockup (`mockups/<slug>-mobile.jpg`)
- [ ] **Phase 5: Stage 2 Value Gift Drop & Conversion**
  - [ ] 5.1 Dispatch Step 2: Value gift drop with photo attachment, preview link, and direct ZIP link
  - [ ] 5.2 Respect instant opt-out (`STOP`) to maintain 100% compliance
  - [ ] 5.3 Handle inbound inquiries & done-for-you custom hosting upsells

---

## 🚀 Step-by-Step CLI Execution Runbook

### 1️⃣ Phase 1: Setup Cloudflare Edge Infrastructure (`sites.webview.click`)

The Cloudflare Worker router serves static sites directly from R2, handles directory indexes (`index.html`), cleans URLs, sets edge caching, and **streams ZIP downloads dynamically on the fly**.

#### 1.1 Create R2 Bucket
```powershell
cf.cmd r2 buckets create webview-sites --location-hint apac
```

#### 1.2 Apply CORS Configuration
```powershell
cd C:\Users\THINKPAD\WebView.click
cf.cmd r2 buckets cors set webview-sites --file cloudflare/r2-cors-webview.json
```

#### 1.3 Deploy the Worker Router
```powershell
cd C:\Users\THINKPAD\WebView.click\cloudflare\sites-worker
pnpm exec wrangler deploy
```

---

### 2️⃣ Phase 2: Prospect Ingestion & Google Contacts Pre-Save

Saving the contact to your Google Account as `[SMB] <Business Name>` causes your phone's address book to sync. When WhatsApp initiates the chat, Meta treats it as a message to an existing address-book contact rather than cold outbound spam.

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

Generate a designer-grade multi-page site on `wpwv.codev.id` using Astra + Spectra Starter Templates, injecting frozen Google Business facts with strict 9-slot palette and transparent logo.

```powershell
$Name = "Wijaya Motor Kampung Malang"
$Slug = "wijaya-motor-kampung-malang"
$Path = "/home/codev-wpwv/htdocs/wpwv.codev.id"

# 1. Scaffolding via Starter Templates Companion with custom palette & zero cubicle leaks
powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Users\THINKPAD\OneDrive\MD\SCRIPTS\Invoke-OracleSsh.ps1" `
  -Command "sudo -u codev-wpwv wp --path=$Path st-companion create --title='$Name' --business-name='$Name' --industry='automotive' --phone='+6281331029864' --domain='$Slug.webview.click' --palette=navy --clean --yes --format=json"

# 2. Export flat static HTML/CSS/JS via Simply Static
powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Users\THINKPAD\OneDrive\MD\SCRIPTS\Invoke-OracleSsh.ps1" `
  -Command "sudo -u codev-wpwv wp --path=$Path simply-static run && sudo -u codev-wpwv bash -c 'cd /home/codev-wpwv/static-export/ && zip -rq /tmp/$Slug.zip .'"
```

---

### 4️⃣ Phase 4: Single R2 Upload & Mobile Mockup

#### 4.1 Sync Static Assets to Cloudflare R2
```powershell
# Download export from OracleServer
scp -i "C:\Users\THINKPAD\.ssh\ssh-key-2025-10-13.key" "ubuntu@150.136.178.5:/tmp/$Slug.zip" "dist-staging\"
Expand-Archive -Path "dist-staging\$Slug.zip" -DestinationPath "dist-staging\$Slug" -Force

# Upload ONLY the static folder (Zero separate ZIP upload needed!)
node scripts\deploy-site-to-r2.mjs --dir "dist-staging\$Slug" --slug "$Slug" --bucket "webview-sites"
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
