# SHADERS_GUIDE.md

## Purpose

This guide documents how WebView.click uses shader-like visual effects for generated websites. The goal is to make local-business websites feel more custom and premium while still exporting as a single static HTML file with no build step, no npm package, and no external shader runtime.

## Research Findings

- Real shaders normally mean GPU programs. MDN explains that vertex shaders position geometry and fragment shaders calculate RGBA color per pixel; WebGL shader code is GLSL compiled from JavaScript. Source: https://developer.mozilla.org/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders
- Raw WebGL is possible without libraries, but it requires canvas setup, shader compilation, program linking, and error handling. MDN’s WebGL tutorial shows `createShader`, `shaderSource`, `compileShader`, and `getShaderParameter` as the minimum setup path. Source: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
- CSS gradients can produce shader-like procedural fields without WebGL. MDN documents linear, radial, repeating, and conic gradients, including stacked conic/radial gradients with transparent colors and blend modes. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Images/Using_gradients
- `backdrop-filter`, filters, blend modes, and masks can add visual depth, but they create new rendering boundaries and have compatibility/performance considerations. Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter
- For performance, web.dev recommends keeping animation on `transform` and `opacity` where possible, and avoiding layout/paint-heavy animation for smoothness. Source: https://web.dev/articles/animations-guide
- CSS transitions and animation should respect reduced motion; web.dev recommends using `prefers-reduced-motion` and avoiding broad `transition: all`. Source: https://web.dev/learn/css/transitions/

## Decision

WebView.click uses CSS procedural shaders, not WebGL fragment shaders, for generated client websites.

Reasons:
- Works in exported `index.html` without external dependencies.
- Keeps file size small.
- Degrades cleanly if a browser lacks a newer CSS feature.
- Does not require canvas bitmap serialization during export.
- Easier to scope to `[data-wv-site-canvas]` so WebView.click tool UI is not affected.

The implementation still uses tiny JavaScript: a pointer tracker updates CSS variables `--wv-pointer-x` and `--wv-pointer-y`. The shader remains CSS-driven and works even if JS does not run.

## JSON Shape

Generated sites can define:

```json
{
  "design": {
    "shaderPreset": "cafe-heat",
    "shaderConfig": {
      "preset": "cafe-heat",
      "label": "Cafe Heat",
      "description": "Warm roast-like glow and gentle grain for cafes, bakeries, restaurants, and food brands.",
      "defaultOpacity": 0.26,
      "defaultMotion": 0.45,
      "allowedValues": [
        "none",
        "local-aurora",
        "industrial-grid",
        "aqua-caustics",
        "organic-dapple",
        "cafe-heat",
        "salon-silk",
        "fitness-pulse",
        "legal-vellum",
        "property-depth"
      ],
      "selectionRule": "Choose a lightweight CSS procedural shader that matches the industry mood. Use none for maximum restraint."
    }
  }
}
```

Renderer behavior:
- `design.shaderPreset` chooses the CSS class `wv-shader-{id}`.
- `design.shaderConfig.opacity` may override opacity, clamped by the renderer.
- `design.shaderConfig.motion` may override pointer/motion strength, clamped by the renderer.
- Missing shader data falls back to `local-aurora`.

## Presets

| Preset | Best For | Effect |
|---|---|---|
| `none` | Maximum restraint, older devices | No shader layer |
| `local-aurora` | General local, education, pet care | Soft palette clouds |
| `industrial-grid` | Contractors, auto, security, trades | Diagonal/grid energy |
| `aqua-caustics` | Pool, cleaning, dental, water services | Light refraction bands |
| `organic-dapple` | Landscaping, garden, tree, florist | Leafy dappled light |
| `cafe-heat` | Cafe, bakery, restaurant, food | Warm roast glow and grain |
| `salon-silk` | Salon, spa, beauty | Satin-like flowing bands |
| `fitness-pulse` | Gym, training, sports | High-contrast energetic pulse |
| `legal-vellum` | Legal, finance, accounting | Paper grain and authority lines |
| `property-depth` | Real estate, property, staging | Premium depth gradients |

## Implementation

Files:
- `src/lib/siteStylePresets.ts`: shader registry, inference helpers, and CSS shader classes.
- `src/components/SiteRenderer.tsx`: reads JSON shader variables, applies `wv-shader-*`, renders `[data-wv-site-shader]`, and updates pointer CSS variables.
- `src/lib/exportSiteHtml.ts`: adds the same pointer-variable script to exported owner HTML.
- `src/pages/admin/AdminLeads.tsx` and `src/pages/admin/AdminSites.tsx`: infer shader preset into newly generated fallback JSON.
- `functions/api/[[path]].ts`: backfills shader config during `POST /api/sites/generate` if older submitted JSON lacks shader variables.

CSS boundary:
- Shader CSS is scoped under `[data-wv-site-canvas]`.
- The shader element is `<div data-wv-site-shader="true" aria-hidden="true" />`.
- Tool UI must stay outside `[data-wv-site-canvas]`.

## Performance Rules

- Animate shader layers with `transform`, `scale`, `rotate`, and `opacity`.
- Keep opacity below `0.5`; most presets default around `0.18-0.28`.
- Respect `prefers-reduced-motion`; existing generated-site CSS collapses motion for reduced-motion users.
- Avoid WebGL unless a future paid/pro mode specifically needs it.
- Use `none` for conservative industries or when performance matters more than ambience.

## Debug Checklist

- If the shader is missing, inspect `design.shaderPreset` and the `wv-shader-*` class on `[data-wv-site-canvas]`.
- If the shader affects the download/setup panel, the panel has accidentally been placed inside `[data-wv-site-canvas]`.
- If the exported HTML has no pointer response, check `ownerInlineScript()` in `src/lib/exportSiteHtml.ts`.
- If a browser does not support `color-mix()`, the fallback shader gradients still render with neutral colors.
