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

const PEOPLE_API_CREATE_URL = "https://people.googleapis.com/v1/people:createContact";

export async function createGoogleContact(contact, accessToken) {
  const payload = {
    names: [
      {
        givenName: contact.name,
        familyName: "[SMB]",
        displayName: `[SMB] ${contact.name}`
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
        name: contact.name,
        title: "Owner / Manager"
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

  const response = await fetch(PEOPLE_API_CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google People API Error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

export function generateVCard(contacts) {
  let vcf = "";
  for (const c of contacts) {
    vcf += "BEGIN:VCARD\r\n";
    vcf += "VERSION:3.0\r\n";
    vcf += `FN:[SMB] ${c.name}\r\n`;
    vcf += `N:[SMB];${c.name};;;\r\n`;
    vcf += `ORG:${c.name};\r\n`;
    vcf += `TEL;TYPE=WORK,VOICE,PREF:${c.phone}\r\n`;
    if (c.address) vcf += `ADR;TYPE=WORK:;;${c.address};;;;\r\n`;
    vcf += `NOTE:WebView.click SMB Outreach | Niche: ${c.niche || ""}\r\n`;
    vcf += "END:VCARD\r\n";
  }
  return vcf;
}

// CLI Execution
async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const tokenIndex = args.indexOf("--token");
  const vcfIndex = args.indexOf("--vcf");

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  node sync-google-contacts.mjs --input <prospects.json> [--token <google_oauth_token>] [--vcf <output.vcf>]

Arguments:
  --input   JSON file containing array of prospects: [{ name, phone, address, niche }]
  --token   Google OAuth Access Token with https://www.googleapis.com/auth/contacts scope
  --vcf     Path to write a combined .vcf vCard file for manual/local import
    `);
    process.exit(0);
  }

  const inputFile = inputIndex !== -1 ? args[inputIndex + 1] : null;
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : process.env.GOOGLE_CONTACTS_ACCESS_TOKEN;
  const vcfOut = vcfIndex !== -1 ? args[vcfIndex + 1] : null;

  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error("❌ Error: Valid --input JSON file is required.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
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
        console.log(`  ✓ Synced: [SMB] ${contact.name} (${contact.phone})`);
        success++;
      } catch (err) {
        console.error(`  ✗ Failed to sync [SMB] ${contact.name}: ${err.message}`);
      }
    }
    console.log(`🏁 API Sync Complete: ${success}/${contacts.length} saved to Google Contacts.`);
  } else if (!vcfOut) {
    console.log("ℹ️ No Google OAuth token provided. Generating default VCF export at 'contacts-export.vcf'...");
    const vcfContent = generateVCard(contacts);
    fs.writeFileSync("contacts-export.vcf", vcfContent, "utf8");
    console.log(`✅ Exported to contacts-export.vcf. Import this file into Google Contacts (contacts.google.com).`);
  }
}

main().catch(console.error);
