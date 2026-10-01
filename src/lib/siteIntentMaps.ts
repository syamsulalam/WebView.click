// DOM-free design-intent → render decisions (PRD.md A1: every generated intent
// field must branch rendering). Tested in tests/siteIntentMaps.test.ts.
//
// P4 (PRD.md §13 D1–D4, D9–D10) derives the token values from
// nextlevelbuilder/ui-ux-pro-max-skill: a 4px-base primitive scale with
// semantic section tokens (sm 32 / md 48 / lg 64), responsive padding steps,
// a spacious/standard density dial, component spacing tokens, a modular type
// scale, and approved motion timings. The single table below feeds both the
// live renderer and the owner-zip export (which clones the live DOM), so
// export spacing parity holds by construction.

// Section spacing tokens: [vertical-mobile, vertical-md, vertical-lg].
// Horizontal padding steps px-4 → md:px-6 → lg:px-8 on every tier (D3).
const SECTION_SPACING_TOKENS = {
  sm: "py-8 md:py-12 px-4 md:px-6 lg:px-8",
  md: "py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8",
  lg: "py-16 md:py-24 lg:py-32 px-4 md:px-6 lg:px-8",
} as const;

type SectionSpacingToken = keyof typeof SECTION_SPACING_TOKENS;

const RHYTHM_BASE_TOKEN: Record<string, SectionSpacingToken> = {
  "compressed-urgent": "sm",
  "measured-authority": "md",
  "soft-premium": "lg",
  "spacious-premium": "lg",
  "editorial-warm": "md",
  "proof-forward": "md",
  "balanced-local": "md",
};

const TOKEN_ORDER: SectionSpacingToken[] = ["sm", "md", "lg"];

export function normalizeDensity(density: string): "spacious" | "standard" {
  return density === "standard" ? "standard" : "spacious";
}

// Every content section type resolves to a base token (D1). The hero keeps
// its bespoke full-viewport treatment and maps to no token.
const SECTION_TYPE_TOKEN: Record<string, SectionSpacingToken> = {
  trustBar: "sm",
  features: "md",
  offers: "md",
  services: "md",
  offerings: "md",
  offeringDetail: "md",
  gallery: "md",
  imageGallery: "md",
  testimonials: "md",
  reviews: "md",
  proof: "sm",
  about: "md",
  textImageBlock: "md",
  teamGrid: "md",
  gridCards: "md",
  faq: "md",
  contactForm: "md",
  hoursLocation: "md",
  finalCta: "lg",
  pricing: "md",
  areasServed: "sm",
  feedback: "md",
};

export function sectionTypeSpacingToken(sectionType: string): SectionSpacingToken {
  return SECTION_TYPE_TOKEN[sectionType] || "md";
}

function bumpToken(token: SectionSpacingToken, steps: number): SectionSpacingToken {
  const index = Math.max(0, Math.min(TOKEN_ORDER.length - 1, TOKEN_ORDER.indexOf(token) + steps));
  return TOKEN_ORDER[index];
}

// D1 + D2: content-section spacing from (section type, rhythm, density).
// Spacious (the owner-demo default) adds one tier of air; compressed-urgent
// always stays compact because urgency beats airiness, and
// measured-authority caps at md to keep its restrained feel.
export function sectionSpacingClass(sectionType: string, rhythm: string, density = "spacious"): string {
  const base = sectionTypeSpacingToken(sectionType);
  if (rhythm === "compressed-urgent") return SECTION_SPACING_TOKENS.sm;
  // measured-authority caps at md: spacious lifts sm bases to md, never to lg.
  if (rhythm === "measured-authority") {
    if (base === "lg") return SECTION_SPACING_TOKENS.md;
    if (normalizeDensity(density) === "spacious" && base === "sm") return SECTION_SPACING_TOKENS.md;
    return SECTION_SPACING_TOKENS[base];
  }
  const spacious = normalizeDensity(density) === "spacious";
  // A premium rhythm lifts one tier; spacious density lifts one tier only when
  // the rhythm did not already (total lift caps at lg inside bumpToken).
  const rhythmLift = (RHYTHM_BASE_TOKEN[rhythm] || "md") === "lg" ? 1 : 0;
  const densityLift = spacious && rhythmLift === 0 ? 1 : 0;
  return SECTION_SPACING_TOKENS[bumpToken(base, rhythmLift + densityLift)];
}

