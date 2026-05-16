import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, Database, FileText, Globe2, MapPin, Play, RefreshCw, RotateCw, Search, Sparkles, X } from "lucide-react";
import { aiModelPrices } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { getStylePreset, inferStylePresetFromText, inferVisualStyleFromText, siteVisualStyles } from "../../lib/siteStylePresets";
import { fontPairingsForText, getFontPairing, inferFontPairingFromText } from "../../lib/fontPairings";

type SiteRow = {
  id: string;
  businessId: string;
  businessName: string;
  niche?: string;
  language?: string;
  region?: string;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
  previewUrl: string;
  googleMapsUrl?: string;
  r2JsonUrl?: string;
  storageMode?: "r2" | "legacy_d1";
  generatedWithAi?: boolean;
  generationMode?: string;
  aiProvider?: string;
  aiModel?: string;
};

type RegenerateMode = "resave" | "ai";

function generationBadge(site: SiteRow) {
  if (site.generationMode === "ai_copy_patch" || site.generatedWithAi) {
    return {
      label: "AI Copy Patch",
      title: `Copy was enriched by AI${site.aiProvider ? ` via ${site.aiProvider}` : ""}${site.aiModel ? ` / ${site.aiModel}` : ""}. Structure and protected fields stayed deterministic.`,
      className: "bg-indigo-100 text-indigo-800",
    };
  }
  if (site.generationMode === "google_places_fallback" || site.generationMode === "submitted_json_ai_fallback") {
    return {
      label: "Fallback Only",
      title: "Site was built from gathered Google data/scaffold without a successful AI copy patch.",
      className: "bg-slate-100 text-slate-700",
    };
  }
  return {
    label: site.generationMode || "Unknown Mode",
    title: "Generation mode metadata is missing or from an older site row.",
    className: "bg-amber-100 text-amber-800",
  };
}

const providerApiKeyMap: Record<string, string> = {
  OpenRouter: "OPENROUTER_API_KEY",
  OpenAI: "OPENAI_API_KEY",
  Gemini: "GEMINI_API_KEY",
  KIE: "KIE_API_KEY",
  Opencode: "OPENCODE_API_KEY",
};

type ProspectRow = {
  place_id: string;
  name: string;
  formatted_address?: string;
  formattedAddress?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  nationalPhoneNumber?: string;
  website?: string;
  websiteUri?: string;
  url?: string;
  googleMapsUri?: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  userRatingCount?: number | null;
  types?: string[];
  photos?: any[];
  selectedPhoto?: {
    url?: string;
    reference?: string;
    attributions?: string[];
    priorityLabel?: string;
    source?: string;
  };
  selectedPalette?: string[];
  paletteOptions?: any[];
  updatedAt?: string;
  detailsLoadedAt?: string;
  generatedBusinessId?: string;
};

function gatheredSnapshot(siteData: any) {
  return {
    sourceData: siteData?.sourceData || {},
    businessProfile: siteData?.businessProfile || {},
    location: siteData?.location || {},
    hours: siteData?.hours || {},
    trust: siteData?.trust || {},
    brand: siteData?.brand || {},
    productServiceStrategy: siteData?.productServiceStrategy || {},
    products: Array.isArray(siteData?.products) ? siteData.products : [],
    services: Array.isArray(siteData?.services) ? siteData.services : [],
  };
}

function businessSlug(name: string, placeId = "") {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
  const suffix = placeId.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-6);
  return suffix ? `${slug}-${suffix}` : slug;
}

function isPlaceholderPhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return !digits || /^0+$/.test(digits);
}

function prospectPhone(prospect: ProspectRow) {
  const phone = prospect.formatted_phone_number || prospect.international_phone_number || prospect.nationalPhoneNumber || "";
  return isPlaceholderPhone(phone) ? "" : phone;
}

function photoReference(photo: any) {
  return String(photo?.photo_reference || photo?.name || photo?.reference || "");
}

