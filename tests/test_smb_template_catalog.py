import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "resolve-smb-template.py"
spec = importlib.util.spec_from_file_location("resolve_smb_template", SCRIPT)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


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


if __name__ == "__main__":
    unittest.main()
