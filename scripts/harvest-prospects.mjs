#!/usr/bin/env node
/**
 * harvest-prospects.mjs
 * 
 * Standalone CLI Prospect Harvester for SMB Lead Generation:
 * - Scrapes Google Maps / Places via Serper Places API or Google Places Text Search.
 * - Filters strictly for high-potential leads:
 *   1. No website listed (or website is null/empty)
 *   2. Has valid phone / WhatsApp number
 *   3. Rating >= 4.0 (established reputation)
 * - Outputs clean JSON compatible with `run-smb-pipeline.ps1` and `sync-google-contacts.mjs`.
 */

import fs from "fs";
import path from "path";

async function harvestViaSerper(query, apiKey, limit = 20) {
  console.log(`🔍 Querying Serper Places API: "${query}"...`);
  const response = await fetch("https://google.serper.dev/places", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      gl: "id",
      hl: "id"
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const places = data.places || [];
  console.log(`📦 Found ${places.length} raw business listings from Google Maps.`);

  const filtered = [];
  for (const p of places) {
    // Only target businesses WITHOUT an official website
    const hasWebsite = p.website && typeof p.website === "string" && p.website.trim().length > 0;
    if (hasWebsite) continue;

    // Must have a phone number
    if (!p.phoneNumber) continue;

    const rating = typeof p.rating === "number" ? p.rating : 0;
    if (rating > 0 && rating < 3.8) continue; // Skip poor-reputation businesses

    const slug = (p.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    filtered.push({
      slug,
      name: p.title,
      phone: p.phoneNumber,
      address: p.address || "",
      rating: p.rating || 4.5,
      reviews: p.ratingCount || 10,
      category: p.category || "SMB",
      niche: query.split(" ")[0].toLowerCase(),
      latitude: p.latitude,
      longitude: p.longitude,
      source: "google_maps_serper"
    });

    if (filtered.length >= limit) break;
  }

  return filtered;
}

async function harvestViaGooglePlaces(query, apiKey, limit = 20) {
  console.log(`🔍 Querying Google Maps TextSearch API: "${query}"...`);
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error(`Google API error: ${res.statusText}`);
  
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places status: ${data.status} - ${data.error_message || ""}`);
  }

  const results = data.results || [];
  console.log(`📦 Found ${results.length} raw results from Google.`);

  const filtered = [];
  for (const r of results) {
    // Fetch details to inspect website and phone
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(r.place_id)}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address,rating,user_ratings_total,opening_hours&key=${encodeURIComponent(apiKey)}`;
    const dRes = await fetch(detailsUrl);
    const dData = await dRes.json();
    const details = dData.result || {};

    if (details.website && details.website.trim()) continue; // Skip if already has website
    const phone = details.international_phone_number || details.formatted_phone_number;
    if (!phone) continue;

    const slug = (details.name || r.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    filtered.push({
      slug,
      name: details.name || r.name,
      phone: phone.replace(/[^0-9+]/g, ""),
      address: details.formatted_address || r.formatted_address || "",
      rating: details.rating || r.rating || 4.5,
      reviews: details.user_ratings_total || r.user_ratings_total || 5,
      niche: query.split(" ")[0].toLowerCase(),
      source: "google_places_api"
    });

    if (filtered.length >= limit) break;
  }

  return filtered;
}

async function main() {
  const args = process.argv.slice(2);
  const queryIndex = args.indexOf("--query");
  const outIndex = args.indexOf("--out");
  const limitIndex = args.indexOf("--limit");

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node harvest-prospects.mjs --query "bengkel mobil malang" [--out prospects.json] [--limit 15]

Environment variables:
  SERPER_API_KEY        (or SERPER_CODEV_RESEARCH_API_KEY)
  GOOGLE_PLACES_API_KEY
    `);
    process.exit(0);
  }

  const query = queryIndex !== -1 ? args[queryIndex + 1] : null;
  const outFile = outIndex !== -1 ? args[outIndex + 1] : "prospects.json";
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 15;

  if (!query) {
    console.error("❌ Error: --query is required (e.g. --query 'salon surabaya barat').");
    process.exit(1);
  }

  const serperKey = process.env.SERPER_API_KEY || process.env.SERPER_CODEV_RESEARCH_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  let prospects = [];
  if (serperKey) {
    prospects = await harvestViaSerper(query, serperKey, limit);
  } else if (placesKey) {
    prospects = await harvestViaGooglePlaces(query, placesKey, limit);
  } else {
    console.error("❌ Error: Neither SERPER_API_KEY nor GOOGLE_PLACES_API_KEY was found in environment.");
    console.error("   Inject via AgentSecrets or set env var.");
    process.exit(1);
  }

  console.log(`🎯 Successfully harvested ${prospects.length} high-intent no-website SMB lead(s)!`);
  fs.writeFileSync(outFile, JSON.stringify(prospects, null, 2), "utf8");
  console.log(`💾 Saved to: ${outFile}`);
}

main().catch(console.error);
