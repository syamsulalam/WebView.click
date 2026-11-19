import importlib.util
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
        self.assertEqual(catalog.resolve_entry(slug, manifest)["wxr_bytes"], 123)
        self.assertIn("reason", catalog.resolve_entry("business-consulting-02", manifest))
        manifest[slug]["builder"] = "elementor"
        known, _ = catalog.load_requests()
        result = catalog.resolve_request(known["automotive"], manifest)
        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(result["candidates"], [])
        self.assertEqual(len(result["rejected"]), 2)

    def test_build_resolves_niche_and_rejects_unrelated_or_unreviewed_input(self):
        layouts = catalog.read_json(catalog.DATA / "smb-template-layouts.json")
        slug, layout = next(iter(layouts.items()))
        manifest = {slug: {
            "slug": slug, "builder": "gutenberg", "readiness": "qualified",
            "static_export_supported": True, "revision": layout["revision"],
            "file_hashes": {"wxr.xml": {"size": 123, "sha256": layout["wxr_sha256"]}},
        }}
        select = compiler["select_template"]
        candidate, _ = select({"category": {"raw": "auto repair"}}, manifest, layouts)
        self.assertEqual(candidate["slug"], slug)
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
