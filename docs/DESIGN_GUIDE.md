# DESIGN_GUIDE.md

## Purpose

This guide documents the generated-site visual system for WebView.click. It is meant for AI/vibe-coding workflows that need consistently polished local-business websites without leaking website aesthetics into WebView.click admin/demo tool UI.

Generated website CSS must be scoped to `[data-wv-site-canvas]`. WebView.click controls such as the edit button, download/setup/domain panel, demo inspector, admin UI, and prospecting tools must remain outside that selector path.

## Research Findings

- Use modern viewport units for first-screen composition. MDN documents that default `vh` maps to large viewport units and can obscure content under mobile browser UI; prefer `svh` with a `dvh` upgrade for heroes and full-screen blocks. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length
- Use `clamp()` for type and spacing tokens so generated pages scale fluidly without depending on a specific font pairing. MDN shows `clamp()` taking min/preferred/max values and using viewport-relative values while preserving readable bounds. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp
- Keep components container/layout aware rather than only viewport aware. MDN container-query guidance supports styling descendants based on container context; this informs our use of bounded content widths and component-safe spacing tokens even when the current renderer is mostly Tailwind-class based. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries
- Use `color-mix()` for palette-derived surfaces and borders, with base color fallbacks already supplied by JSON. MDN recommends perceptual spaces such as Oklab/Oklch for more even mixes. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix
- Animate only cheap properties for routine UI polish. web.dev warns that properties other than `transform` and `opacity` can trigger layout/paint and hurt smoothness. Source: https://web.dev/articles/animations-guide
- Gate motion behind `prefers-reduced-motion`. web.dev recommends serving animation only when the user has not requested reduced motion. Source: https://web.dev/articles/prefers-reduced-motion
- Use feature queries for newer CSS. MDN defines `@supports` for declarations that depend on browser support; this lets us layer `animation-timeline`, `content-visibility`, masks, and gradients without breaking older browsers. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@supports
- Use `content-visibility: auto` cautiously for offscreen generated sections. web.dev documents that it lets the browser skip rendering offscreen content and improve initial load/interaction performance. Source: https://web.dev/articles/content-visibility

## Implementation Rules

- Scope all generated-site enhancement CSS under `[data-wv-site-canvas]`.
- Keep WebView.click UI controls outside `[data-wv-site-canvas]`.
- Do not let font-pairing choices control layout quality. Use CSS variables, `clamp()`, and bounded measure instead of fixed font-specific dimensions.
- Avoid negative letter spacing. Generated headings and Tailwind `tracking-tight` inside the canvas are normalized to `letter-spacing: 0`.
- Use positive tracking only for small uppercase labels/eyebrows.
- Use `svh` first and `dvh` inside `@supports` for hero minimum heights.
- Prefer `transform`, `opacity`, `box-shadow`, `border-color`, and color transitions for interaction states.
- Put scroll/view animations behind `@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`.
- Use `@supports` around advanced effects such as mask-based animated borders.
- Preserve readable text widths with a measure token around `60-70ch`.

## Current Generated-Site Layer

The renderer uses:

- `#rendered-site`: shared CSS variable host for the active generated site palette.
- `[data-wv-site-canvas]`: actual generated website canvas. Preset classes such as `wv-preset-cafe-warm` and visual classes such as `wv-visual-soft-rounded` live here.
- WebView.click controls remain siblings of `[data-wv-site-canvas]` inside `#rendered-site`, so generated-site CSS does not style them.

The CSS lives in `src/lib/siteStylePresets.ts` as `siteStylePresetCss` and is injected by `src/components/SiteRenderer.tsx`, so it applies to `/demo`, `/:businessId`, and exported owner HTML.

## Visual Tokens

- `--wv-page-x`: responsive page gutter.
- `--wv-section-y`: responsive vertical section rhythm.
- `--wv-section-y-compact`: compact rhythm for trust bars and short bands.
- `--wv-content-max`: max content width.
- `--wv-measure`: readable paragraph measure.
- `--wv-card-shadow` and `--wv-lift-shadow`: default and hover elevation.
- `--wv-focus-ring`: palette-derived focus ring.
- `--wv-subtle-border`: palette-derived border color.

## Debug Checklist

- If WebView.click tool UI looks affected, confirm the affected element is not inside `[data-wv-site-canvas]`.
- If a generated hero is cropped on mobile, inspect `svh/dvh` support and the sticky header height assumption.
- If animation feels excessive, test with reduced motion enabled and inspect only `transform`/`opacity` animations.
- If a card border effect does not show, check browser support for `conic-gradient`, `mask`, and `@property`; the design should still work without the enhanced border.
