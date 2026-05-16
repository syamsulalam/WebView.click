export type SiteStylePreset = {
  id: string;
  label: string;
  industries: string[];
  mood: string;
  recommendedColors: string[];
  keywords: RegExp;
};

export type SiteVisualStyle = {
  id: string;
  label: string;
  description: string;
  bestFor: string[];
  keywords: RegExp;
};

export const siteStylePresets: SiteStylePreset[] = [
  {
    id: "local-clean",
    label: "Local Clean",
    industries: ["general local business"],
    mood: "clean, neutral, broadly applicable",
    recommendedColors: ["#111827", "#4F46E5", "#F8FAFC"],
    keywords: /./,
  },
  {
    id: "contractor-rugged",
    label: "Contractor Rugged",
    industries: ["concrete", "roofing", "construction", "HVAC", "plumbing", "electrical"],
    mood: "industrial, sturdy, high-trust",
    recommendedColors: ["#111827", "#F59E0B", "#F3F4F6"],
    keywords: /(contractor|concrete|roof|plumb|electric|hvac|construction|builder|remodel|flooring|paving|masonry|drywall|fence|garage|foundation)/i,
  },
  {
    id: "legal-authority",
    label: "Legal Authority",
    industries: ["law firm", "attorney", "notary", "tax", "accounting"],
    mood: "formal, authoritative, conservative",
    recommendedColors: ["#0F172A", "#B45309", "#F8FAFC"],
    keywords: /(law|attorney|legal|notary|immigration|tax|accountant|accounting|bookkeeping|paralegal)/i,
  },
  {
    id: "garden-organic",
    label: "Garden Organic",
    industries: ["landscaping", "lawn care", "tree service", "nursery", "florist"],
    mood: "organic, calm, outdoorsy",
    recommendedColors: ["#14532D", "#65A30D", "#F7FEE7"],
    keywords: /(landscap|garden|lawn|tree|nursery|florist|yard|irrigation|mulch|arborist)/i,
  },
  {
    id: "pool-aqua",
    label: "Pool Aqua",
    industries: ["pool cleaning", "pool builder", "spa", "aquatic service"],
    mood: "bright, clean, water-forward",
    recommendedColors: ["#075985", "#06B6D4", "#ECFEFF"],
    keywords: /(pool|spa|swimming|aquatic|hot tub|water feature)/i,
  },
  {
    id: "dental-clean",
    label: "Dental Clean",
    industries: ["dentist", "orthodontist", "clinic", "medical office"],
    mood: "clinical, calm, precise",
    recommendedColors: ["#0E7490", "#22D3EE", "#F8FAFC"],
    keywords: /(dentist|dental|orthodont|clinic|medical|doctor|chiropractor|therapy|health)/i,
  },
  {
    id: "cafe-warm",
    label: "Cafe Warm",
    industries: ["cafe", "coffee shop", "bakery", "restaurant"],
    mood: "warm, editorial, inviting",
    recommendedColors: ["#4E342E", "#FF7043", "#FAFAFA"],
    keywords: /(cafe|coffee|bakery|restaurant|bar|food|bistro|brunch|tea|pizza|taco|diner)/i,
  },
  {
    id: "auto-shop-steel",
    label: "Auto Shop Steel",
    industries: ["auto repair", "tire shop", "body shop", "detailing"],
    mood: "mechanical, direct, high-contrast",
    recommendedColors: ["#111827", "#DC2626", "#E5E7EB"],
    keywords: /(auto|mechanic|tire|body shop|detailing|transmission|brake|collision|car wash|oil change)/i,
  },
  {
    id: "salon-soft-luxe",
    label: "Salon Soft Luxe",
    industries: ["salon", "spa", "massage", "beauty", "nail studio"],
    mood: "soft, polished, premium",
    recommendedColors: ["#3F3F46", "#D946EF", "#FAFAFA"],
    keywords: /(salon|spa|massage|beauty|nail|lashes|brow|esthetician|hair)/i,
  },
  {
    id: "fitness-energy",
    label: "Fitness Energy",
    industries: ["gym", "personal trainer", "martial arts", "yoga"],
    mood: "energetic, bold, movement-driven",
    recommendedColors: ["#18181B", "#84CC16", "#F4F4F5"],
    keywords: /(gym|fitness|trainer|martial|boxing|yoga|pilates|crossfit|workout)/i,
  },
  {
    id: "real-estate-premium",
    label: "Real Estate Premium",
    industries: ["realtor", "property manager", "home staging"],
    mood: "spacious, premium, measured",
    recommendedColors: ["#1F2937", "#C084FC", "#F8FAFC"],
    keywords: /(real estate|realtor|property|broker|home staging|apartment|rental|mortgage)/i,
  },
  {
    id: "cleaning-fresh",
    label: "Cleaning Fresh",
    industries: ["cleaning", "janitorial", "maid service", "pressure washing"],
    mood: "fresh, bright, checklist-friendly",
    recommendedColors: ["#0F766E", "#38BDF8", "#F0FDFA"],
    keywords: /(cleaning|janitorial|maid|pressure washing|power washing|carpet clean|window clean)/i,
  },
  {
    id: "security-trust",
    label: "Security Trust",
    industries: ["locksmith", "security systems", "fire safety"],
    mood: "urgent, trustworthy, protective",
    recommendedColors: ["#111827", "#EAB308", "#F8FAFC"],
    keywords: /(locksmith|security|alarm|fire safety|surveillance|camera|access control)/i,
  },
  {
    id: "education-friendly",
    label: "Education Friendly",
    industries: ["tutoring", "preschool", "music school", "training center"],
    mood: "friendly, structured, approachable",
    recommendedColors: ["#1D4ED8", "#F97316", "#EFF6FF"],
    keywords: /(school|tutor|education|preschool|academy|music lesson|training|learning|child care|daycare)/i,
  },
  {
    id: "pet-care-friendly",
    label: "Pet Care Friendly",
    industries: ["veterinary", "grooming", "boarding", "pet training"],
    mood: "warm, friendly, service-oriented",
    recommendedColors: ["#78350F", "#F97316", "#FFF7ED"],
    keywords: /(pet|veterinary|vet|groom|boarding|dog|cat|animal|kennel)/i,
  },
  {
    id: "financial-trust",
    label: "Financial Trust",
    industries: ["insurance", "bookkeeping", "financial advisor", "mortgage broker"],
    mood: "stable, professional, confidence-building",
    recommendedColors: ["#0F172A", "#059669", "#F8FAFC"],
    keywords: /(insurance|financial|finance|bookkeeping|mortgage|loan|wealth|advisor|payroll)/i,
  },
];

