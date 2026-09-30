// DOM-free owner-export parity helpers (PRD.md A4: export must match preview).
// Kept dependency-free like generatedSitePostProcess.ts so fixture tests can import
// this module in Node without jsdom. Tested in tests/exportSiteParity.test.ts.

export function hoistFontImports(styleTagsHtml: string): { fontLinks: string[]; cleanedHtml: string } {
  const fontLinks: string[] = [];
  const seen = new Set<string>();
  // Handles `@import url('...');`, `@import url("...");`, `@import url(...);`,
  // and `@import '...';` / `@import "...";`. Forms with media queries
  // (`@import url(...) screen;`) are intentionally left in place.
  const cleanedHtml = String(styleTagsHtml || "").replace(
    /@import\s+(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*;/g,
    (_match, urlFromFn: string, urlFromString: string) => {
      const url = String(urlFromFn || urlFromString || "").trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        fontLinks.push(url);
      }
      return "";
    },
  );
  return { fontLinks, cleanedHtml };
}

// Static-file mirror of the live hero fitter in SiteRenderer.tsx (same caps:
// max 3 lines, 1.36x mobile / 1.62x desktop growth, 0.58x shrink floor).
// Export bakes `--wv-hero-heading-size` for the admin viewport as a no-JS
// fallback; this routine recomputes it per viewport on load, resize, font
// swap, and tab activation. Returned source is embedded into ownerInlineScript.
export function heroRefitScript(): string {
  return [
    "var wvHeroRefitFrame = null;",
    "function refitHeroHeadings() {",
    "  var maxLines = 3;",
    "  var isMobile = window.matchMedia('(max-width: 640px)').matches;",
    "  var maxScale = isMobile ? 1.36 : 1.62;",
    "  Array.prototype.slice.call(document.querySelectorAll('[data-wv-hero-heading]')).forEach(function (heading) {",
    "    var page = heading.closest ? heading.closest('[data-wv-page]') : null;",
    "    if (page && page.classList.contains('hidden')) return;",
    "    heading.style.removeProperty('--wv-hero-heading-size');",
    "    var computed = window.getComputedStyle(heading);",
    "    var base = parseFloat(computed.fontSize) || 56;",
    "    var lineHeight = parseFloat(computed.lineHeight);",
    "    if (!isFinite(lineHeight)) lineHeight = base * 0.98;",
    "    var limitFor = function (px) { return (lineHeight * px / base) * maxLines + 6; };",
    "    var fits = function (px) {",
    "      heading.style.setProperty('--wv-hero-heading-size', px.toFixed(2) + 'px');",
    "      return heading.scrollHeight <= limitFor(px);",
    "    };",
    "    if (fits(base * maxScale)) return;",
    "    var low = base * 0.58, high = base;",
    "    if (!fits(low)) return;",
    "    for (var i = 0; i < 10; i += 1) {",
    "      var mid = (low + high) / 2;",
    "      if (fits(mid)) { low = mid; } else { high = mid; }",
    "    }",
    "    heading.style.setProperty('--wv-hero-heading-size', low.toFixed(2) + 'px');",
    "  });",
    "}",
    "function scheduleHeroRefit() {",
    "  if (wvHeroRefitFrame) window.cancelAnimationFrame(wvHeroRefitFrame);",
    "  wvHeroRefitFrame = window.requestAnimationFrame(function () { wvHeroRefitFrame = null; refitHeroHeadings(); });",
    "}",
    "window.addEventListener('resize', scheduleHeroRefit);",
    "if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {",
    "  document.fonts.ready.then(function () { scheduleHeroRefit(); });",
    "}",
  ].join("\n");
}
