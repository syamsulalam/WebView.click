#!/usr/bin/env python3
"""
scrape-maps-direct.py

Direct Headless Google Maps Scraper (Playwright with Chrome):
- Queries Google Maps directly with zero paid third-party API dependencies (no Serper / SerpApi required).
- Auto-scrolls the results feed to collect local business listings.
- Inspects each listing's DOM for phone, address, rating, review count, and website.
- Opens the individual listing to check for a website and fill missing contact details.
- Keeps candidates pending an independent official-site search.
- Outputs JSON for prospect research.
"""

import json
import re
import time
import urllib.parse
import argparse
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


def read_listing(page, maps_url, expected_name):
    if not maps_url:
        return None
    url = urllib.parse.urljoin("https://www.google.com", maps_url)
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.netloc != "www.google.com" or not parts.path.startswith("/maps/place/"):
        return None
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=8000)
        page.get_by_role("heading", name=expected_name, exact=True, level=1).wait_for(timeout=4500)
        address = page.locator('button[data-item-id="address"]').first
        address.wait_for(timeout=3000)
    except PlaywrightTimeoutError:
        return None
    website = page.locator('a[data-item-id="authority"], a[data-tooltip*="Website" i], '
                           'a[data-tooltip*="Situs web" i], a[aria-label^="Website" i], '
                           'a[aria-label^="Situs web" i]')
    if website.count():
        return None
    phone_button = page.locator('button[data-item-id^="phone:tel:"]').first
    phone_id = (phone_button.get_attribute("data-item-id", timeout=1000) or "") if phone_button.count() else ""
    address_text = address.get_attribute("aria-label", timeout=1000) or ""
    return phone_id.removeprefix("phone:tel:"), address_text.partition(": ")[2]

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

