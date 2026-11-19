#!/usr/bin/env node
/**
 * harvest-prospects.mjs
 * 
 * Standalone CLI Prospect Harvester for SMB Lead Generation:
 * - Scrapes Google Maps / Places via Serper Places API or Google Places Text Search.
 * - Excludes known website links and requires a listed phone.
 * - Outputs candidates for individual listing and independent website review.
 */

import fs from "fs";

async function harvestViaSerper(query, apiKey, limit, country) {
  console.log(`🔍 Querying Serper Places API: "${query}"...`);
  const response = await fetch("https://google.serper.dev/places", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      gl: country,
      hl: country === "id" ? "id" : "en"
    })
  });

  if (!response.ok) {
    throw new Error(`Serper Places returned HTTP ${response.status}.`);
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
      rating: p.rating ?? null,
      reviews: p.ratingCount ?? null,
      website_state: "unknown",
      website: null,
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
  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google Places returned HTTP ${res.status}.`);
  
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error("Google Places returned an unsuccessful search status.");
  }

  const results = data.results || [];
  console.log(`📦 Found ${results.length} raw results from Google.`);

  const filtered = [];
  for (const r of results) {
    // Fetch details to inspect website and phone
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(r.place_id)}&fields=name,formatted_phone_number,international_phone_number,website,url,formatted_address,rating,user_ratings_total,opening_hours&key=${encodeURIComponent(apiKey)}`;
    const dRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(15000) });
    if (!dRes.ok) continue;
    const dData = await dRes.json();
    if (dData.status !== "OK" || !dData.result?.name) continue;
    const details = dData.result;

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
      rating: details.rating ?? r.rating ?? null,
      reviews: details.user_ratings_total ?? r.user_ratings_total ?? null,
      website_state: "unknown",
      website: null,
      place_id: r.place_id,
      maps_url: details.url ?? null,
      listing_website_absent: true,
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
  const countryIndex = args.indexOf("--country");

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node harvest-prospects.mjs --query "car repair Al Quoz Dubai" [--out prospects.json] [--limit 15] [--country ae]

Environment variables:
  SERPER_API_KEY        (or SERPER_CODEV_RESEARCH_API_KEY)
  GOOGLE_PLACES_API_KEY
    `);
    process.exit(0);
  }

  const query = queryIndex !== -1 ? args[queryIndex + 1] : null;
  const outFile = outIndex !== -1 ? args[outIndex + 1] : "prospects.json";
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : 15;
  const country = countryIndex !== -1 ? args[countryIndex + 1] : "id";

  if (!query) {
    console.error("❌ Error: --query is required (e.g. --query 'salon surabaya barat').");
    process.exit(1);
  }
  if (!/^[a-z]{2}$/.test(country ?? "") || !Number.isInteger(limit) || limit < 1 || limit > 60) {
    throw new Error("Supply a lowercase country code and a limit from 1 to 60.");
  }

  const serperKey = process.env.SERPER_API_KEY || process.env.SERPER_CODEV_RESEARCH_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  let prospects = [];
  if (serperKey) {
    prospects = await harvestViaSerper(query, serperKey, limit, country);
  } else if (placesKey) {
    prospects = await harvestViaGooglePlaces(query, placesKey, limit);
  } else {
    console.error("❌ Error: Neither SERPER_API_KEY nor GOOGLE_PLACES_API_KEY was found in environment.");
    console.error("   Inject via AgentSecrets or set env var.");
    process.exit(1);
  }

  console.log(`Collected ${prospects.length} candidates for website review.`);
  fs.writeFileSync(outFile, JSON.stringify(prospects, null, 2), "utf8");
  console.log(`💾 Saved to: ${outFile}`);
}

main().catch(error => {
  console.error(error instanceof TypeError ? "Prospect harvest failed while reading a provider response." : error.message);
  process.exitCode = 1;
});
