#!/usr/bin/env python3
"""
capture-screenshot.py

Captures high-fidelity mobile viewport screenshots of generated SMB sites
using Playwright for immediate WhatsApp delivery.
"""

import sys
import os
import argparse
from playwright.sync_api import sync_playwright

def capture_mobile_mockup(url: str, output_path: str, width: int = 390, height: int = 844):
    print(f"📸 Launching headless browser for: {url}")
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)
        # Emulate iPhone 14 / modern high-DPI mobile viewport
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()
        
        # Navigate and wait for network to settle
        response = page.goto(url, wait_until="networkidle", timeout=30000)
        if response is None or not response.ok:
            status = response.status if response else "no response"
            raise RuntimeError(f"Preview returned {status}: {url}")
        
        # Wait a moment for web fonts and animations to finalize
        page.wait_for_timeout(1500)
        
        # Capture visible top-fold mockup (Hero + Proof + CTA)
        page.screenshot(path=output_path, quality=85, type="jpeg")
        browser.close()
        
    print(f"✅ Saved mobile screenshot to: {output_path} ({os.path.getsize(output_path)} bytes)")

def main():
    parser = argparse.ArgumentParser(description="Capture mobile mockup for WhatsApp outreach")
    parser.add_argument("--url", required=True, help="Website URL to capture (e.g. https://sites.webview.click/bengkel-jaya/)")
    parser.add_argument("--output", required=True, help="Output image file path (e.g. /path/to/mockup.jpg)")
    parser.add_argument("--width", type=int, default=390, help="Viewport width (default: 390)")
    parser.add_argument("--height", type=int, default=844, help="Viewport height (default: 844)")
    
    args = parser.parse_args()
    capture_mobile_mockup(args.url, args.output, args.width, args.height)

if __name__ == "__main__":
    main()
