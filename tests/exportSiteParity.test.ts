import assert from "node:assert/strict";
import test from "node:test";
import { heroRefitScript, hoistFontImports } from "../src/lib/exportSiteParity";

test("hoistFontImports extracts a leading @import url() into a font link", () => {
  const input = "<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap');\nh1 { font-family: 'Poppins'; }</style>";
  const { fontLinks, cleanedHtml } = hoistFontImports(input);
  assert.deepEqual(fontLinks, ["https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap"]);
  assert.ok(!cleanedHtml.includes("@import"), "import statement must be removed");
  assert.ok(cleanedHtml.includes("h1 { font-family: 'Poppins'; }"), "other rules must survive");
});

test("hoistFontImports handles string-form imports and dedupes repeats", () => {
  const input = [
    "<style>@import url(\"https://example.com/a.css\");\n.a { color: red; }</style>",
    "<style>@import 'https://example.com/b.css';\n@import url(https://example.com/a.css);\n.b { color: blue; }</style>",
  ].join("\n");
  const { fontLinks, cleanedHtml } = hoistFontImports(input);
  assert.deepEqual(fontLinks, ["https://example.com/a.css", "https://example.com/b.css"]);
  assert.ok(!cleanedHtml.includes("@import"), "all plain imports must be removed");
  assert.ok(cleanedHtml.includes(".a { color: red; }") && cleanedHtml.includes(".b { color: blue; }"));
});

test("hoistFontImports leaves non-import CSS and media-query imports untouched", () => {
  const input = "<style>.x { color: red; }\n@import url(https://example.com/c.css) screen;\n.y { color: blue; }</style>";
  const { fontLinks, cleanedHtml } = hoistFontImports(input);
  assert.deepEqual(fontLinks, []);
  assert.equal(cleanedHtml, input);
});

test("heroRefitScript mirrors the live fitter caps and self-registers listeners", () => {
  const script = heroRefitScript();
  for (const marker of [
    "--wv-hero-heading-size",
    "[data-wv-hero-heading]",
    "[data-wv-page]",
    "(max-width: 640px)",
    "1.36",
    "1.62",
    "0.58",
    "maxLines = 3",
    "scheduleHeroRefit",
    "requestAnimationFrame",
    "addEventListener('resize'",
    "document.fonts",
  ]) {
    assert.ok(script.includes(marker), `refit script must contain ${marker}`);
  }
  assert.ok(!script.includes("${"), "refit script must not contain template placeholders (it is embedded via ${heroRefitScript()})");
});
