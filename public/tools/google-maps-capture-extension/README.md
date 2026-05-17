# Google Maps Capture Helper

This unpacked Chrome/Opera helper is for quota fallback prospecting. It runs on Google Maps pages, reads visible listing/detail text and place links from the browser DOM, then copies JSON that can be pasted into `/admin/leads` under `Manual Google Maps import`.

## Install

1. Open Chrome or Opera extension management.
2. Enable developer mode.
3. Choose "Load unpacked".
4. Select this folder: `public/tools/google-maps-capture-extension`.

## Use

1. Open a Google Maps search or business listing page.
2. Click the WebView Maps Capture extension icon.
3. Click `Capture visible Maps data`.
4. Either paste the copied JSON into `/admin/leads`, or click `Post to admin` to send the captured items to `https://webview.click/api/places/manual-import`.

Search pages are browser-rendered, so the helper only captures visible businesses. Scroll the Maps result list and run capture again for more listings.
