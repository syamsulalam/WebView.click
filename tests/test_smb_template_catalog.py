import importlib.util
from runpy import run_path
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "resolve-smb-template.py"
spec = importlib.util.spec_from_file_location("resolve_smb_template", SCRIPT)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
compiler = run_path(str(SCRIPT.parent / "compile-smb-site.py"))


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


if __name__ == "__main__":
    unittest.main()