def scrape_google_maps(query: str, limit: int = 15, max_scrolls: int = 5, hl: str = "en"):
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.google.com/maps/search/{encoded_query}?hl={hl}"
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
            locale="en-US" if hl == "en" else "id-ID"
        )
        page = context.new_page()
        details_page = context.new_page()

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

                    # Generate stable URL-safe slug from title (Sol P1-05 fix)
                    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
                    if not slug:
                        slug = f"smb-{int(time.time())}"

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
                    if website_url or (rating > 0 and rating < 4.0):
                        continue
                    listing = read_listing(details_page, maps_url, title)
                    if listing is None:
                        continue
                    listing_phone, address = listing

                    # 4. Extract Text & Phone
                    card_text = card.inner_text()
                    lines = [clean_text(line) for line in card_text.split("\n") if clean_text(line)]

                    phone = re.sub(r"[^\d+]", "", listing_phone)
                    if not phone.startswith("+"):
                        phone = ""
                    # 1. Check for UAE phone pattern (+971, 00971, 971, 05x, 04, 02)
                    uae_match = re.search(r"(?:(?:\+971|00971|971|0)[\s-]?(?:5[024568]|4|2|6|7|9)[\s-]?\d{3}[\s-]?\d{4})", card_text)
                    if not phone and uae_match:
                        raw_p = re.sub(r"[^\d+]", "", uae_match.group(0))
                        if raw_p.startswith("00971"):
                            phone = "+" + raw_p[2:]
                        elif raw_p.startswith("971"):
                            phone = "+" + raw_p
                        elif raw_p.startswith("0"):
                            phone = "+971" + raw_p[1:]
                        elif not raw_p.startswith("+"):
                            phone = "+971" + raw_p
                        else:
                            phone = raw_p

                    # 2. Check for Indonesian phone pattern
                    if not phone:
                        id_match = re.search(r"(?:(?:\+62|62|08|031|0341)[\s-]?\d{2,4}[\s-]?\d{3,5}[\s-]?\d{0,4})", card_text)
                        if id_match:
                            raw_p = re.sub(r"[^\d+]", "", id_match.group(0))
                            if raw_p.startswith("0"):
                                phone = "+62" + raw_p[1:]
                            elif raw_p.startswith("62"):
                                phone = "+" + raw_p
                            else:
                                phone = raw_p

                    # 3. Check for general E.164 phone pattern
                    if not phone:
                        gen_match = re.search(r"\+(?:[1-9]\d{6,14})", card_text)
                        if gen_match:
                            phone = gen_match.group(0)

                    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
                        continue

                    # Extract Category & Vertical
                    category_raw = ""
                    for line in lines:
                        if any(w in line.lower() for w in ["bengkel", "salon", "klinik", "toko", "restoran", "kafe", "cafe", "kontraktor", "servis", "detailing", "repair", "dentist", "dental", "cleaning", "hvac", "ac"]):
                            category_raw = line
                            break

                    def map_category_to_vertical(cat: str) -> str:
                        cat_lower = (cat or "").lower()
                        if any(w in cat_lower for w in ["detailing", "bengkel", "mobil", "motor", "otomotif", "auto", "car repair", "car wash", "tinting", "ppf", "ceramic coating"]):
                            return "automotive"
                        if any(w in cat_lower for w in ["ac repair", "ac maintenance", "air conditioning", "hvac", "cooling", "chiller"]):
                            return "hvac"
                        if any(w in cat_lower for w in ["klinik", "dokter", "gigi", "medis", "apotek", "dental", "dentist", "aesthetic", "clinic"]):
                            return "healthcare"
                        if any(w in cat_lower for w in ["salon", "barbershop", "spa", "rambut", "beauty"]):
                            return "beauty"
                        if any(w in cat_lower for w in ["kafe", "cafe", "resto", "restoran", "kopi", "dining", "restaurant"]):
                            return "hospitality"
                        if any(w in cat_lower for w in ["kontraktor", "bangunan", "renovasi", "fit out", "fitout", "interior", "joinery", "landscaping", "construction", "roofing"]):
                            return "construction"
                        if any(w in cat_lower for w in ["plumbing", "plumber", "drainage"]):
                            return "plumbing"
                        if any(w in cat_lower for w in ["cleaning", "deep cleaning", "sofa cleaning", "pest control"]):
                            return "cleaning"
                        if any(w in cat_lower for w in ["toko", "retail", "shop"]):
                            return "retail"
                        return "general"

                    vertical = map_category_to_vertical(category_raw or query)

                    prospect = {
                        "schema_version": 1,
                        "name": title,
                        "business_name": title,
                        "slug": slug,
                        "phone": phone,
                        "rating": rating,
                        "reviews": reviews,
                        "address": address,
                        "website_state": "unknown",
                        "website": None,
                        "listing_website_absent": True,
                        "category": {
                            "raw": category_raw or query,
                            "vertical": vertical,
                            "source_id": "google_maps_card"
                        },
                        "maps_url": maps_url,
                        "source": "google_maps_playwright_direct"
                    }

                    seen_names.add(title)
                    prospects.append(prospect)
                    print(f"  Candidate for official-site review: {title}")

                    if len(prospects) >= limit:
                        break

                except Exception as card_err:
                    card_title = title if "title" in locals() else "unknown"
                    print(f"  ⚠️ Warning processing card '{card_title}': {card_err}")
                    continue

        finally:
            browser.close()

    return prospects

def main():
    parser = argparse.ArgumentParser(description="Direct Headless Google Maps Scraper")
    parser.add_argument("--query", required=True, help="Search query (e.g. 'car detailing business bay dubai')")
    parser.add_argument("--out", default="prospects.json", help="Output JSON path")
    parser.add_argument("--limit", type=int, default=15, help="Max leads to collect")
    parser.add_argument("--scrolls", type=int, default=6, help="Scroll depth")
    parser.add_argument("--hl", default="en", help="Google Maps interface language (en or id)")
    args = parser.parse_args()

    results = scrape_google_maps(args.query, limit=args.limit, max_scrolls=args.scrolls, hl=args.hl)
    print(f"\nCollected {len(results)} individual listing candidates for independent website review.")
    
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved to: {args.out}")

if __name__ == "__main__":
    main()
