import assert from "node:assert/strict";
import test from "node:test";
import { assessWebsiteUrl, buildMarketingAudit } from "../src/lib/marketingAudit";

test("assessWebsiteUrl treats social and directory links as partial website signals", () => {
  assert.equal(assessWebsiteUrl("").kind, "missing");
  assert.equal(assessWebsiteUrl("https://facebook.com/example-business").kind, "social_profile");
  assert.equal(assessWebsiteUrl("https://linktr.ee/example").kind, "link_hub");
  assert.equal(assessWebsiteUrl("https://www.yelp.com/biz/example").kind, "directory_or_marketplace");
  assert.equal(assessWebsiteUrl("https://example-dental.com").kind, "owned_website");
});

test("buildMarketingAudit creates owner-facing industry copy and competitor evidence", () => {
  const audit = buildMarketingAudit({
    target: {
      businessId: "bright-smile-dental",
      businessName: "Bright Smile Dental",
      websiteUrl: "https://instagram.com/brightsmile",
      rating: 4.3,
      reviewCount: 12,
      photoCount: 2,
      phone: "+1 555-0100",
      address: "100 Main St, Dallas, TX",
      city: "Dallas",
      category: "dentist",
      types: ["dentist", "health"],
      generatedPreviewAvailable: true,
    },
    competitors: [
      { name: "North Dallas Dental", websiteUrl: "https://northdallasdental.example", rating: 4.8, reviewCount: 120, photoCount: 8 },
      { name: "Family Dental Studio", websiteUrl: "https://familydental.example", rating: 4.7, reviewCount: 90, photoCount: 6 },
    ],
  });

  assert.equal(audit.target.websiteAssessment.kind, "social_profile");
  assert.equal(audit.target.hasWebsite, false);
  assert.equal(audit.ownerFacingCopy.industryGroup, "dental_medical");
  assert.equal(audit.competitors.withWebsite, 2);
  assert.ok(audit.evidence.comparisonCards.some((card) => card.key === "review-count"));
  assert.ok(audit.score.total < 80);
});
