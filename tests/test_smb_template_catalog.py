import importlib.util
import json
from datetime import datetime, timezone
from runpy import run_path
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "resolve-smb-template.py"
spec = importlib.util.spec_from_file_location("resolve_smb_template", SCRIPT)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
compiler = run_path(str(SCRIPT.parent / "compile-smb-site.py"))
media = run_path(str(SCRIPT.parent / "prepare-smb-image.py"))


class TemplateCatalogTest(unittest.TestCase):
    def test_market_lookup_and_outreach_exclusion(self):
        known, _ = catalog.load_requests()
        dubai = known[catalog.normalized("Car detailing Business Bay, Dubai")]
        self.assertEqual(dubai["candidates"], ["car-wash-08", "car-repair-08"])
        self.assertEqual(known["coffee shop"]["outreach_tier"], "Tier C")

    def test_missing_and_builder_mismatch_do_not_fall_back(self):
        slug = "car-repair-08"
        manifest = {
            slug: {
                "slug": slug,
                "builder": "gutenberg",
                "readiness": "qualified",
                "static_export_supported": True,
                "revision": "1.0.0",
                "file_hashes": {"wxr.xml": {"size": 123, "sha256": "a" * 64}},
            },
        }
        self.assertEqual(catalog.resolve_entry(slug, manifest, "gutenberg")["wxr_bytes"], 123)
        self.assertIn("reason", catalog.resolve_entry("business-consulting-02", manifest))
        manifest[slug]["builder"] = "elementor"
        known, _ = catalog.load_requests()
        result = catalog.resolve_request(known["automotive"], manifest, "gutenberg")
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["candidates"], [])
        self.assertEqual(len(result["rejected"]), 2)

    def test_build_resolves_niche_and_rejects_unrelated_or_unreviewed_input(self):
        layouts = catalog.read_json(catalog.DATA / "smb-template-layouts.json")
        manifest = {slug: {
            "slug": slug, "builder": builder, "readiness": "qualified",
            "static_export_supported": True, "revision": layout["revision"],
            "file_hashes": {"wxr.xml": {"size": 123, "sha256": layout["wxr_sha256"]}},
        } for slug, builder in (("car-repair", "elementor"), ("car-repair-08", "gutenberg"))
          for layout in (layouts[slug],)}
        select = compiler["select_template"]
        candidate, _ = select({"category": {"raw": "auto repair"}}, manifest, layouts)
        self.assertEqual(candidate["slug"], "car-repair")
        candidate, _ = select({"niche": "automotive", "builder": "gutenberg"}, manifest, layouts)
        self.assertEqual(candidate["slug"], "car-repair-08")
        with self.assertRaisesRegex(ValueError, "No catalog route"):
            select({"template_query": "unmapped niche", "niche": "automotive"}, manifest, layouts)
        with self.assertRaisesRegex(ValueError, "No reviewed WebView layout"):
            select({"niche": "automotive", "template_id": "business-consulting-02"}, manifest, layouts)
        with self.assertRaisesRegex(ValueError, "No reviewed WebView layout"):
            select({"niche": "automotive"}, manifest, {})

    def test_rejects_thin_or_placeholder_copy(self):
        for text in ("Short", "Lorem ipsum placeholder with enough characters"):
            with self.assertRaisesRegex(ValueError, "placeholder copy"):
                compiler["copy"]({"body": text}, "body", 30)

    def test_rejects_changed_cached_wxr(self):
        with TemporaryDirectory() as tmp:
            cache = Path(tmp)
            (cache / "test-template.xml").write_bytes(b"bad")
            candidate = {"slug": "test-template", "wxr_bytes": 3, "wxr_sha256": "0" * 64}
            with self.assertRaisesRegex(ValueError, "WXR digest"):
                compiler["source_layouts"](candidate, {}, cache)

    def test_listing_context_only_produces_evidenced_services(self):
        evidence = "https://example.test/confirmed-services"
        guide = "Share the make and model and ask the business which checks it performs and what it may need from you before booking."
        service = {"title": "Car A/C Service", "source": evidence,
                   "summary": "Compare the symptoms before calling to discuss an inspection.",
                   "description": guide}
        brief = {"sources": [evidence], "place": {"primaryType": "car_repair", "services": [service]}}
        self.assertEqual(compiler["plan_services"](brief)[0]["slug"], "car-a-c-service")
        service["source"] = "https://example.test/other"
        with self.assertRaisesRegex(ValueError, "source must be listed"):
            compiler["plan_services"](brief)
        with self.assertRaisesRegex(ValueError, "confirmed offerings"):
            compiler["plan_services"]({"place": {"primaryType": "car_repair"}})

    def test_outreach_requires_no_website_evidence_and_reply(self):
        now = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)
        brief = {
            "website_state": "absent", "website": None,
            "website_check": {"listing_url": "https://www.google.com/maps/place/Example",
                              "listing_website_absent": True, "official_site_found": False,
                              "checked_at": "2026-11-19T10:00:00Z", "search_query": "Example business Dubai"},
            "outreach": {"affirmative_reply": True},
        }
        compiler["verify_outreach"](brief, now)
        compiler["verify_website_absence"]({**brief, "outreach": {}}, now)
        with self.assertRaisesRegex(ValueError, "confirmed listing"):
            compiler["verify_outreach"]({**brief, "website_state": "unknown"}, now)
        with self.assertRaisesRegex(ValueError, "confirmed listing"):
            compiler["verify_outreach"]({**brief, "place": {"websiteUri": "https://example.test"}}, now)
        with self.assertRaisesRegex(ValueError, "confirmed listing"):
            compiler["verify_website_absence"]({**brief, "website_url": "https://example.test"}, now)
        for evidence in ({"official_site_found": True}, {"listing_website_absent": False}):
            with self.assertRaisesRegex(ValueError, "confirmed listing"):
                compiler["verify_website_absence"]({**brief, "website_check": {**brief["website_check"], **evidence}}, now)
        with self.assertRaisesRegex(ValueError, "Refresh"):
            compiler["verify_website_absence"](brief, datetime(2026, 11, 27, tzinfo=timezone.utc))
        with self.assertRaisesRegex(ValueError, "affirmative reply"):
            compiler["verify_outreach"]({**brief, "outreach": {}}, now)

    def test_unavailable_site_rechecks_domain_and_blocks_replacement(self):
        now = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)
        check = {"listing_url": "https://www.google.com/maps/place/Example", "search_query": "Example business Dubai",
                 "checked_at": "2026-11-19T10:00:00Z", "official_site_found": True, "working_replacement_found": False}
        brief = {"website_state": "unavailable", "website": "https://example.test/services", "website_check": check}
        calls = []
        verify = compiler["verify_website_eligibility"]
        verify(brief, now, calls.append)
        self.assertEqual(calls, ["example.test"])
        with self.assertRaisesRegex(ValueError, "replacement search"):
            verify({**brief, "website_check": {**check, "working_replacement_found": True}}, now, calls.append)
        with self.assertRaisesRegex(ValueError, "conflicting"):
            verify({**brief, "website_links": ["https://other.test/"]}, now, calls.append)
        with self.assertRaisesRegex(ValueError, "public website"):
            verify({**brief, "website": "http://127.0.0.1/"}, now, calls.append)
        def restored(host):
            raise ValueError("domain now resolves")
        with self.assertRaisesRegex(ValueError, "domain now resolves"):
            verify(brief, now, restored)

    def test_profile_accepts_google_embed_and_requires_approved_facts(self):
        url = "https://www.google.com/maps/place/Example"
        source = "https://example.test/info"
        facet = {"text": "No wheelchair-accessible entrance", "source": source, "confirmed_for_export": True}
        profile = {"listing_url": url, "map_embed_url": "https://www.google.com/maps/embed?pb=!1m1",
                   "details": {"accessibility": [facet]}}
        brief = {"locale": "en_US", "address": "Example location", "labels": {"directions": "Get directions"},
                 "sources": [source], "business_profile": profile}
        content, footer = compiler["profile_markup"](brief)
        self.assertIn(facet["text"], content)
        self.assertIn('loading="lazy"', footer)
        self.assertIn(url, footer)
        facet["confirmed_for_export"] = False
        with self.assertRaisesRegex(ValueError, "export approval"):
            compiler["profile_markup"](brief)
        facet["confirmed_for_export"] = True
        profile["map_embed_url"] = "https://example.test/maps/embed?pb=!1m1"
        with self.assertRaisesRegex(ValueError, "Share"):
            compiler["profile_markup"](brief)

    def test_service_requires_substantive_reviewed_sections(self):
        with self.assertRaisesRegex(ValueError, "expanded service"):
            compiler["service_detail_copy"](None, "Car Maintenance")
        with self.assertRaisesRegex(ValueError, "distinct"):
            compiler["service_detail_copy"](dict.fromkeys(compiler["SERVICE_TOPICS"], "sample copy " * 20), "Car Maintenance")
        partial = dict.fromkeys(("what", "why", "included", "when", "how", "who"), "service content " * 10)
        with self.assertRaisesRegex(ValueError, "deferral"):
            compiler["service_detail_copy"](partial, "Car Maintenance")

    def test_gallery_requires_attributed_review_permission_and_preserves_fallback(self):
        review = {"origin": "first_party", "redistribution_allowed": True, "reviewer": "Example customer",
                  "text": "The shop explained the estimate before starting.", "rating": 4,
                  "source": "https://example.test/feedback", "source_label": "Customer feedback"}
        fixture = {"locale": "en_US", "phone": "+971555555555", "labels": {"call": "Call now"},
                   "business_profile": {"listing_url": "https://www.google.com/maps/place/Example"}}
        config = {"heading": "A reviewed gallery", "intro": "Find approved photos and review links on the page below."}
        gallery = compiler["gallery_page"]
        blocks, _, links = gallery(config, fixture, None, [])
        self.assertEqual(set(links), {fixture["business_profile"]["listing_url"]})
        self.assertIn("Read customer reviews", dict(blocks)["reviews"])
        blocks, _, _ = gallery({**config, "reviews": [review]}, fixture, None, [])
        self.assertIn("4 out of 5 stars", dict(blocks)["reviews"])
        self.assertIn(review["reviewer"], dict(blocks)["reviews"])
        self.assertIn(review["source"], dict(blocks)["reviews"])
        with self.assertRaisesRegex(ValueError, "republication approval"):
            compiler["review_markup"]({**review, "origin": "google"}, None, False)
        links = [{"origin": "public_link", "reviewer": f"Reviewer {stars}",
                  "rating": stars, "source": f"https://www.google.com/maps/reviews/data={stars}",
                  "source_label": "Read on Google Maps"} for stars in (2, 3, 5, 4)]
        blocks, _, sources = gallery({**config, "reviews": links}, fixture, None, [])
        html = dict(blocks)["reviews"]
        self.assertEqual(html.count('class="wv-card wv-review"'), 3)
        self.assertLess(html.index("Reviewer 5"), html.index("Reviewer 4"))
        self.assertNotIn(links[0]["source"], sources)
        with self.assertRaisesRegex(ValueError, "verified excerpt"):
            compiler["review_markup"]({**links[0], "text": "Google review content"}, None, False)
        excerpt = {**links[0], "excerpt": "The finish looked like new.", "excerpt_verified": True}
        block, _ = compiler["review_markup"](excerpt, None, False)
        self.assertIn('The finish looked like new…</blockquote>', block)
        self.assertIn('Read full review on Google Maps', block)
        with self.assertRaisesRegex(ValueError, "original review"):
            compiler["review_markup"]({**excerpt, "excerpt_verified": False}, None, False)
        summary = {**links[0], "summary": "They described the at-home ceramic coating appointment.", "summary_verified": True}
        block, _ = compiler["review_markup"](summary, None, False)
        self.assertIn("Review summary", block)
        self.assertIn(summary["summary"], block)
        self.assertNotIn("<blockquote>", block)
        with self.assertRaisesRegex(ValueError, "original review"):
            compiler["review_markup"]({**summary, "summary_verified": False}, None, False)
        with self.assertRaisesRegex(ValueError, "actual business"):
            gallery(config, {**fixture, "business_profile": {**fixture["business_profile"],
                    "gallery": [{"origin": "licensed_illustration"}]}}, None, [])

    def test_elementor_uses_native_hero_and_testimonial_settings(self):
        digest = "a" * 64
        source = [("a1b2c3d", {"background": {"background_position": "center right",
                   "background_overlay_background": "gradient"}, "testimonial": {"testimonial_alignment": "left"}})]
        proof = {"section": 1, "reviews": [{"testimonial_name": "Example reviewer"}]}
        hero, = compiler["elementor_page"](source, [1], ["<p>Example</p>"], background=digest)
        self.assertEqual(hero["settings"]["background_image"]["url"], f"@@WV_IMAGE_{digest}@@")
        self.assertEqual(hero["settings"]["background_position"], "center right")
        self.assertEqual(hero["settings"]["background_overlay_background"], "gradient")
        testimonials, = compiler["elementor_page"](source, [1], ["<h2>Reviews</h2>"], proof=proof)
        heading, cards = testimonials["elements"]
        self.assertIn("<h2>Reviews</h2>", heading["settings"]["html"])
        widget = cards["elements"][0]
        self.assertEqual(widget["widgetType"], "testimonial")
        self.assertEqual(widget["settings"]["testimonial_alignment"], "left")

    def test_reviewed_service_draft_binds_exact_business_and_local_evidence(self):
        source = "https://example.test/services"
        prospect = {"name": "Example garage", "locale": "en_US", "locality": "Business Bay, Dubai",
                    "address": "Example Tower, Business Bay, Dubai", "sources": [source]}
        offering = {"slug": "car-maintenance", "title": "Car maintenance", "source": source,
                    "summary": "Routine vehicle maintenance.", "description": "Follow your vehicle’s schedule.",
                    "guidance": [{"source": source, "text": "Drivers should consider the scheduled mileage and time intervals."}],
                    "reviewed_draft": "maintenance.json"}
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            artifact = {"service_slug": offering["slug"], "reviewed": True, "detail": {"what": "Approved copy"},
                        "context_sha256": compiler["service_context_digest"](prospect, offering)}
            (folder / "maintenance.json").write_text(json.dumps(artifact), encoding="utf-8")
            compiler["apply_reviewed_service_draft"](prospect, offering, folder)
            self.assertEqual(offering["detail"], artifact["detail"])
            with self.assertRaisesRegex(ValueError, "exact locality"):
                compiler["apply_reviewed_service_draft"]({**prospect, "locality": "Another city"}, offering, folder)

    def test_flare_request_binds_reference_and_exact_model(self):
        request = media["make_request"](b"sample", "auto repair", "muted tones and tight framing")
        self.assertEqual(request["model"], "gpt-image-2.6-flare")
        self.assertEqual(request["images"], [{"image_url": "data:image/jpeg;base64,c2FtcGxl"}])
        self.assertEqual(request["n"], 1)
        self.assertIn("muted tones", request["prompt"])
        with self.assertRaisesRegex(ValueError, "cleared for redistribution"):
            compiler["prepare_photo"]({"origin": "google_places"}, Path("."))


if __name__ == "__main__":
    unittest.main()
