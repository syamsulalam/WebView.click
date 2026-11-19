# 📜 Standard Operating Procedure (SOP): Autonomous Global SMB Outreach Engine

**Document:** `SOP.md`  
**Target Architecture:** `WebView.click` (`smb-site-outreach`, `sites.webview.click`, `wpwv.codev.id`)  
**Pacing:** Strictly **15 contacts / day** (300–480s jitter)  
**Target Audience:** Tier 1 High-Income Economies (Singapore, UAE, UK, Ireland, Netherlands)  
**Governing Authority:** Syamsul Alam Directive (2026-11-18)

---

## ⚡ The 3 Golden Invariants (NEVER VIOLATE)

### 🥇 Invariant 1: First Contact Rule (Identity Inquiry Only)
The **very first message** sent to any prospect MUST strictly be a 6-word business identity confirmation:
> **English (Tier 1 Default):** *"Hi, is this [Business Name]?"*  
> **Indonesian (Legacy Domestic):** *"Halo, apakah ini dengan [Nama Bisnis]?"*

- ❌ **NEVER** send a pitch, sales copy, portfolio link, pricing, website link, or mockup in Message 1.
- ❌ **NEVER** use apologetic language (*"Sorry to bother you"* / *"Maaf mengganggu"*).
- ❌ **NEVER** assume they are the owner before they confirm.
- ✅ **ALWAYS** wait for their natural human reply before taking any further action.

---

### 🥈 Invariant 2: Just-In-Time (JIT) Generation on Human Reply
**Zero websites are generated upfront.**
- 🛑 **Do NOT** generate a WordPress site, run Simply Static, or upload to R2 for an uncontacted or unresponsive number.
- 🕒 If a prospect does not reply within 48 hours, they simply expire from the queue. **Zero compute, disk, or bandwidth is wasted.**
- 🚀 **ONLY upon receiving an affirmative human reply** (e.g., *"Yes it is, how can I help?"* or *"Yes, who's this?"*) does the system trigger the automated generation pipeline:
  1. Prepare a reviewed prospect brief with evidence and an approved photo. Use brand enrichment as input to the design review.
  2. Run `run-smb-pipeline.ps1 -StageOnly` for `wpwv.codev.id`. It resolves the niche against the Companion catalog and requires a reviewed template mapping.
  3. Review all pages in the isolated Simply Static artifact. Confirm business facts, mobile layout and contact actions before proceeding.
  4. `deploy-site-to-r2.mjs`: Sync static assets once to `r2://webview-sites/sites/<slug>/`.
  5. `capture-screenshot.py`: Capture high-resolution mobile mockup.
  6. Dispatch Step 2 after the live preview and mobile mockup are ready. A failed build or upload stops delivery.

For infrastructure verification, run `python scripts/check-sites-edge.py` against the synthetic fixture. It exercises the public preview and ZIP without submitting a prospect or sending outreach.

---

### 🥉 Invariant 3: Confident Value-First Gift Framing + Clean Opt-Out
When delivering the completed website in Step 2:
- Frame it as a **completed gift**, not a sales pitch.
- Provide the live preview (`sites.webview.click/<slug>/`) AND the direct dynamic ZIP download link (`sites.webview.click/<slug>/download`).
- Provide an effortless, friction-free opt-out clause (*"If you prefer not to hear from me again, simply reply 'STOP'..."*) to guarantee 100% compliance with international electronic communications regulations (Singapore PDPA, UAE TDRA, UK PECR/GDPR).

---

## 🌍 Cultural Etiquette & Communication Protocols by Country

Understanding the local business psyche ensures maximum reply rates, zero friction, and instant rapport.

### 1. 🇸🇬 Singapore (Pragmatic, Efficient, Anti-Scam Conscious)
* **Cultural Mindset:** High respect for tangible competence, efficiency, and lawfulness. High awareness of government anti-scam alerts; suspicious of phishing or "too good to be true" offers.
* **Attitude to Proactive Outreach:** Receptive if the value is immediately verifiable. When they see a working, clean website with zero spam traps or credit card forms, their defense drops.
* **Tone & Etiquette:** Professional, concise, respectful. Avoid slang or hype.
* **Operating Hours:** Strictly 09:00 – 18:00 SGT (UTC+8).
* **Step 1 Script:** *"Hi, is this [Business Name]?"*
* **Step 2 Adaptation:** Emphasize that files are static, secure, and hosted without tracking.

### 2. 🇦🇪 United Arab Emirates / Dubai (The Hustler Capital)
* **Cultural Mindset:** High-velocity, entrepreneurial, ambitious, status-conscious. Dubai thrives on networking, speed, and bold dealmakers.
* **Attitude to Hustlers & Builders:** **Extreme positive affinity.** Business owners and managers respect self-starters who take initiative (*"You built this for me before asking for a single dirham?"*).
* **Tone & Etiquette:** Warm, confident, courteous. Quick to reply.
* **Operating Hours:** 09:00 – 19:00 GST (UTC+4), Monday through Friday (mindful of Friday afternoon prayers).
* **Step 1 Script:** *"Hi, is this [Business Name]?"*

