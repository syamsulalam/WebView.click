#!/usr/bin/env python3
"""
scrape-maps-direct.py

Direct Headless Google Maps Scraper (Playwright with Chrome):
- Queries Google Maps directly with zero paid third-party API dependencies (no Serper / SerpApi required).
- Auto-scrolls the results feed to collect local business listings.
- Inspects each listing's DOM for phone, address, rating, review count, and website.
- Strictly filters for SMB Outreach targets:
    1. website is None or empty (Zero website listed)
    2. valid phone number
    3. rating >= 4.0
- Outputs standard JSON compatible with `run-smb-pipeline.ps1` and `sync-google-contacts.mjs`.
"""

import sys
import os
import io
import json
import re
import time
import urllib.parse
import urllib.request
import argparse
import importlib
from playwright.sync_api import sync_playwright

# Import enrich-business-brand module
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    enrich = importlib.import_module("enrich-business-brand")
except Exception as e:
    enrich = None

def clean_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()

def parse_rating(text: str):
    if not text:
        return 0.0
    match = re.search(r"(\d+[.,]\d+|\d+)", text)
    if match:
        return float(match.group(1).replace(",", "."))
    return 0.0

def parse_reviews(text: str):
    if not text:
        return 0
    match = re.search(r"\(?(\d[\d.,]*)\)?", text)
    if match:
        clean = match.group(1).replace(".", "").replace(",", "")
        try:
            return int(clean)
        except ValueError:
            return 0
    return 0

