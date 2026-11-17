#!/usr/bin/env python3
"""
test_enrich_brand.py

Unit regression tests for enrich-business-brand.py:
1. Test luminance & WCAG contrast formulas against WCAG specifications.
2. Test 9-slot Astra palette synthesis (Slot 5 strictly #ffffff, Slots 4/7 light surfaces, Slots 2/3 text >= 7:1).
3. Test uniform border-connected flood fill on a synthetic test logo with enclosed letter counters (like 'O' or 'A').
"""

import os
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))
import importlib

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))
enrich = importlib.import_module("enrich-business-brand")

calculate_relative_luminance = enrich.calculate_relative_luminance
calculate_wcag_contrast = enrich.calculate_wcag_contrast
synthesize_astra_palette = enrich.synthesize_astra_palette
remove_background_pillow_floodfill = enrich.remove_background_pillow_floodfill
NEUTRAL_FALLBACK_PALETTE = enrich.NEUTRAL_FALLBACK_PALETTE
hex_to_rgb = enrich.hex_to_rgb

class TestBrandEnrichment(unittest.TestCase):
    def test_relative_luminance_and_contrast(self):
        # Pure black vs pure white contrast is exactly 21.0
        contrast = calculate_wcag_contrast("#ffffff", "#000000")
        self.assertAlmostEqual(contrast, 21.0, places=1)

        # White luminance is 1.0
        r, g, b = hex_to_rgb("#ffffff")
        self.assertAlmostEqual(calculate_relative_luminance(r, g, b), 1.0, places=2)

        # Black luminance is 0.0
        r, g, b = hex_to_rgb("#000000")
        self.assertAlmostEqual(calculate_relative_luminance(r, g, b), 0.0, places=2)

    def test_palette_contract_invariants(self):
        # Provide sample dominant colors
        colors = [
            ("#1d4ed8", 5000), # Deep blue
            ("#f8fafc", 3000), # Light slate
            ("#0f172a", 2000), # Dark slate
        ]
        palette, source = synthesize_astra_palette(colors)
        self.assertEqual(len(palette), 9)
        self.assertEqual(source, "photo-kmeans")

        # Invariant 1: Slot 5 must be strictly #ffffff
        self.assertEqual(palette[5].lower(), "#ffffff")

        # Invariant 2: Slots 4 and 7 must be light
        r4, g4, b4 = hex_to_rgb(palette[4])
        r7, g7, b7 = hex_to_rgb(palette[7])
        self.assertGreaterEqual(calculate_relative_luminance(r4, g4, b4), 0.88)
        self.assertGreaterEqual(calculate_relative_luminance(r7, g7, b7), 0.80)

        # Invariant 3: Slots 2 and 3 must have text contrast >= 7:1 against 4 and 5
        for text_slot in (2, 3):
            for surf_slot in (4, 5):
                contrast = calculate_wcag_contrast(palette[text_slot], palette[surf_slot])
                self.assertGreaterEqual(contrast, 7.0)

    def test_pillow_boundary_floodfill_preserves_internal_counters(self):
        # Create a synthetic 120x120 logo on a solid white background (#ffffff)
        # with a dark blue circular ring and a white inner donut hole
        with tempfile.TemporaryDirectory() as tmpdir:
            test_img_path = os.path.join(tmpdir, "logo_with_hole.png")
            out_img_path = os.path.join(tmpdir, "logo_transparent.png")

            img = Image.new("RGB", (120, 120), color=(255, 255, 255))
            draw = ImageDraw.Draw(img)
            # Outer dark blue circle (radius 40, center 60,60)
            draw.ellipse([20, 20, 100, 100], fill=(20, 50, 180))
            # Inner white hole (radius 20, center 60,60) representing letter counter 'O'
            draw.ellipse([40, 40, 80, 80], fill=(255, 255, 255))
            img.save(test_img_path)

            # Process background removal
            success = remove_background_pillow_floodfill(test_img_path, out_img_path)
            self.assertTrue(success, "Pillow flood fill should succeed on uniform edge")

            # Verify transparency:
            with Image.open(out_img_path) as res:
                self.assertEqual(res.mode, "RGBA")
                pixels = res.load()
                # Because the image was autocropped to bbox (20, 20, 100, 100), width=80, height=80:
                # 1. Corner (0, 0) should be transparent (alpha = 0) outside circle
                self.assertEqual(pixels[0, 0][3], 0, "Outer background must be transparent")
                # 2. Ring pixel (5, 40) should be opaque blue (alpha = 255)
                self.assertEqual(pixels[5, 40][3], 255, "Brand foreground must be opaque")
                # 3. Inner hole pixel (40, 40) should REMAIN WHITE OPAQUE (not erased by border flood-fill!)
                self.assertEqual(pixels[40, 40][3], 255, "Enclosed inner counter must remain preserved")
                self.assertEqual(pixels[40, 40][:3], (255, 255, 255))

if __name__ == "__main__":
    unittest.main()
