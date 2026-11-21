#!/usr/bin/env node
/**
 * sync-google-contacts.mjs
 * 
 * Synchronizes SMB prospect contacts to Google Contacts via Google People API v1
 * or exports a compliant vCard (.vcf) batch file for instant one-click phone sync.
 * 
 * Contact naming convention: "[SMB] <Business Name>"
 * This ensures:
 * 1. Your phone running WhatsApp automatically recognizes the contact.
 * 2. WhatsApp treats the conversation as between known saved contacts, reducing spam score.
 * 3. The business owner sees your profile with mutual contact context.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const PEOPLE_API_CREATE_URL = "https://people.googleapis.com/v1/people:createContact";

/**
 * Refreshes Google OAuth access token in RAM without writing secrets to disk.
 */
export async function refreshAccessToken(credentials, fetchImpl = fetch) {
  if (!credentials.client_id || !credentials.refresh_token) {
    throw new Error("oauth_client_and_refresh_token_required");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: credentials.client_id,
    refresh_token: credentials.refresh_token
  });
  if (credentials.client_secret) {
    body.set("client_secret", credentials.client_secret);
  }

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json();
  if (!response.ok || typeof result.access_token !== "string") {
    throw new Error(`oauth_refresh_failed_${response.status}`);
  }
  return {
    accessToken: result.access_token,
    scope: result.scope || "",
    expiresIn: result.expires_in
  };
}

/**
 * Preflights Google Account identity and Contacts scope.
 */
export async function preflightGoogleAccount(accessToken, expectedEmail = null, fetchImpl = fetch) {
  const response = await fetchImpl("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`google_account_preflight_failed_${response.status}`);
  }
  const info = await response.json();
  if (expectedEmail && info.email && info.email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error(`account_mismatch_expected_${expectedEmail}_got_${info.email}`);
  }
  return info;
}

/**
 * Creates a single Google Contact via Google People API v1.
 */
export async function createGoogleContact(contact, accessToken, fetchImpl = fetch) {
  const businessName = contact.business_name || contact.name || "SMB Prospect";
  const payload = {
    names: [
      {
        givenName: `[SMB] ${businessName}`
      }
    ],
    phoneNumbers: [
      {
        value: contact.phone,
        type: "work"
      }
    ],
    organizations: [
      {
        name: businessName
      }
    ],
    biographies: [
      {
        value: `Outreach via WebView.click | Niche: ${contact.niche || "General"} | Address: ${contact.address || ""}`
      }
    ],
    userDefined: [
      { key: "Source", value: "WebView.click" },
      { key: "Status", value: "Cold_Icebreaker_Queue" }
    ]
  };

  const response = await fetchImpl(PEOPLE_API_CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google People API Error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Generates standards-compliant vCard v3.0 batch format.
 */
export function generateVCard(contacts) {
  let vcf = "";
  for (const c of contacts) {
    const name = c.business_name || c.name || "SMB Prospect";
    vcf += "BEGIN:VCARD\r\n";
    vcf += "VERSION:3.0\r\n";
    vcf += `FN:[SMB] ${name}\r\n`;
    vcf += `N:[SMB];${name};;;\r\n`;
    vcf += `ORG:${name};\r\n`;
    vcf += `TEL;TYPE=WORK,VOICE,PREF:${c.phone}\r\n`;
    if (c.address) vcf += `ADR;TYPE=WORK:;;${c.address};;;;\r\n`;
    vcf += `NOTE:WebView.click SMB Outreach | Niche: ${c.niche || ""}\r\n`;
    vcf += "END:VCARD\r\n";
  }
  return vcf;
}

// Standalone CLI Execution Guard (Runs only when executed directly)
async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const tokenIndex = args.indexOf("--token");
  const vcfIndex = args.indexOf("--vcf");

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node sync-google-contacts.mjs --input <prospects.json> [--sync] [--vcf <output.vcf>]

Arguments:
  --input   JSON file containing array of prospects: [{ name, phone, address, niche }]
  --sync    Create Google Contacts using GOOGLE_CONTACTS_ACCESS_TOKEN
  --vcf     Path to write a combined .vcf vCard file for manual/local import
    `);
    process.exit(0);
  }

  const inputFile = inputIndex !== -1 ? args[inputIndex + 1] : null;
  const sync = args.includes("--sync") || tokenIndex !== -1;
  const token = sync ? (tokenIndex !== -1 ? args[tokenIndex + 1] : process.env.GOOGLE_CONTACTS_ACCESS_TOKEN) : "";
  const vcfOut = vcfIndex !== -1 ? args[vcfIndex + 1] : null;

  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error("❌ Error: Valid --input JSON file is required.");
    process.exit(1);
  }

  if (sync && !token) throw new Error("Google Contacts sync requires an OAuth token.");
  if (vcfIndex !== -1 && !vcfOut) throw new Error("The --vcf option requires an output path.");
  const data = JSON.parse(fs.readFileSync(inputFile, "utf8").replace(/^\uFEFF/, ""));
  const contacts = Array.isArray(data) ? data : [data];

  console.log(`📋 Found ${contacts.length} contact(s) to process.`);

  // 1. Export VCF if requested or fallback
  if (vcfOut) {
    const vcfContent = generateVCard(contacts);
    fs.writeFileSync(vcfOut, vcfContent, "utf8");
    console.log(`✅ Saved ${contacts.length} contact(s) to VCF file: ${vcfOut}`);
  }

  // 2. Direct API Sync if Token available
  if (token) {
    console.log("🔄 Syncing directly to Google Contacts API...");
    let success = 0;
    for (const contact of contacts) {
      try {
        await createGoogleContact(contact, token);
        console.log(`  ✓ Synced: [SMB] ${contact.name || contact.business_name} (${contact.phone})`);
        success++;
      } catch (err) {
        console.error(`  ✗ Failed to sync [SMB] ${contact.name || contact.business_name}: ${err.message}`);
      }
    }
    console.log(`🏁 API Sync Complete: ${success}/${contacts.length} saved to Google Contacts.`);
    if (success !== contacts.length) process.exitCode = 1;
  } else if (!vcfOut) {
    console.log("ℹ️ No Google OAuth token provided. Generating default VCF export at 'contacts-export.vcf'...");
    const vcfContent = generateVCard(contacts);
    fs.writeFileSync("contacts-export.vcf", vcfContent, "utf8");
    console.log(`✅ Exported to contacts-export.vcf. Import this file into Google Contacts (contacts.google.com).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