### 3. 🇬🇧 United Kingdom (Egalitarian, Understated, Anti-Hype)
* **Cultural Mindset:** Guarded personal privacy, dry humor, skeptical of aggressive American-style sales pitches. British independent tradesmen (*"tradies"* — builders, plumbers, mechanics, roofers) value **honest graft** and directness.
* **Attitude to Hustlers & Builders:** Dislike slick corporate agencies. BUT deeply respect a down-to-earth, humble craftsman who says *"Saw you didn't have a website on Google, knocked one together for you, take it or leave it, completely free."*
* **Tone & Etiquette:** Casual, modest, direct. Zero buzzwords (*no "synergy", "10x your revenue", or "supercharge"*).
* **Operating Hours:** 09:00 – 17:30 GMT/BST (UTC+0 / UTC+1).
* **Step 1 Script:** *"Hi, is this [Business Name]?"*

### 4. 🇮🇪 Ireland (Warm, Relationship-First, Down-to-Earth)
* **Cultural Mindset:** Sociable, conversational (*"the craic"*), hates pretentiousness.
* **Attitude to Proactive Outreach:** Very friendly if approached with humility and humor. Appreciates generosity.
* **Operating Hours:** 09:00 – 17:30 IST/GMT.
* **Step 1 Script:** *"Hi, is this [Business Name]?"*

### 5. 🇳🇱 Netherlands (Direct, Egalitarian, Pragmatic)
* **Cultural Mindset:** *"Doe maar gewoon, dan doe je al gek genoeg"* (Just act normal, that's crazy enough). World's #1 non-native English speakers (>92% fluent).
* **Attitude to Proactive Outreach:** Appreciates brutal directness and zero fluff. If you show them a working site and say *"Here are the files, host it yourself if you want"*, they appreciate the utility.
* **Operating Hours:** 09:00 – 17:30 CET (UTC+1).

---

## 🎯 Target Filtering & Priority Rules

### City Wealth Hierarchy (`data/cities.json`)
Outreach campaigns MUST harvest leads prioritizing highest-income clusters first:
1. **Singapore:** Central CBD & Tanjong Pagar -> Orchard/Tanglin -> Bukit Timah/Holland Village -> Katong/East Coast.
2. **UAE:** Dubai Central (Business Bay, Downtown, Marina) -> Dubai Al Quoz (Automotive/Trades) -> Abu Dhabi (Reem, Corniche, Mussafah).
3. **UK:** London Inner Boroughs (Fulham, Richmond, Westminster) -> Reading & Thames Valley -> Cambridge/Oxford -> Edinburgh -> Bristol -> Manchester.
4. **Ireland:** Dublin (South Dublin, Sandyford) -> Cork -> Galway.

### High-Ticket Niche Hierarchy (`data/smb_niches.json`)
Focus strictly on niches with **High Transaction Value** where a single acquired lead pays for an entire year of website hosting/retainer:
* 🟢 **Tier S (Whale Niches: $2,000–$25,000/deal):** Kitchen & Bathroom Renovation, Roofing Contractors, Cosmetic Dentistry (Implants/Invisalign), Luxury Auto Detailing / PPF, Solar & Heat Pump Installers.
* 🟢 **Tier A (High-Ticket Trades: $400–$2,000/deal):** Emergency Plumbing & Boilers, Commercial HVAC/Aircon Servicing, Physiotherapy & Sports Injury Clinics, Tree Surgeons, Bespoke Joinery.
* 🟡 **Tier B (Mid-Ticket: $100–$400/deal):** General Auto Repair Garages, Independent Vets, Pest Control.
* 🔴 **Tier C (REJECT / DO NOT TARGET):** Cafes, Bakeries, Florists, Fast Food (ticket size <$30, zero website ROI).

---

## 📱 Complete Message Templates

### Message 1: The Identity Confirmation (Sent to All 15 Contacts)
```text
Hi, is this [Business Name]?
```
*(Stop. Do nothing more. Wait for human reply).*

---

### Message 2: The Value Gift Drop (Sent ONLY Post-Confirmation)
Triggered immediately after human response (e.g., *"Yes, it is, how can I help?"*):

Before first contact, qualify the listing and the official website with `python scripts/compile-smb-site.py <reviewed-brief.json> --verify-website`. The sample below applies to an absent website. For an unavailable site, say “I tried the website linked from your Google listing, and it was unavailable when I checked.”

*(Attach: `mockups/[slug]-mobile.jpg`)*

```text
Hey [Business Name], I'm Syamsul Alam.

This might sound unconventional, but I was looking up your Google listing yesterday and noticed you don't have a website set up.

I went ahead and designed a clean, mobile-responsive website for your business today:
🔗 Preview: https://sites.webview.click/[slug]/

I've also attached a full-page mobile preview above so you can see how it looks.

It's 100% yours for free — no strings attached. You can download the complete static site files right here to host wherever you like:
📦 Direct ZIP: https://sites.webview.click/[slug]/download

If you're not technical and would like me to connect a custom domain or host it for you, just let me know. Either way, hope it helps your business!

(If you prefer not to hear from me again, simply reply 'STOP' and I will not contact you again.)
```

---

## 🛡️ Anti-Spam & Technical Safety Checklist
1. **Google Contacts Sync:** All 15 prospects must be pre-saved in Google Contacts via `gog contacts create` with format `[SMB] <Business Name>` before LusmoBot sends Message 1.
2. **Pacing:** Never exceed 15 initial pings in a 24-hour window.
3. **Jitter:** Wait 300 to 480 seconds (5 to 8 minutes) between sending initial pings.
4. **Instant Opt-Out:** If any contact replies `STOP`, `UNSUBSCRIBE`, or expresses disinterest, immediately delete their Google Contact and tag them as `opted_out` in CRM database.