function photoAttributions(photo: any) {
  if (Array.isArray(photo?.html_attributions)) {
    return photo.html_attributions.map((value: string) => String(value).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  }
  if (Array.isArray(photo?.authorAttributions)) {
    return photo.authorAttributions.map((item: any) => item?.displayName || item?.uri || item?.photoUri || "").filter(Boolean);
  }
  return [];
}

function inferLanguage(place: any) {
  const text = `${place.formatted_address || place.formattedAddress || ""} ${place.adr_address || ""}`.toLowerCase();
  if (text.includes("indonesia") || text.includes(" jakarta") || text.includes(" jawa ") || text.includes(" bali")) {
    return { language: "id", region: "ID" };
  }
  return { language: "en", region: "US" };
}

function meaningfulType(place: any) {
  const types = Array.isArray(place.types) ? place.types : [];
  return types.find((type: string) => !["establishment", "point_of_interest"].includes(type)) || types[0] || "local business";
}

function toTitleCase(value = "") {
  const stopWords = new Set(["and", "or", "for", "of", "the", "a", "an", "to", "in", "on", "at", "by", "with"]);
  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && stopWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function inferServiceArea(address = "", fallback = "the local area") {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const usStatePattern = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;
  const usCity = parts.find((part, index) => index > 0 && !usStatePattern.test(part) && !/\bUSA\b/i.test(part));
  if (usCity) return `${usCity}-area`;
  const idCity = parts.find((part) => /jakarta|bandung|surabaya|denpasar|medan|bekasi|tangerang|bogor|semarang|yogyakarta/i.test(part));
  if (idCity) return `area ${idCity}`;
  return parts.length > 1 ? `${parts[parts.length - 2]} area` : fallback;
}

function industryCopyProfile({
  businessName,
  nicheText,
  typeLabel,
  serviceArea,
  phone,
  isEnglish,
}: {
  businessName: string;
  nicheText: string;
  typeLabel: string;
  serviceArea: string;
  phone: string;
  isEnglish: boolean;
}) {
  const lower = nicheText.toLowerCase();
  const directContact = phone
    ? (isEnglish ? `Visitors can call ${phone} directly.` : `Pengunjung bisa langsung menelepon ${phone}.`)
    : (isEnglish ? "Contact details can be completed by admin." : "Detail kontak bisa dilengkapi admin.");
  const base = {
    serviceTitle: isEnglish ? `${typeLabel} Services` : `Layanan ${typeLabel}`,
    consultationTitle: isEnglish ? "Fast Consultation" : "Konsultasi Cepat",
    summary: isEnglish ? `Local ${typeLabel} help from ${businessName}.` : `Bantuan ${typeLabel} lokal dari ${businessName}.`,
    description: isEnglish
      ? `This page turns gathered Google Business Profile data into a clearer service page so visitors understand what ${businessName} can help with before they call, visit, or request details.`
      : `Halaman ini mengubah data Google Business Profile menjadi halaman layanan yang lebih jelas agar pengunjung memahami bantuan yang ditawarkan ${businessName}.`,
    bestFor: isEnglish ? ["Local customers", "Fast inquiry", "Custom needs"] : ["Pelanggan lokal", "Pertanyaan cepat", "Kebutuhan khusus"],
    included: isEnglish ? ["Initial consultation", "Clear next steps", "Local support"] : ["Konsultasi awal", "Langkah berikutnya jelas", "Dukungan lokal"],
    highlights: [
      { title: isEnglish ? "Local Context" : "Konteks Lokal", description: isEnglish ? `Built around customer intent in the ${serviceArea}.` : `Disusun untuk kebutuhan pelanggan di ${serviceArea}.` },
      { title: isEnglish ? "Easy Next Step" : "Langkah Mudah", description: directContact },
    ],
    detailFeatures: [
      { title: isEnglish ? "Clear Fit" : "Kebutuhan Jelas", description: isEnglish ? "Visitors can quickly understand whether this service matches their need." : "Pengunjung bisa cepat memahami apakah layanan ini cocok untuk kebutuhan mereka." },
      { title: isEnglish ? "Local Context" : "Konteks Lokal", description: serviceArea },
      { title: isEnglish ? "Simple Contact" : "Kontak Sederhana", description: directContact },
    ],
    shortPitch: isEnglish ? `A trusted local business serving customers in the ${serviceArea}.` : `Bisnis lokal terpercaya yang melayani pelanggan di ${serviceArea}.`,
    homeFeatureTitle: isEnglish ? "Service Positioning" : "Posisi Layanan",
    homeFeatureDescription: isEnglish ? "The page expands a Google profile into clearer customer-facing service content." : "Halaman ini mengubah profil Google menjadi konten layanan yang lebih jelas.",
    consultationSummary: isEnglish ? "Ask questions and get clear next steps." : "Tanyakan kebutuhan dan dapatkan langkah berikutnya.",
    consultationDescription: isEnglish ? "Useful for visitors who need availability, pricing, and timing before booking or visiting." : "Berguna untuk pengunjung yang ingin tahu ketersediaan, harga, dan waktu sebelum datang atau booking.",
    consultationBestFor: isEnglish ? ["Price questions", "Availability", "Planning"] : ["Pertanyaan harga", "Ketersediaan", "Perencanaan"],
    consultationIncluded: isEnglish ? ["Question intake", "Basic recommendation", "Contact handoff"] : ["Input pertanyaan", "Rekomendasi dasar", "Arahan kontak"],
    consultationHighlightTitle: isEnglish ? "Low Friction" : "Mudah Dihubungi",
  };

  if (/concrete|foundation|slab|driveway|patio|walkway|garage|general contractor|construction|roof|paving|masonry/i.test(lower)) {
    return {
      ...base,
      serviceTitle: /concrete|slab|driveway|patio|walkway/i.test(lower) ? "Concrete Repair and Flatwork" : "Project Repair and Construction Services",
      consultationTitle: "Estimate and Project Consultation",
      summary: `${businessName} helps ${serviceArea} property owners understand repair needs, project scope, and practical next steps.`,
      description: "Use this page to explain the problems customers commonly search for: visible damage, worn surfaces, safety concerns, project timing, estimate questions, and whether the work is right for a home or commercial property. The owner can later replace examples with exact services, but this gives visitors a stronger starting point than a bare business listing.",
      bestFor: ["Repair needs", "Project estimates", "Home or property improvements"],
      included: ["Issue review", "Scope discussion", "Clear next step for estimate"],
      highlights: [
        { title: "Repair-Focused Copy", description: "Explains customer problems instead of repeating a generic Google category." },
        { title: "Estimate Ready", description: directContact },
      ],
      detailFeatures: [
        { title: "Problem-Focused", description: "Frames the service around visible issues, timing, and project scope." },
        { title: toTitleCase(serviceArea), description: `Built around local customer intent in the ${serviceArea}.` },
        { title: "Clear Next Step", description: directContact },
      ],
      shortPitch: `${businessName} gives ${serviceArea} property owners a clearer path for repair questions, project planning, and estimate requests.`,
      homeFeatureTitle: "Project-Focused Positioning",
      homeFeatureDescription: "The page turns a generic contractor category into customer intent around repairs, estimates, and next steps.",
      consultationSummary: "A focused next step for homeowners or property managers who need project scope before scheduling.",
      consultationDescription: "This page can be used to turn Google profile visitors into estimate requests by asking about location, surface or project type, approximate size, visible damage, timing, and preferred contact method.",
      consultationBestFor: ["Repair estimates", "Project timing", "Scope questions"],
      consultationIncluded: ["Project intake", "Photo-ready questions", "Scheduling handoff"],
      consultationHighlightTitle: "Built for Estimate Requests",
    };
  }

  if (/law|legal|attorney|notary|immigration|tax|accounting|bookkeeping|financial|insurance|mortgage/i.test(lower)) {
    return {
      ...base,
      serviceTitle: `${typeLabel} Guidance`,
      consultationTitle: "Confidential Consultation Request",
      summary: `${businessName} helps ${serviceArea} clients understand their options and choose a practical next step.`,
      description: "This page should clarify service fit, explain when to reach out, reduce uncertainty, and encourage visitors to request a consultation without making unsupported claims.",
      bestFor: ["Private questions", "Document review", "Next-step planning"],
      included: ["Initial intake", "Fit review", "Clear follow-up path"],
      shortPitch: `${businessName} supports ${serviceArea} clients with professional guidance and a clear path to contact.`,
      homeFeatureTitle: "Professional Trust",
      homeFeatureDescription: "Content is structured to reduce uncertainty and guide visitors toward a consultation.",
    };
  }

  if (/dentist|dental|clinic|medical|doctor|therapy|chiropractor|health/i.test(lower)) {
    return {
      ...base,
      serviceTitle: `${typeLabel} Care`,
      consultationTitle: "Appointment and Care Questions",
      summary: `${businessName} helps ${serviceArea} patients understand care options and appointment next steps.`,
      description: "This page should explain patient-friendly benefits, appointment expectations, contact options, and trust signals from the Google profile without inventing medical claims.",
      bestFor: ["New patients", "Care questions", "Appointment planning"],
      included: ["Care inquiry", "Availability questions", "Contact handoff"],
      shortPitch: `${businessName} gives ${serviceArea} patients a clearer path to ask questions and plan a visit.`,
      homeFeatureTitle: "Patient-Friendly Flow",
      homeFeatureDescription: "The page organizes contact, reviews, hours, and care questions into a simple visitor path.",
    };
  }

  if (/landscap|garden|lawn|tree|pool|spa|cleaning|janitorial|maid|pressure washing|auto|mechanic|tire|salon|beauty|fitness|gym|restaurant|cafe|coffee|bakery|real estate|realtor|property/i.test(lower)) {
    return {
      ...base,
      serviceTitle: `${typeLabel} Services`,
      consultationTitle: isEnglish ? "Service Questions and Booking" : "Pertanyaan dan Booking Layanan",
      summary: `${businessName} helps ${serviceArea} customers compare options, ask practical questions, and take the next step.`,
      description: "This page should expand the Google profile into useful customer-facing content: what visitors can ask about, what kind of help is available, what to prepare before contacting the business, and why the listing looks trustworthy.",
      bestFor: ["Local service needs", "Availability questions", "Planning before booking"],
      included: ["Need review", "Availability questions", "Contact handoff"],
      shortPitch: `${businessName} helps ${serviceArea} customers move from search intent to a practical next step.`,
      homeFeatureTitle: "Local Service Fit",
      homeFeatureDescription: "The page turns profile data into clear service context, trust signals, and contact paths.",
    };
  }

  return base;
}

function faviconSvg(name: string, color = "#111827") {
  const initial = (name.trim()[0] || "W").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`;
}

function buildFallbackSiteJson(place: any, businessId: string, imageUrl = "", palette: string[] = [], paletteOptions: any[] = []) {
  const businessName = place.name || "Untitled Business";
  const locale = inferLanguage(place);
  const isEnglish = locale.language === "en";
  const address = place.formatted_address || place.formattedAddress || "";
  const phone = prospectPhone(place);
  const mapsUrl = place.url || place.googleMapsUri || "";
  const websiteUrl = place.website || place.websiteUri || "";
  const typeLabel = toTitleCase(meaningfulType(place));
  const serviceArea = inferServiceArea(address, isEnglish ? "the local area" : "area sekitar");
  const rating = Number(place.rating || 0);
  const reviewCount = Number(place.user_ratings_total || place.userRatingCount || 0);
  const primary = palette[0] || "#111827";
  const accent = palette[1] || "#4F46E5";
  const secondary = palette[2] || "#F3F4F6";
  const nicheText = [
    businessName,
    address,
    Array.isArray(place.types) ? place.types.join(" ") : "",
    place.searchQuery,
  ].filter(Boolean).join(" ");
  const stylePreset = inferStylePresetFromText(nicheText);
  const stylePresetMeta = getStylePreset(stylePreset);
  const visualStyle = inferVisualStyleFromText(nicheText);
  const visualStyleMeta = siteVisualStyles.find((item) => item.id === visualStyle) || siteVisualStyles[0];
  const fontPairing = inferFontPairingFromText(nicheText);
  const fontPairingMeta = getFontPairing(fontPairing);
  const fontPairingOptions = fontPairingsForText(nicheText, 5);
  const profile = industryCopyProfile({ businessName, nicheText, typeLabel, serviceArea, phone, isEnglish });
  const serviceTitle = profile.serviceTitle;
  const consultationTitle = profile.consultationTitle;
  const serviceId = "core-service";
  const servicePageId = `service-${serviceId}`;
  const consultationPageId = "service-fast-consultation";
  const photoUrls = Array.isArray(place.photos)
    ? place.photos
        .map((photo: any) => photoReference(photo))
        .filter(Boolean)
        .slice(0, 8)
        .map((reference: string) => `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=960`)
    : [];
  const reviews = Array.isArray(place.reviews) ? place.reviews.slice(0, 3).map((review: any) => ({
    authorName: review.author_name || review.authorName || "Google reviewer",
    rating: Number(review.rating || 5),
    text: review.text || "",
    relativePublishTimeDescription: review.relative_time_description || review.relativePublishTimeDescription || "",
    attribution: "Google",
  })) : [];
  const services = [
    {
      id: serviceId,
      type: "service",
      title: serviceTitle,
      summary: profile.summary,
      description: profile.description,
      priceHint: isEnglish ? "Contact for estimate" : "Hubungi untuk estimasi",
      image: imageUrl,
      detailPageId: servicePageId,
      bestFor: profile.bestFor,
      included: profile.included,
      highlights: profile.highlights,
      relatedReviewKeywords: ["service", "help", "professional", "fast", "local"],
    },
    {
      id: "fast-consultation",
      type: "service",
      title: consultationTitle,
      summary: profile.consultationSummary,
      description: profile.consultationDescription,
      priceHint: isEnglish ? "Fast response" : "Respons cepat",
      image: imageUrl,
      detailPageId: consultationPageId,
      bestFor: profile.consultationBestFor,
      included: profile.consultationIncluded,
      highlights: [{ title: profile.consultationHighlightTitle, description: isEnglish ? "Customers can call or open maps directly." : "Pelanggan bisa menelepon atau membuka maps langsung." }],
      relatedReviewKeywords: ["fast", "quick", "response", "help"],
    },
  ];
  const detailPages = services.map((service) => ({
    pageId: service.detailPageId,
    pageTitle: service.title,
    sections: [
      {
        type: "hero",
        id: `${service.id}-hero`,
        content: {
          headline: isEnglish ? `${service.title} from ${businessName}` : `${service.title} dari ${businessName}`,
          subheadline: service.summary,
          buttons: [
            { text: isEnglish ? "Ask about this" : "Tanya layanan ini", href: "#contact", style: "primary" },
            { text: isEnglish ? "Back to services" : "Lihat layanan lain", href: "#services", style: "outline" },
          ],
          image: service.image,
        },
      },
      { type: "offeringDetail", id: `${service.id}-detail`, content: { kind: isEnglish ? "Service" : "Layanan", ...service } },
      {
        type: "features",
        id: `${service.id}-features`,
        content: {
          title: isEnglish ? `Why choose ${service.title}` : `Kenapa memilih ${service.title}`,
          items: [
            ...profile.detailFeatures,
          ],
        },
      },
      { type: "reviews", id: `${service.id}-reviews`, content: { title: isEnglish ? "Customer notes" : "Catatan pelanggan", reviews } },
      {
        type: "faq",
        id: `${service.id}-faq`,
        content: {
          title: isEnglish ? `Questions about ${service.title}` : `Pertanyaan tentang ${service.title}`,
          items: [
            { question: isEnglish ? "How do I contact this business?" : "Bagaimana cara menghubungi bisnis ini?", answer: phone ? (isEnglish ? `Call ${phone}.` : `Hubungi ${phone}.`) : (isEnglish ? "Contact details can be completed by admin." : "Detail kontak bisa dilengkapi admin.") },
            { question: isEnglish ? "Can this page be customized?" : "Apakah halaman ini bisa disesuaikan?", answer: isEnglish ? "Yes. The owner can replace this copy with exact packages, prices, and requirements." : "Bisa. Pemilik bisnis dapat mengganti copy dengan paket, harga, dan syarat yang lebih tepat." },
          ],
        },
      },
      { type: "hoursLocation", id: `${service.id}-contact`, content: { title: isEnglish ? "Contact and location" : "Kontak dan lokasi", address, phone, directionsUrl: mapsUrl } },
    ],
  }));

  return {
    meta: {
      businessName,
      businessId,
      niche: typeLabel,
      language: locale.language,
      region: locale.region,
      seoDescription: isEnglish ? `Official website for ${businessName}.` : `Website resmi untuk ${businessName}.`,
      faviconSvg: faviconSvg(businessName, primary),
      brandPalette: palette,
      generatedWithAi: false,
      generationMode: "google_places_fallback",
      generationNote: "Generated from gathered Google Places data because AI output was unavailable or not required.",
      sourcePhotoCount: photoUrls.length,
    },
    sourceData: {
      provider: "google_places",
      placeId: place.place_id || place.id || "",
      resourceName: place.name?.startsWith?.("places/") ? place.name : "",
      googleMapsUri: mapsUrl,
      lastSyncedAt: new Date().toISOString(),
      businessStatus: place.business_status || place.businessStatus || "",
      pureServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness),
      hasWebsite: Boolean(websiteUrl),
      websiteUri: websiteUrl || null,
      attributions: [],
    },
    design: {
      stylePreset,
      stylePresetConfig: {
        label: stylePresetMeta.label,
        mood: stylePresetMeta.mood,
        industries: stylePresetMeta.industries,
        recommendedColors: stylePresetMeta.recommendedColors,
      },
      visualStyle,
      visualStyleConfig: {
        label: visualStyleMeta.label,
        description: visualStyleMeta.description,
        allowedValues: siteVisualStyles.map((item) => item.id),
        selectionRule: "Choose the visual structure that best matches the industry and desired feel.",
      },
      fontPairing,
      fontPairingConfig: {
        label: fontPairingMeta.label,
        headingFont: fontPairingMeta.headingFont,
        bodyFont: fontPairingMeta.bodyFont,
        mood: fontPairingMeta.mood,
        allowedValues: fontPairingOptions.map((item) => item.id),
        selectionRule: "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download.",
      },
      themeVariables: {
        colors: { primary, secondary, accent, textMain: "#1F2937", textMuted: "#6B7280", background: "#FFFFFF" },
        typography: { headingFont: fontPairingMeta.headingCss, bodyFont: fontPairingMeta.bodyCss },
      },
    },
    brand: {
      logoImageUrl: imageUrl,
      logoSvg: "",
      faviconSvg: faviconSvg(businessName, primary),
      palette,
      paletteOptions,
      preferredHeroImage: imageUrl,
      photoSource: imageUrl ? "google_places" : "",
      googlePhotoReference: "",
      photoCaption: imageUrl ? "Photo from Google Business Profile" : "",
      photoAttributions: Array.isArray(place.selectedPhoto?.attributions) ? place.selectedPhoto.attributions : [],
    },
    businessProfile: {
      name: businessName,
      primaryType: typeLabel,
      typeLabel,
      categories: Array.isArray(place.types) ? place.types : [],
      shortPitch: profile.shortPitch,
      address: { formatted: address },
      contact: { phoneNational: phone, phoneInternational: phone, directionsUrl: mapsUrl },
    },
    trust: {
      rating,
      reviewCount,
      reviewSummary: reviewCount ? (isEnglish ? `${businessName} has a ${rating.toFixed(1)} rating from ${reviewCount} Google reviews.` : `${businessName} memiliki rating ${rating.toFixed(1)} dari ${reviewCount} review Google.`) : "",
      reviews,
      badges: [place.business_status === "OPERATIONAL" ? "Operational" : "", websiteUrl ? "Has website" : "No website lead", phone ? "Has phone" : ""].filter(Boolean),
    },
    productServiceStrategy: {
      mode: "services",
      reasoning: "Generated from gathered Google Places data with a local fallback structure.",
      navbarGroupLabel: isEnglish ? "Services" : "Layanan",
      detailPageRule: "Each service has a dedicated detail page with overview, benefits, reviews, FAQ, and conversion CTA.",
    },
    products: [],
    services,
    offers: services.map((service) => ({ title: service.title, description: service.summary, priceHint: service.priceHint, image: service.image, cta: { text: isEnglish ? "View details" : "Lihat detail", href: `#${service.detailPageId}` } })),
    capabilities: [
      { label: isEnglish ? "Local business" : "Bisnis lokal", enabled: true, source: "google_places.types", description: isEnglish ? "Business profile data is gathered from Google Places." : "Profil bisnis diambil dari Google Places." },
      { label: "Google rating", enabled: rating > 0, source: "google_places.rating", description: reviewCount ? `${reviewCount} reviews available.` : "Rating not available yet." },
      { label: isEnglish ? "Direct contact" : "Kontak langsung", enabled: Boolean(phone), source: "google_places.phone", description: isEnglish ? "CTA points to the business contact when available." : "CTA diarahkan ke kontak bisnis." },
    ],
    location: { formattedAddress: address, directionsUrl: mapsUrl, isServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness) },
    hours: { timezone: "", openNow: Boolean(place.opening_hours?.open_now), regular: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : [], current: [] },
    conversion: {
      primaryCta: { text: isEnglish ? "Call Now" : "Hubungi Sekarang", href: phone ? `tel:${phone}` : "#contact" },
      secondaryCta: { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact" },
      stickyMobileCta: true,
      leadForm: { enabled: true, fields: ["name", "phone", "message"], submitLabel: isEnglish ? "Send Message" : "Kirim Pesan" },
    },
    navigation: {
      headerMenu: [
        { label: isEnglish ? "Home" : "Beranda", href: "#home" },
        { label: isEnglish ? "Services" : "Layanan", href: "#services", children: services.map((service) => ({ label: service.title, href: `#${service.detailPageId}` })) },
        { label: isEnglish ? "Contact" : "Kontak", href: "#contact" },
      ],
    },
    pages: [
      {
        pageId: "home",
        pageTitle: isEnglish ? "Home" : "Beranda",
        sections: [
          { type: "hero", id: "hero", content: { headline: isEnglish ? `${businessName} is ready to help locally` : `${businessName} siap membantu pelanggan lokal`, subheadline: address, image: imageUrl, buttons: [{ text: isEnglish ? "Contact Us" : "Hubungi Kami", href: "#contact", style: "primary" }, { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact", style: "outline" }] } },
          { type: "trustBar", id: "trust", content: { items: [{ label: "Google Rating", value: rating ? rating.toFixed(1) : "-" }, { label: "Reviews", value: reviewCount ? `${reviewCount}+` : "-" }, { label: "Phone", value: phone || (isEnglish ? "Available soon" : "Segera tersedia") }] } },
          { type: "features", id: "features", content: { title: isEnglish ? "Why this business stands out" : "Keunggulan bisnis ini", items: [{ title: profile.homeFeatureTitle, description: profile.homeFeatureDescription }, { title: isEnglish ? "Easy to Contact" : "Mudah Dihubungi", description: phone || (isEnglish ? "Contact can be completed by admin." : "Kontak bisa dilengkapi admin.") }, { title: isEnglish ? "Website Ready" : "Siap Dibuatkan Website", description: websiteUrl ? "Website detected." : "No website detected yet." }] } },
          { type: "offers", id: "services", content: { title: isEnglish ? "Services to highlight" : "Layanan utama", items: services } },
          ...(photoUrls.length > 1 ? [{ type: "imageGallery", id: "gallery", content: { title: isEnglish ? "Project and profile photos" : "Foto profil dan pekerjaan", images: photoUrls } }] : []),
          { type: "reviews", id: "reviews", content: { title: isEnglish ? "Google social proof" : "Bukti sosial Google", reviews } },
          { type: "hoursLocation", id: "contact", content: { title: isEnglish ? "Location and contact" : "Lokasi & Kontak", address, phone, directionsUrl: mapsUrl } },
          { type: "faq", id: "faq", content: { title: isEnglish ? "Common questions" : "Pertanyaan umum", items: [{ question: isEnglish ? "How do I contact this business?" : "Bagaimana menghubungi bisnis ini?", answer: phone ? (isEnglish ? `Call ${phone}.` : `Hubungi ${phone}.`) : (isEnglish ? "Phone number can be completed manually." : "Nomor telepon bisa dilengkapi manual.") }, { question: isEnglish ? "Can this data be edited?" : "Apakah data ini bisa diedit?", answer: isEnglish ? "Yes. The generated JSON can be corrected before the final website is used." : "Bisa. JSON hasil generate dapat dikoreksi sebelum website final dipakai." }] } },
        ],
      },
      ...detailPages,
    ],
  };
}

export default function AdminSites() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [gatheredProspects, setGatheredProspects] = useState<ProspectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeData, setActiveData] = useState<{ title: string; subtitle: string; data: any } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [regeneratingId, setRegeneratingId] = useState("");
  const [generatingProspectId, setGeneratingProspectId] = useState("");
  const [openRegenerateMenu, setOpenRegenerateMenu] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [regenerateProvider, setRegenerateProvider] = useLocalStorageState("webview.adminSites.regenerateProvider", "OpenRouter");
  const [regenerateModel, setRegenerateModel] = useLocalStorageState("webview.adminSites.regenerateModel", "~anthropic/claude-sonnet-latest");

  const providerOptions = useMemo<string[]>(() => Array.from(new Set(aiModelPrices.map((item) => item.provider))), []);
  const activeRegenerateProvider = providerOptions.includes(regenerateProvider) ? regenerateProvider : "OpenRouter";
  const regenerateModels = aiModelPrices.filter((item) => item.provider === activeRegenerateProvider);
  const activeRegenerateModel = regenerateModels.some((item) => item.model === regenerateModel)
    ? regenerateModel
    : regenerateModels[0]?.model || "";
  const activeRegenerateModelLabel = regenerateModels.find((item) => item.model === activeRegenerateModel)?.label || activeRegenerateModel;

  const fetchSites = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sites");
      const text = await response.text();
      let data: unknown = [];
      try {
        data = text ? JSON.parse(text) : [];
      } catch {
        throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
      }
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || `Sites API returned ${response.status}`);
      }
      setSites(Array.isArray(data) ? (data as SiteRow[]) : []);

      const prospectResponse = await fetch("/api/prospects?status=details_loaded");
      const prospectText = await prospectResponse.text();
      let prospectData: unknown = [];
      try {
        prospectData = prospectText ? JSON.parse(prospectText) : [];
      } catch {
        throw new Error(`Prospects response bukan JSON: ${prospectText.slice(0, 120)}`);
      }
      if (!prospectResponse.ok) {
        throw new Error((prospectData as { error?: string }).error || `Prospects API returned ${prospectResponse.status}`);
      }
      setGatheredProspects(Array.isArray(prospectData)
        ? (prospectData as ProspectRow[]).filter((item) => item.place_id && !item.generatedBusinessId)
        : []);

      const settingsResponse = await fetch("/api/settings");
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json().catch(() => ({}));
        setSettings(settingsData && typeof settingsData === "object" ? settingsData : {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar situs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (activeRegenerateProvider !== regenerateProvider) {
      setRegenerateProvider(activeRegenerateProvider);
      return;
    }
    if (regenerateModels.length > 0 && !regenerateModels.some((item) => item.model === regenerateModel)) {
      setRegenerateModel(regenerateModels[0].model);
    }
  }, [activeRegenerateProvider, regenerateProvider, regenerateModel, regenerateModels, setRegenerateProvider, setRegenerateModel]);

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) => [
      site.businessName,
      site.businessId,
      site.niche,
      site.language,
      site.region,
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, sites]);

  const filteredGatheredProspects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return gatheredProspects;
    return gatheredProspects.filter((prospect) => [
      prospect.name,
      prospect.place_id,
      prospect.formatted_address,
      prospect.formattedAddress,
      Array.isArray(prospect.types) ? prospect.types.join(" ") : "",
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [gatheredProspects, query]);

  const fetchSiteJson = async (site: SiteRow) => {
    const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}`);
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
    }
    if (!response.ok || data.error) {
      throw new Error(data.error || `Site JSON returned ${response.status}`);
    }
    return data;
  };

  const handleSeeGatheredData = async (site: SiteRow) => {
    setActionMessage("");
    try {
      const siteJson = await fetchSiteJson(site);
      setActiveData({ title: "Gathered data", subtitle: `${site.businessName} · ${site.businessId}`, data: gatheredSnapshot(siteJson) });
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal memuat gathered data.");
    }
  };

  const handleSeeCopyBrief = async (site: SiteRow) => {
    setActionMessage("");
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.businessId)}/copy-brief`);
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.slice(0, 120)}`);
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || `Copy brief returned ${response.status}`);
      }
      setActiveData({ title: "AI copy brief", subtitle: `${site.businessName} · ${site.businessId}`, data });
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal memuat AI copy brief.");
    }
  };

  const handleSeeProspectData = (prospect: ProspectRow) => {
    setActiveData({
      title: "Gathered prospect data",
      subtitle: `${prospect.name} · ${prospect.place_id}`,
      data: {
        googlePlace: prospect,
        selectedPhoto: prospect.selectedPhoto || {},
        selectedPalette: prospect.selectedPalette || [],
        paletteOptions: prospect.paletteOptions || [],
      },
    });
  };

  const handleGenerateProspect = async (prospect: ProspectRow) => {
    const placeId = prospect.place_id;
    setGeneratingProspectId(placeId);
    setActionMessage("");
    try {
      let originData: any = { ...prospect };
      const detailsResponse = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const detailsText = await detailsResponse.text();
      let details: any = {};
      try {
        details = detailsText ? JSON.parse(detailsText) : {};
      } catch {
        details = { error: `Place Details response bukan JSON: ${detailsText.slice(0, 120)}` };
      }
      if (detailsResponse.ok && details.result) {
        originData = { ...originData, ...details.result };
      } else {
        throw new Error(details.error || `Place Details returned HTTP ${detailsResponse.status}`);
      }

      const selectedPhoto = prospect.selectedPhoto || {};
      const fallbackPhoto = Array.isArray(originData.photos) ? originData.photos.find((photo: any) => photoReference(photo)) : null;
      const fallbackReference = fallbackPhoto ? photoReference(fallbackPhoto) : "";
      const selectedReference = selectedPhoto.reference || fallbackReference;
      const selectedImageUrl = selectedPhoto.url || (selectedReference ? `/api/places/photo?reference=${encodeURIComponent(selectedReference)}&maxwidth=320` : "");
      const businessId = businessSlug(prospect.name || originData.name || "business", placeId);
      const paletteOptions = Array.isArray(prospect.paletteOptions) ? prospect.paletteOptions : [];
      const selectedPalette = Array.isArray(prospect.selectedPalette) && prospect.selectedPalette.length > 0
        ? prospect.selectedPalette
        : Array.isArray(paletteOptions[0]?.colors) ? paletteOptions[0].colors : [];
      const fallbackJson = buildFallbackSiteJson(
        {
          ...originData,
          selectedPhoto,
          selectedPalette,
        },
        businessId,
        selectedImageUrl,
        selectedPalette,
        paletteOptions,
      );
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireAi: false,
          provider: activeRegenerateProvider,
          model: activeRegenerateModel,
          jsonContent: fallbackJson,
          businessId,
          businessName: prospect.name || originData.name || "Untitled Business",
          phone: prospectPhone({ ...prospect, ...originData }),
          originData,
          brandPalette: selectedPalette,
          paletteOptions,
          selectedLogoImageUrl: selectedImageUrl,
          selectedLogoReference: selectedReference,
          selectedLogoSource: selectedImageUrl ? (selectedPhoto.source || "google_places") : "",
          selectedLogoAttributions: Array.isArray(selectedPhoto.attributions) && selectedPhoto.attributions.length > 0
            ? selectedPhoto.attributions
            : fallbackPhoto ? photoAttributions(fallbackPhoto) : [],
          selectedLogoPriority: selectedPhoto.priorityLabel || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Generate failed with HTTP ${response.status}`);
      }
      const requiredKey = providerApiKeyMap[activeRegenerateProvider];
      const hasProviderKey = requiredKey && String(settings?.[requiredKey] || "").trim();
      setActionMessage(hasProviderKey
        ? `Generated ${prospect.name}. If ${activeRegenerateProvider} returned a usable copy patch, it was merged into the deterministic site JSON; otherwise the gathered-data fallback was saved.`
        : `Generated ${prospect.name} from gathered-data fallback. Add ${activeRegenerateProvider} API key in /admin/settings for AI copy improvement.`
      );
      fetchSites();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Generate gagal.");
    } finally {
      setGeneratingProspectId("");
    }
  };

  const handleRegenerate = async (site: SiteRow, mode: RegenerateMode) => {
    setRegeneratingId(site.businessId);
    setActionMessage("");
    try {
      const siteJson = await fetchSiteJson(site);
      const sourceData = siteJson?.sourceData || {};
      let originData: any = {
        name: site.businessName,
        place_id: sourceData.placeId || "",
        url: sourceData.googleMapsUri || site.googleMapsUrl || "",
        website: sourceData.websiteUri || "",
        rating: site.rating || undefined,
        user_ratings_total: site.reviewCount || undefined,
      };
      let detailsGathered = false;
      let detailsError = "";

      if (sourceData.placeId) {
        const detailsResponse = await fetch(`/api/places/details?placeId=${encodeURIComponent(sourceData.placeId)}`);
        const detailsText = await detailsResponse.text();
        let details: any = {};
        try {
          details = detailsText ? JSON.parse(detailsText) : {};
        } catch {
          details = { error: `Place Details response bukan JSON: ${detailsText.slice(0, 120)}` };
        }
        if (detailsResponse.ok && details.result) {
          originData = { ...originData, ...details.result };
          detailsGathered = true;
        } else {
          detailsError = details.error || `Place Details returned HTTP ${detailsResponse.status}`;
        }
      }

      if (mode === "resave" && !sourceData.placeId) {
        throw new Error("Site lama ini belum punya sourceData.placeId, jadi Google Places tidak bisa di-gather ulang.");
      }
      if (mode === "resave" && !detailsGathered) {
        throw new Error(detailsError || "Google Places details belum berhasil di-gather ulang.");
      }

      const contact = siteJson?.businessProfile?.contact || {};
      const provider = mode === "ai" ? activeRegenerateProvider : "";
      const model = mode === "ai" ? activeRegenerateModel : "";
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          jsonContent: siteJson,
          businessId: site.businessId,
          businessName: site.businessName,
          phone: contact.phoneInternational || contact.phoneNational || "",
          originData,
          brandPalette: siteJson?.meta?.brandPalette || siteJson?.brand?.palette || [],
          selectedLogoImageUrl: siteJson?.brand?.logoImageUrl || "",
          selectedLogoReference: siteJson?.brand?.googlePhotoReference || "",
          selectedLogoSource: siteJson?.brand?.photoSource || "",
          selectedLogoAttributions: siteJson?.brand?.photoAttributions || [],
          selectedLogoPriority: siteJson?.brand?.selectedPhotoPriority || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Regenerate failed with HTTP ${response.status}`);
      }
      setActionMessage(
        mode === "ai"
          ? `AI copy patch regenerated ${site.businessName} with ${activeRegenerateProvider} / ${activeRegenerateModelLabel}.`
          : `Re-gathered Google data and resaved ${site.businessName} without an AI call.`
      );
      fetchSites();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Regenerate gagal.");
    } finally {
      setRegeneratingId("");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Generated Sites</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Situs yang berhasil dibuat</h1>
          <p className="mt-2 text-gray-500">Daftar ini membaca semua JSON website yang tersimpan di D1.</p>
        </div>
        <button
          type="button"
          onClick={fetchSites}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama bisnis, slug, niche, bahasa..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          {actionMessage}
        </div>
      )}

      <div className="mb-6 overflow-visible rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Ready to Generate</p>
            <p className="text-xs text-emerald-700">Prospect yang sudah gather data tapi belum dibuatkan site.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={activeRegenerateProvider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                const firstModel = aiModelPrices.find((item) => item.provider === nextProvider)?.model || "";
                setRegenerateProvider(nextProvider);
                setRegenerateModel(firstModel);
              }}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-emerald-400"
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
            <select
              value={activeRegenerateModel}
              onChange={(event) => setRegenerateModel(event.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-emerald-400"
            >
              {regenerateModels.map((model) => (
                <option key={model.model} value={model.model}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.8fr_1.1fr] gap-4 border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Business</span>
          <span>Place ID</span>
          <span>Rating</span>
          <span>Gathered</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Memuat gathered prospects...
          </div>
        ) : filteredGatheredProspects.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">
            Belum ada prospect gathered yang menunggu generate.
          </div>
        ) : (
          filteredGatheredProspects.map((prospect) => (
            <div key={prospect.place_id} className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.8fr_1.1fr] items-center gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{prospect.name}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{prospect.formatted_address || prospect.formattedAddress || "No address"}</p>
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{prospect.place_id}</code>
              <span className="text-xs text-gray-600">
                {Number(prospect.rating || 0).toFixed(1)} / {Number(prospect.user_ratings_total || prospect.userRatingCount || 0)}
              </span>
              <span className="text-xs text-gray-500">{prospect.detailsLoadedAt ? new Date(prospect.detailsLoadedAt).toLocaleString() : "-"}</span>
              <div className="flex justify-end gap-2">
                {(prospect.url || prospect.googleMapsUri) && (
                  <a
                    href={prospect.url || prospect.googleMapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <MapPin size={14} />
                    Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleSeeProspectData(prospect)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Database size={14} />
                  Data
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateProspect(prospect)}
                  disabled={!activeRegenerateModel || Boolean(generatingProspectId || regeneratingId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generatingProspectId === prospect.place_id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  Generate
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_1.5fr] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Business</span>
          <span>Slug</span>
          <span>Locale</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 px-5 py-10 text-sm text-gray-500">
            <RefreshCw size={18} className="animate-spin" />
            Memuat daftar situs...
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Sparkles size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 font-semibold text-gray-800">Belum ada situs yang cocok.</p>
            <p className="mt-1 text-sm text-gray-500">Generate dari CRM Leads, lalu refresh halaman ini.</p>
          </div>
        ) : (
          filteredSites.map((site) => (
            <div key={site.businessId} className="grid grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_1.5fr] items-center gap-4 border-b border-gray-100 px-5 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{site.businessName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{site.niche || "No niche"}{site.rating ? ` · ${site.rating.toFixed(1)} rating` : ""}{site.reviewCount ? ` · ${site.reviewCount} reviews` : ""}</span>
                  <span
                    title={site.storageMode === "r2" ? site.r2JsonUrl || "Full JSON is stored in R2." : "Full JSON is still stored in D1. Run migration from /admin/schema."}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      site.storageMode === "r2"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {site.storageMode === "r2" ? "R2 JSON" : "Legacy D1 JSON"}
                  </span>
                  {(() => {
                    const badge = generationBadge(site);
                    return (
                      <span
                        title={badge.title}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <code className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">{site.businessId}</code>
              <span className="text-gray-600">{[site.language, site.region].filter(Boolean).join("-") || "-"}</span>
              <span className="text-xs text-gray-500">{site.updatedAt ? new Date(site.updatedAt).toLocaleString() : "-"}</span>
              <div className="flex justify-end gap-2">
                <a
                  href={site.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Globe2 size={14} />
                  Preview
                </a>
                {site.googleMapsUrl && (
                  <a
                    href={site.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <MapPin size={14} />
                    Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleSeeGatheredData(site)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Database size={14} />
                  Data
                </button>
                <button
                  type="button"
                  onClick={() => handleSeeCopyBrief(site)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} />
                  Brief
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenRegenerateMenu(openRegenerateMenu === site.businessId ? "" : site.businessId)}
                    disabled={Boolean(regeneratingId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCw size={14} className={regeneratingId === site.businessId ? "animate-spin" : ""} />
                    Regen
                    <ChevronDown size={14} />
                  </button>
                  {openRegenerateMenu === site.businessId && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-xl">
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-900">Regenerate option</p>
                        <p className="mt-1 text-[11px] leading-4 text-gray-500">Re-gather fixes stale Google data like fallback Maps URLs. AI regenerate only requests a copy patch; protected structure stays deterministic.</p>
                      </div>

                      <div className="mb-3 grid grid-cols-1 gap-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Provider
                          <select
                            value={activeRegenerateProvider}
                            onChange={(event) => {
                              const nextProvider = event.target.value;
                              const firstModel = aiModelPrices.find((item) => item.provider === nextProvider)?.model || "";
                              setRegenerateProvider(nextProvider);
                              setRegenerateModel(firstModel);
                            }}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-gray-800 outline-none focus:border-indigo-400"
                          >
                            {providerOptions.map((provider) => (
                              <option key={provider} value={provider}>{provider}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Model
                          <select
                            value={activeRegenerateModel}
                            onChange={(event) => setRegenerateModel(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-gray-800 outline-none focus:border-indigo-400"
                          >
                            {regenerateModels.map((model) => (
                              <option key={model.model} value={model.model}>{model.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRegenerateMenu("");
                            handleRegenerate(site, "ai");
                          }}
                          disabled={!activeRegenerateModel || Boolean(regeneratingId)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Brain size={14} />
                          AI regenerate with selected model
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRegenerateMenu("");
                            handleRegenerate(site, "resave");
                          }}
                          disabled={Boolean(regeneratingId)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCw size={14} />
                          Re-gather Google data + resave
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {activeData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeData.title}</p>
                <p className="text-xs text-gray-500">{activeData.subtitle}</p>
              </div>
              <button type="button" onClick={() => setActiveData(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <pre className="max-h-[70vh] overflow-auto bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
              {JSON.stringify(activeData.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
