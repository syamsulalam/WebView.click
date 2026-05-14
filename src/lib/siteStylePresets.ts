export type SiteStylePreset = {
  id: string;
  label: string;
  industries: string[];
  mood: string;
  recommendedColors: string[];
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

export const siteStylePresetCss = `
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
`;