export function normalizeStylePreset(value = "local-clean") {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return siteStylePresets.some((preset) => preset.id === normalized) ? normalized : "local-clean";
}

export function getStylePreset(value = "local-clean") {
  return siteStylePresets.find((preset) => preset.id === normalizeStylePreset(value)) || siteStylePresets[0];
}

export function inferStylePresetFromText(value: string) {
  const text = value.toLowerCase();
  return siteStylePresets.find((preset) => preset.id !== "local-clean" && preset.keywords.test(text))?.id || "local-clean";
}

export const siteVisualStyles: SiteVisualStyle[] = [
  {
    id: "soft-rounded",
    label: "Soft Rounded",
    description: "Friendly rounded cards and images with gentle shadows.",
    bestFor: ["cafes", "salons", "clinics", "education", "pet care"],
    keywords: /(cafe|coffee|salon|spa|beauty|clinic|dental|school|tutor|pet|vet|friendly|soft|warm)/i,
  },
  {
    id: "boxy-editorial",
    label: "Boxy Editorial",
    description: "Sharper rectangular cards, measured spacing, and magazine-like composition.",
    bestFor: ["legal", "financial", "real estate", "professional services"],
    keywords: /(law|legal|attorney|finance|financial|real estate|property|accounting|consulting|professional)/i,
  },
  {
    id: "industrial-diagonal",
    label: "Industrial Diagonal",
    description: "Boxy layout with diagonal image edges and stronger industrial shadows.",
    bestFor: ["contractors", "concrete", "roofing", "auto", "security"],
    keywords: /(contractor|concrete|roof|construction|builder|paving|masonry|auto|mechanic|security|locksmith|industrial)/i,
  },
  {
    id: "clean-minimal",
    label: "Clean Minimal",
    description: "Low radius, light borders, fewer heavy shadows, and a precise service-business feel.",
    bestFor: ["medical", "cleaning", "pool service", "B2B local services"],
    keywords: /(medical|doctor|cleaning|pool|service|repair|maintenance|fresh|minimal)/i,
  },
  {
    id: "bold-sport",
    label: "Bold Sport",
    description: "High contrast, tighter radius, stronger typography, and energetic motion cues.",
    bestFor: ["fitness", "gyms", "martial arts", "training"],
    keywords: /(gym|fitness|trainer|boxing|martial|crossfit|sport|energy)/i,
  },
];