def scrape_google_maps(query: str, limit: int = 15, max_scrolls: int = 5):
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.google.com/maps/search/{encoded_query}?hl=id"
    print(f"🌐 Navigating to Google Maps: {url}")
    
    prospects = []
    seen_names = set()

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
            
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
            locale="id-ID"
        )
        page = context.new_page()

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(3000)

            # Accept cookies dialog if present
            try:
                accept_btn = page.query_selector('button[aria-label*="Terima"], button[aria-label*="Accept"]')
                if accept_btn:
                    accept_btn.click()
                    page.wait_for_timeout(1000)
            except Exception:
                pass

            # Results feed selector
            feed_selector = 'div[role="feed"]'
            try:
                page.wait_for_selector(feed_selector, timeout=10000)
            except Exception:
                print("⚠️ Results feed not found within timeout; scanning available articles.")

            # Scroll feed to hydrate cards
            for i in range(max_scrolls):
                page.evaluate(
                    """() => {
                        const feed = document.querySelector('div[role="feed"]');
                        if (feed) {
                            feed.scrollTop = feed.scrollHeight;
                        } else {
                            window.scrollBy(0, 800);
                        }
                    }"""
                )
                page.wait_for_timeout(1500)

            # Extract business cards
            cards = page.query_selector_all('div[role="article"], .Nv2PK')
            print(f"📦 Total raw listing cards detected: {len(cards)}")

            for card in cards:
                try:
                    # 1. Name & Maps URL
                    title_elem = card.query_selector('.qBF1Pd, .fontHeadlineSmall, [role="heading"]')
                    title = clean_text(title_elem.inner_text() if title_elem else "")
                    
                    anchor_elem = card.query_selector('a[href*="/maps/place/"]')
                    maps_url = anchor_elem.get_attribute("href") if anchor_elem else ""

                    if not title or title in seen_names:
                        continue

                    # 2. Rating & Reviews
                    rating_elem = card.query_selector('span[role="img"][aria-label*="bintang"], span[role="img"][aria-label*="star"], .MW4etd')
                    rating_text = rating_elem.get_attribute("aria-label") or rating_elem.inner_text() if rating_elem else ""
                    rating = parse_rating(rating_text)

                    reviews_elem = card.query_selector('.UY7F9')
                    reviews_text = reviews_elem.inner_text() if reviews_elem else ""
                    reviews = parse_reviews(reviews_text)

                    # 3. Check for Website button
                    website_elem = card.query_selector('a[data-tooltip*="Situs web" i], a[data-tooltip*="Website" i], a[aria-label*="website" i]')
                    website_url = website_elem.get_attribute("href") if website_elem else None
                    if website_url and "google.com" in website_url:
                        website_url = None

                    # 4. Extract Text & Phone
                    card_text = card.inner_text()
                    lines = [clean_text(line) for line in card_text.split("\n") if clean_text(line)]

                    phone = ""
                    # Look for Indonesian phone pattern
                    phone_match = re.search(r"(?:(?:\+62|62|08|031|0341)[\s-]?\d{2,4}[\s-]?\d{3,5}[\s-]?\d{0,4})", card_text)
                    if phone_match:
                        raw_phone = re.sub(r"[^\d+]", "", phone_match.group(0))
                        if raw_phone.startswith("0"):
                            phone = "+62" + raw_phone[1:]
                        elif raw_phone.startswith("62"):
                            phone = "+" + raw_phone
                        else:
                            phone = raw_phone

                    address = ""
                    for line in lines:
                        if re.search(r"\b(Jl\.|Jalan|Kec\.|Kota|Kab\.|No\.|Malang|Surabaya|Jakarta)\b", line, re.I):
                            address = line
                            break

                    # FILTER RULES:
                    # 1. Must NOT have a website
                    if website_url:
                        continue
                    # 2. Must have a phone number for WhatsApp outreach
                    if not phone:
                        continue
                    # 3. Must have reputable rating
                    if rating > 0 and rating < 4.0:
                        continue

                    # Extract Category & Vertical
                    category_raw = ""
                    for line in lines:
                        if any(w in line.lower() for w in ["bengkel", "salon", "klinik", "toko", "restoran", "kafe", "cafe", "kontraktor", "servis"]):
                            category_raw = line
                            break

                    def map_category_to_vertical(cat: str) -> str:
                        cat_lower = (cat or "").lower()
                        if any(w in cat_lower for w in ["bengkel", "mobil", "motor", "otomotif", "auto"]):
                            return "automotive"
                        if any(w in cat_lower for w in ["klinik", "dokter", "gigi", "medis", "apotek"]):
                            return "healthcare"
                        if any(w in cat_lower for w in ["salon", "barbershop", "spa", "rambut"]):
                            return "beauty"
                        if any(w in cat_lower for w in ["kafe", "cafe", "resto", "restoran", "kopi"]):
                            return "hospitality"
                        if any(w in cat_lower for w in ["kontraktor", "bangunan", "renovasi"]):
                            return "construction"
                        if any(w in cat_lower for w in ["toko", "retail", "shop"]):
                            return "retail"
                        return "general"

                    vertical = map_category_to_vertical(category_raw or query)

                    # Extract card photos
                    photo_urls = []
                    img_nodes = card.query_selector_all('img[src*="googleusercontent.com"], img[src*="ggpht.com"]')
                    for img_node in img_nodes:
                        src = img_node.get_attribute("src")
                        if src and "http" in src:
                            high_res = re.sub(r"=w\d+-h\d+.*", "=s800", src)
                            if high_res not in photo_urls:
                                photo_urls.append(high_res)

                    # Download photos and enrich brand if enrich module loaded
                    photos_dir = os.path.join("assets", "prospects", slug, "photos")
                    os.makedirs(photos_dir, exist_ok=True)
                    local_photos = []
                    for p_idx, p_url in enumerate(photo_urls[:6]):
                        try:
                            local_p_path = os.path.join(photos_dir, f"photo_{p_idx}.jpg")
                            req = urllib.request.Request(p_url, headers={"User-Agent": "Mozilla/5.0"})
                            with urllib.request.urlopen(req, timeout=10) as resp, open(local_p_path, "wb") as out_f:
                                out_f.write(resp.read())
                            local_photos.append(local_p_path)
                        except Exception:
                            continue

                    brand_meta = {
                        "palette": enrich.NEUTRAL_FALLBACK_PALETTE if enrich else ["#046bd2", "#045cb4", "#1e293b", "#334155", "#f8fafc", "#ffffff", "#e2e8f0", "#f1f5f9", "#0f172a"],
                        "palette_source": "neutral-fallback",
                        "logo": {"status": "not_found", "path": None, "sha256": None, "source_id": None}
                    }

                    if enrich and local_photos:
                        enriched_dummy = enrich.process_prospect_brand({"photos": local_photos}, photos_dir=photos_dir)
                        if "brand" in enriched_dummy:
                            brand_meta = enriched_dummy["brand"]

                    prospect = {
                        "schema_version": 1,
                        "name": title,
                        "business_name": title,
                        "slug": slug,
                        "phone": phone,
                        "rating": rating,
                        "reviews": reviews,
                        "address": address,
                        "website_state": "absent",
                        "website": None,
                        "category": {
                            "raw": category_raw or query,
                            "vertical": vertical,
                            "source_id": "google_maps_card"
                        },
                        "brand": brand_meta,
                        "maps_url": maps_url or url,
                        "source": "google_maps_playwright_direct"
                    }

                    seen_names.add(title)
                    prospects.append(prospect)
                    print(f"  🎯 Found Target: {title} | Phone: {phone} | Rating: {rating}⭐ ({reviews} reviews)")

                    if len(prospects) >= limit:
                        break

                except Exception as card_err:
                    continue

        finally:
            browser.close()

    return prospects

def main():
    parser = argparse.ArgumentParser(description="Direct Headless Google Maps Scraper")
    parser.add_argument("--query", required=True, help="Search query (e.g. 'bengkel mobil malang')")
    parser.add_argument("--out", default="prospects.json", help="Output JSON path")
    parser.add_argument("--limit", type=int, default=15, help="Max leads to collect")
    parser.add_argument("--scrolls", type=int, default=6, help="Scroll depth")
    args = parser.parse_args()

    results = scrape_google_maps(args.query, limit=args.limit, max_scrolls=args.scrolls)
    print(f"\n✅ Total qualified no-website leads collected: {len(results)}")
    
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved to: {args.out}")

if __name__ == "__main__":
    main()