export function sectionRhythmPadClass(rhythm: string): string {
  return SECTION_SPACING_TOKENS[RHYTHM_BASE_TOKEN[rhythm] || "md"];
}

// D3 container rhythm: content (default reading width), narrow (forms,
// focused asks — matches the 600px conversion-form rule), wide (galleries,
// proof grids), full (edge-to-edge bands whose inner content still caps).
export function sectionContainerClass(kind: string): string {
  if (kind === "narrow") return "max-w-2xl mx-auto";
  if (kind === "wide") return "max-w-7xl mx-auto";
  if (kind === "full") return "w-full";
  return "max-w-6xl mx-auto";
}

// D4 component spacing tokens. Buttons: md for secondary/inline actions, lg
// for hero/final/sticky primary CTAs (py-3 clears the 44px thumb target with
// text). Cards carry p-6 + space-y-4 content rhythm; touch lists keep ≥8px
// gaps (gap-2 minimum between adjacent targets).
export function componentSpacingClass(component: string, size = "md"): string {
  if (component === "button") {
    return size === "lg" ? "px-6 py-3" : "px-4 py-2 text-sm";
  }
  if (component === "card") return size === "sm" ? "p-4" : "p-6";
  if (component === "badge") return "px-2.5 py-0.5";
  if (component === "input") return "px-3 py-2";
  if (component === "section-gap") return "gap-4 md:gap-6";
  if (component === "list-stack") return "space-y-4";
  return "";
}

export function ctaSizeClass(size: string): string {
  return componentSpacingClass("button", size === "lg" ? "lg" : "md");
}

// D9 modular type scale (12·14·16·18·24·32 steps): display for hero headlines,
// h1/h2 for section titles, body/body-lg for copy, small/caption for meta.
// Headings stay tight/snug; body copy stays 1.5–1.75 for readability.
const TYPE_SCALE = {
  display: "text-4xl md:text-6xl font-bold leading-tight",
  h1: "text-3xl md:text-4xl font-bold leading-tight",
  h2: "text-2xl md:text-3xl font-bold leading-snug",
  h3: "text-xl md:text-2xl font-semibold leading-snug",
  "body-lg": "text-lg md:text-xl leading-relaxed",
  body: "text-base leading-relaxed",
  small: "text-sm leading-normal",
  caption: "text-xs leading-normal",
} as const;

export function typeScaleClass(kind: string): string {
  return TYPE_SCALE[kind as keyof typeof TYPE_SCALE] || TYPE_SCALE.body;
}

// D10 approved motion timings (CSS-only; no animation runtime in the export).
// hover 150–200ms, cards 200–300ms, scroll reveal 300–400ms, stagger
// 250–350ms, page fade 200–300ms. subtle keeps hover/reveal, standard adds
// stagger, complex is opt-in only and never the default.
export const MOTION_TIMING = {
  hover: "150-200ms",
  card: "200-300ms",
  reveal: "300-400ms",
  stagger: "250-350ms",
  page: "200-300ms",
} as const;

export function motionTimingFor(level: string): string[] {
  if (level === "none") return [];
  if (level === "complex") return [MOTION_TIMING.hover, MOTION_TIMING.card, MOTION_TIMING.reveal, MOTION_TIMING.stagger, MOTION_TIMING.page];
  if (level === "standard") return [MOTION_TIMING.hover, MOTION_TIMING.card, MOTION_TIMING.reveal, MOTION_TIMING.stagger];
  return [MOTION_TIMING.hover, MOTION_TIMING.reveal];
}

export function detailLayoutGroup(layout: string): "rail" | "editorial" | "standard" {
  if (layout === "contact-rail" || layout === "booking-detail") return "rail";
  if (layout === "authority-detail" || layout === "consultation-detail" || layout === "menu-detail") return "editorial";
  return "standard";
}

export function motionLevelClass(level: string): string {
  if (level === "none") return "wv-motion-none";
  if (level === "subtle") return "wv-motion-subtle";
  return "";
}