export function normalizeVisualStyle(value = "soft-rounded") {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return siteVisualStyles.some((style) => style.id === normalized) ? normalized : "soft-rounded";
}

export function inferVisualStyleFromText(value: string) {
  const text = value.toLowerCase();
  return siteVisualStyles.find((style) => style.id !== "soft-rounded" && style.keywords.test(text))?.id || "soft-rounded";
}

export const siteStylePresetCss = `
  @property --wv-border-angle {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }

  [data-wv-site-canvas] {
    --wv-page-x: clamp(1.25rem, 4vw, 4.5rem);
    --wv-section-y: clamp(4.5rem, 8vw, 7.5rem);
    --wv-section-y-compact: clamp(2rem, 4vw, 4rem);
    --wv-content-max: 72rem;
    --wv-measure: 66ch;
    --wv-card-radius: 14px;
    --wv-image-radius: 18px;
    --wv-card-shadow: 0 18px 46px rgba(15, 23, 42, 0.10);
    --wv-lift-shadow: 0 26px 64px rgba(15, 23, 42, 0.16);
    --wv-focus-ring: rgba(79, 70, 229, 0.22);
    --wv-subtle-surface: var(--color-secondary);
    --wv-subtle-border: rgba(15, 23, 42, 0.12);
    --wv-gradient-primary: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    --wv-gradient-accent: linear-gradient(135deg, var(--color-accent), var(--color-secondary));
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  @supports (color: color-mix(in oklab, white, black)) {
    [data-wv-site-canvas] {
      --wv-focus-ring: color-mix(in oklab, var(--color-accent) 34%, transparent);
      --wv-subtle-surface: color-mix(in oklab, var(--color-secondary) 72%, white);
      --wv-subtle-border: color-mix(in oklab, var(--color-primary) 15%, transparent);
      --wv-gradient-primary: linear-gradient(135deg, var(--color-primary), color-mix(in oklab, var(--color-primary) 62%, var(--color-accent)));
      --wv-gradient-accent: linear-gradient(135deg, var(--color-accent), color-mix(in oklab, var(--color-accent) 58%, white));
    }
  }

  [data-wv-site-canvas] .tracking-tight {
    letter-spacing: 0;
  }

  [data-wv-site-canvas] main section {
    position: relative;
    overflow: clip;
    padding-block: var(--wv-section-y);
    padding-inline: var(--wv-page-x);
  }

  [data-wv-site-canvas] main section:is(.py-6) {
    padding-block: var(--wv-section-y-compact);
  }

  [data-wv-site-canvas] :where(.max-w-4xl, .max-w-5xl, .max-w-6xl) {
    width: min(var(--wv-content-max), 100%);
  }

  [data-wv-site-canvas] :where(h1, h2, h3) {
    letter-spacing: 0;
    text-wrap: balance;
  }

  [data-wv-site-canvas] :where(p, li) {
    text-wrap: pretty;
  }

  [data-wv-site-canvas] :where(h1) {
    font-size: clamp(2.65rem, 7vw, 5.9rem);
    line-height: 0.95;
  }

  [data-wv-site-canvas] :where(h2) {
    font-size: clamp(2rem, 4vw, 3.5rem);
    line-height: 1.02;
  }

  [data-wv-site-canvas] :where(h3) {
    font-size: clamp(1.125rem, 1.5vw, 1.45rem);
    line-height: 1.15;
  }

  [data-wv-site-canvas] :where(a, button) {
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease,
      background-color 180ms ease,
      color 180ms ease,
      opacity 180ms ease;
  }

  [data-wv-site-canvas] :where(a, button):focus-visible,
  [data-wv-site-canvas] :where(input, textarea, summary):focus-visible {
    outline: 3px solid var(--wv-focus-ring);
    outline-offset: 3px;
  }

  [data-wv-site-canvas] [data-wv-page] > section:first-child {
    min-block-size: min(820px, calc(100svh - 72px));
    display: grid;
    align-items: center;
  }

  @supports (height: 100dvh) {
    [data-wv-site-canvas] [data-wv-page] > section:first-child {
      min-block-size: min(820px, calc(100dvh - 72px));
    }
  }

  [data-wv-site-canvas] [data-wv-page] > section:first-child::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 14% 18%, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 28%),
      radial-gradient(circle at 84% 16%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 26%);
    opacity: 0.78;
  }

  [data-wv-site-canvas] [data-wv-page] > section:first-child > * {
    position: relative;
    z-index: 1;
  }

  [data-wv-site-canvas] :where(.shadow-sm, .shadow-md, .shadow-lg, .shadow-xl) {
    box-shadow: var(--wv-card-shadow);
  }

  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).border,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-sm,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-md,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-xl {
    position: relative;
    isolation: isolate;
    border-color: var(--wv-subtle-border);
    transition:
      transform 220ms ease,
      box-shadow 220ms ease,
      border-color 220ms ease,
      background-color 220ms ease;
  }

  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).border:hover,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-sm:hover,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-md:hover,
  [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).shadow-xl:hover {
    transform: translateY(-3px);
    box-shadow: var(--wv-lift-shadow);
  }

  @supports (color: color-mix(in oklab, white, black)) and (background: conic-gradient(from 0deg, red, blue)) and (mask: linear-gradient(#000 0 0)) {
    [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).border::before {
      content: "";
      position: absolute;
      inset: -1px;
      z-index: -1;
      padding: 1px;
      border-radius: inherit;
      background: conic-gradient(from var(--wv-border-angle, 0deg), transparent, color-mix(in oklab, var(--color-accent) 52%, white), transparent 35%);
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask-composite: exclude;
      opacity: 0;
      pointer-events: none;
      transition: opacity 220ms ease;
    }

    [data-wv-site-canvas] :where(.rounded-xl, .rounded-2xl, .rounded-3xl).border:hover::before {
      opacity: 1;
      animation: wv-border-orbit 3.8s linear infinite;
    }
  }

  [data-wv-site-canvas] img {
    transform-origin: center;
    transition: transform 700ms ease, filter 700ms ease;
  }

  [data-wv-site-canvas] [data-wv-image-role]:hover {
    transform: scale(1.035);
    filter: saturate(1.06) contrast(1.03);
  }

  [data-wv-site-canvas] a[class*="rounded"],
  [data-wv-site-canvas] button[class*="rounded"] {
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  }

  [data-wv-site-canvas] a[class*="rounded"]:hover,
  [data-wv-site-canvas] button[class*="rounded"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14);
  }

  [data-wv-site-canvas] :where(input, textarea) {
    transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
  }

  [data-wv-site-canvas] :where(input, textarea):focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 4px var(--wv-focus-ring);
  }

  @supports (content-visibility: auto) {
    [data-wv-site-canvas] main section:not(:first-child) {
      content-visibility: auto;
      contain-intrinsic-size: auto 720px;
    }
  }

  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      [data-wv-site-canvas] main section:not(:first-child) > * {
        animation: wv-section-rise both;
        animation-timeline: view();
        animation-range: entry 0% cover 24%;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-wv-site-canvas],
    [data-wv-site-canvas] *,
    [data-wv-site-canvas] *::before,
    [data-wv-site-canvas] *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }

  @keyframes wv-section-rise {
    from {
      opacity: 0.001;
      transform: translateY(26px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes wv-border-orbit {
    to {
      --wv-border-angle: 360deg;
    }
  }

  .wv-preset-local-clean {
    --wv-card-radius: 12px;
    --wv-card-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    --wv-image-radius: 16px;
  }

  .wv-preset-local-clean .shadow-sm,
  .wv-preset-local-clean .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-contractor-rugged {
    --wv-card-radius: 8px;
    --wv-card-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
    --wv-section-texture: linear-gradient(135deg, rgba(15,23,42,0.06), transparent 38%), repeating-linear-gradient(45deg, rgba(15,23,42,0.025) 0 1px, transparent 1px 12px);
  }

  .wv-preset-contractor-rugged section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-contractor-rugged .rounded-xl,
  .wv-preset-contractor-rugged .rounded-2xl,
  .wv-preset-contractor-rugged .rounded-3xl {
    border-radius: var(--wv-card-radius);
  }

  .wv-preset-contractor-rugged .shadow-sm,
  .wv-preset-contractor-rugged .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-legal-authority {
    --wv-card-radius: 6px;
    --wv-card-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
  }

  .wv-preset-legal-authority .rounded-xl,
  .wv-preset-legal-authority .rounded-2xl,
  .wv-preset-legal-authority .rounded-3xl {
    border-radius: var(--wv-card-radius);
  }

  .wv-preset-legal-authority h1,
  .wv-preset-legal-authority h2 {
    font-family: Georgia, "Times New Roman", serif;
  }

  .wv-preset-legal-authority .shadow-sm,
  .wv-preset-legal-authority .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-garden-organic {
    --wv-card-radius: 18px;
    --wv-card-shadow: 0 18px 42px rgba(22, 101, 52, 0.14);
    --wv-section-texture: radial-gradient(circle at 12% 8%, rgba(34,197,94,0.10), transparent 28%), linear-gradient(180deg, rgba(240,253,244,0.55), transparent 48%);
  }

  .wv-preset-garden-organic section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-garden-organic .rounded-xl,
  .wv-preset-garden-organic .rounded-2xl,
  .wv-preset-garden-organic .rounded-3xl {
    border-radius: var(--wv-card-radius);
  }

  .wv-preset-pool-aqua {
    --wv-card-shadow: 0 20px 48px rgba(14, 165, 233, 0.16);
    --wv-section-texture: linear-gradient(180deg, rgba(14,165,233,0.09), transparent 44%);
  }

  .wv-preset-pool-aqua section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-pool-aqua .border-slate-200 {
    border-color: rgba(14, 165, 233, 0.24);
  }

  .wv-preset-dental-clean {
    --wv-card-radius: 14px;
    --wv-card-shadow: 0 20px 55px rgba(6, 182, 212, 0.13);
  }

  .wv-preset-dental-clean .shadow-sm,
  .wv-preset-dental-clean .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-dental-clean section {
    background-image: linear-gradient(180deg, rgba(236, 254, 255, 0.55), transparent 44%);
  }

  .wv-preset-cafe-warm {
    --wv-card-radius: 16px;
    --wv-card-shadow: 0 22px 56px rgba(120, 53, 15, 0.16);
  }

  .wv-preset-cafe-warm .shadow-sm,
  .wv-preset-cafe-warm .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-cafe-warm img {
    filter: saturate(1.04) contrast(1.02);
  }

  .wv-preset-auto-shop-steel {
    --wv-card-radius: 8px;
    --wv-card-shadow: 0 22px 50px rgba(17, 24, 39, 0.20);
    --wv-section-texture: repeating-linear-gradient(135deg, rgba(17,24,39,0.04) 0 1px, transparent 1px 14px);
  }

  .wv-preset-auto-shop-steel section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-auto-shop-steel .shadow-sm,
  .wv-preset-auto-shop-steel .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-salon-soft-luxe {
    --wv-card-radius: 18px;
    --wv-card-shadow: 0 24px 60px rgba(168, 85, 247, 0.12);
  }

  .wv-preset-salon-soft-luxe .shadow-sm,
  .wv-preset-salon-soft-luxe .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-salon-soft-luxe .border-slate-200 {
    border-color: rgba(217, 70, 239, 0.18);
  }

  .wv-preset-fitness-energy {
    --wv-card-radius: 10px;
    --wv-card-shadow: 0 22px 48px rgba(24, 24, 27, 0.22);
    --wv-section-texture: linear-gradient(135deg, rgba(132, 204, 22, 0.10), transparent 36%);
  }

  .wv-preset-fitness-energy section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-real-estate-premium {
    --wv-card-radius: 10px;
    --wv-card-shadow: 0 24px 58px rgba(31, 41, 55, 0.14);
  }

  .wv-preset-real-estate-premium .shadow-sm,
  .wv-preset-real-estate-premium .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-cleaning-fresh {
    --wv-card-radius: 16px;
    --wv-card-shadow: 0 20px 50px rgba(20, 184, 166, 0.14);
    --wv-section-texture: linear-gradient(180deg, rgba(240, 253, 250, 0.8), transparent 48%);
  }

  .wv-preset-cleaning-fresh section {
    background-image: var(--wv-section-texture);
  }

  .wv-preset-security-trust {
    --wv-card-radius: 8px;
    --wv-card-shadow: 0 20px 46px rgba(15, 23, 42, 0.20);
  }

  .wv-preset-security-trust .shadow-sm,
  .wv-preset-security-trust .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-education-friendly {
    --wv-card-radius: 18px;
    --wv-card-shadow: 0 20px 50px rgba(37, 99, 235, 0.13);
  }

  .wv-preset-education-friendly .shadow-sm,
  .wv-preset-education-friendly .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-pet-care-friendly {
    --wv-card-radius: 18px;
    --wv-card-shadow: 0 20px 50px rgba(249, 115, 22, 0.14);
  }

  .wv-preset-pet-care-friendly .shadow-sm,
  .wv-preset-pet-care-friendly .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-preset-financial-trust {
    --wv-card-radius: 8px;
    --wv-card-shadow: 0 18px 44px rgba(15, 23, 42, 0.13);
  }

  .wv-preset-financial-trust .shadow-sm,
  .wv-preset-financial-trust .shadow-xl {
    box-shadow: var(--wv-card-shadow);
  }

  .wv-visual-soft-rounded {
    --wv-visual-radius: 18px;
    --wv-image-radius: 20px;
    --wv-visual-shadow: 0 20px 52px rgba(15, 23, 42, 0.12);
  }

  .wv-visual-soft-rounded .rounded-xl,
  .wv-visual-soft-rounded .rounded-2xl,
  .wv-visual-soft-rounded .rounded-3xl {
    border-radius: var(--wv-visual-radius);
  }

  .wv-visual-soft-rounded img {
    border-radius: var(--wv-image-radius);
  }

  [data-wv-site-canvas] [data-wv-image-role="logo"] {
    border-radius: 9999px !important;
    clip-path: none !important;
  }

  .wv-visual-boxy-editorial {
    --wv-visual-radius: 2px;
    --wv-image-radius: 0px;
    --wv-visual-shadow: 8px 8px 0 rgba(15, 23, 42, 0.10);
  }

  .wv-visual-boxy-editorial .rounded-lg,
  .wv-visual-boxy-editorial .rounded-xl,
  .wv-visual-boxy-editorial .rounded-2xl,
  .wv-visual-boxy-editorial .rounded-3xl {
    border-radius: var(--wv-visual-radius);
  }

  .wv-visual-boxy-editorial .shadow-sm,
  .wv-visual-boxy-editorial .shadow-lg,
  .wv-visual-boxy-editorial .shadow-xl {
    box-shadow: var(--wv-visual-shadow);
  }

  .wv-visual-boxy-editorial img {
    border-radius: var(--wv-image-radius);
  }

  .wv-visual-industrial-diagonal {
    --wv-visual-radius: 0px;
    --wv-image-radius: 0px;
    --wv-visual-shadow: 10px 10px 0 rgba(15, 23, 42, 0.18);
  }

  .wv-visual-industrial-diagonal .rounded-lg,
  .wv-visual-industrial-diagonal .rounded-xl,
  .wv-visual-industrial-diagonal .rounded-2xl,
  .wv-visual-industrial-diagonal .rounded-3xl {
    border-radius: var(--wv-visual-radius);
  }

  .wv-visual-industrial-diagonal .shadow-sm,
  .wv-visual-industrial-diagonal .shadow-lg,
  .wv-visual-industrial-diagonal .shadow-xl {
    box-shadow: var(--wv-visual-shadow);
  }

  .wv-visual-industrial-diagonal img {
    border-radius: 0;
    clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%);
  }

  .wv-visual-industrial-diagonal [data-wv-image-role] {
    outline: 3px solid rgba(15, 23, 42, 0.16);
    outline-offset: -3px;
  }

  .wv-visual-industrial-diagonal section:nth-of-type(even) {
    background-image: repeating-linear-gradient(135deg, rgba(15,23,42,0.04) 0 2px, transparent 2px 16px);
  }

  .wv-visual-clean-minimal {
    --wv-visual-radius: 6px;
    --wv-image-radius: 6px;
    --wv-visual-shadow: none;
  }

  .wv-visual-clean-minimal .rounded-xl,
  .wv-visual-clean-minimal .rounded-2xl,
  .wv-visual-clean-minimal .rounded-3xl {
    border-radius: var(--wv-visual-radius);
  }

  .wv-visual-clean-minimal .shadow-sm,
  .wv-visual-clean-minimal .shadow-lg,
  .wv-visual-clean-minimal .shadow-xl {
    box-shadow: var(--wv-visual-shadow);
  }

  .wv-visual-clean-minimal img {
    border-radius: var(--wv-image-radius);
  }

  .wv-visual-bold-sport {
    --wv-visual-radius: 10px;
    --wv-image-radius: 10px;
    --wv-visual-shadow: 0 24px 0 rgba(15, 23, 42, 0.12);
  }

  .wv-visual-bold-sport .rounded-xl,
  .wv-visual-bold-sport .rounded-2xl,
  .wv-visual-bold-sport .rounded-3xl {
    border-radius: var(--wv-visual-radius);
  }

  .wv-visual-bold-sport img {
    border-radius: var(--wv-image-radius);
    filter: contrast(1.06) saturate(1.08);
  }
`;
