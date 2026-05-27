# Font Pairing Guide

This file summarizes the supplied font-pairing article and records how WebView.click now turns those pairings into JSON-driven site style options.

## Summary from the article

- Pair one expressive font with one quieter readable font. Headlines can carry more personality; body copy must stay easy to scan.
- Strong display faces work best for short headings only. Examples: Bebas Neue, Archivo Black, Alfa Slab One, Monoton, Bangers, Abril Fatface.
- Script or handwritten fonts should usually be limited to headlines or accents. Examples: Lobster, Courgette, Sacramento, Permanent Marker.
- Serif plus sans-serif is a reliable contrast for professional, editorial, legal, finance, and premium local businesses.
- Same-family pairings are safer when the page needs consistency. Examples: IBM Plex variants or Roboto variants.
- The main failure mode is using two highly expressive fonts at once. One font should lead, the other should support.

## JSON Contract

Generated site JSON can now include:

```json
{
  "design": {
    "fontPairing": "bebas-source",
    "fontPairingConfig": {
      "label": "Bebas Neue + Source Sans Pro",
      "headingFont": "Bebas Neue",
      "bodyFont": "Source Sans Pro",
      "mood": "strong, condensed, direct",
      "allowedValues": ["bebas-source", "archivo-hind", "oswald-nunito"],
      "selectionMode": "stable_seeded_business_variant",
      "selectionRule": "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download."
    },
    "themeVariables": {
      "typography": {
        "headingFont": "'Bebas Neue', sans-serif",
        "bodyFont": "'Source Sans Pro', sans-serif"
      }
    }
  }
}
```

The renderer imports the active Google Fonts, applies heading/body typography, and shows a `Font style` selector in the shared download/setup panel. The exported HTML follows the currently selected pairing.

## Implemented Pairing Registry

The registry lives in `src/lib/fontPairings.ts` and includes the 30 pairings from the article:

Montserrat + Raleway, Lobster + Open Sans, Ubuntu + Nanum Gothic, Bebas Neue + Source Sans Pro, Arvo + Roboto, Monoton + Rubik, IBM Plex Sans + IBM Plex Sans Condensed, Courgette + Libre Baskerville, Roboto + Roboto Mono, Abril Fatface + Work Sans, Merriweather + Lora, Roboto Mono + Spectral, Oswald + Nunito, Permanent Marker + ABeeZee, Archivo Black + Hind, Gravitas One + Poppins, Alfa Slab One + Chivo, Architects Daughter + Abel, Fjalla One + Merriweather Sans, Rokkitt + Raleway, Poiret One + Didact Gothic, Bangers + Playfair Display, Ultra + Slabo, Francois One + Karla, Fugaz One + Lato, Bevan + Pontano Sans, Nixie One + Prompt, Sacramento + Barlow, Sansita + Overpass, and Vollkorn SC + PT Sans.

## Industry Mapping

- Contractors, concrete, construction, roofing, paving, masonry, auto, security: Bebas Neue + Source Sans Pro, Archivo Black + Hind, Oswald + Nunito, Fjalla One + Merriweather Sans, Alfa Slab One + Chivo.
- Legal, finance, accounting, insurance, consulting: Merriweather + Lora, Vollkorn SC + PT Sans, Gravitas One + Poppins, IBM Plex, Montserrat + Raleway.
- Clinics, dental, medical, wellness, cleaning, pool, repair: Nixie One + Prompt, Francois One + Karla, Arvo + Roboto, Poiret One + Didact Gothic.
- Cafe, restaurant, bakery, bar: Lobster + Open Sans, Ultra + Slabo, Abril Fatface + Work Sans, Courgette + Libre Baskerville.
- Fitness, gym, training, sports: Fugaz One + Lato, Monoton + Rubik, Bebas Neue + Source Sans Pro, Alfa Slab One + Chivo.
- Real estate, property, interior, architecture: Abril Fatface + Work Sans, Gravitas One + Poppins, Architects Daughter + Abel, Roboto Mono + Spectral.

## Notes for Generation

Generation picks `design.fontPairing` from an industry-appropriate group, then uses a stable business seed (`businessName`, `businessId`, Place ID, and address) to vary the selected pairing within that group. This keeps typography suitable for the industry while preventing same-category sites from all using the first matching font pair.

The selected value is persisted in site JSON. Refreshing or repairing a site does not reshuffle typography unless the site is regenerated from a path that rebuilds missing design metadata.
