import { fontPairingsForText, fontPairingVariantForText, getFontPairing } from "./fontPairings";
import {
  getShaderPreset,
  getStylePreset,
  inferShaderPresetFromText,
  inferStylePresetFromText,
  inferVisualStyleFromText,
  siteShaderPresets,
  siteVisualStyles,
} from "./siteStylePresets";
import { applyGeneratedSitePageInserts } from "./generatedSitePostProcess";

type ScaffoldOptions = {
  businessId: string;
  imageUrl?: string;
  palette?: string[];
  paletteOptions?: any[];
  selectedPhotoReference?: string;
  selectedPhotoAttributions?: string[];
  selectedPhotoSource?: string;
  selectedPhotoPriority?: string;
  searchQuery?: string;
};

export function isPlaceholderPhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return !digits || /^0+$/.test(digits);
}

export function placePhone(place: any) {
  const phone = place.formatted_phone_number || place.international_phone_number || place.nationalPhoneNumber || "";
  return isPlaceholderPhone(phone) ? "" : phone;
}

export function placeMapsUrl(place: any) {
  return place.url || place.googleMapsUri || place.maps_url || "";
}

export function photoReference(photo: any) {
  return String(photo?.photo_reference || photo?.name || photo?.reference || "");
}

export function photoAttributions(photo: any) {
  if (Array.isArray(photo?.html_attributions)) {
    return photo.html_attributions.map((value: string) => String(value).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  }
  if (Array.isArray(photo?.authorAttributions)) {
    return photo.authorAttributions.map((item: any) => item?.displayName || item?.uri || item?.photoUri || "").filter(Boolean);
  }
  return [];
}

export function businessSlug(name: string, placeId = "") {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
  const suffix = placeId.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-6);
  return suffix ? `${slug}-${suffix}` : slug;
}

function inferLocaleFromPlace(place: any) {
  const text = [
    place.formatted_address,
    place.formattedAddress,
    place.adr_address,
    Array.isArray(place.addressComponents) ? JSON.stringify(place.addressComponents) : "",
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(united states|usa|tx|ca|fl|ny|dallas|houston|austin)\b/.test(text)) {
    return { language: "en", region: "US" };
  }
  if (/\b(indonesia|jakarta|bandung|surabaya|bali|yogyakarta|semarang|medan)\b/.test(text)) {
    return { language: "id", region: "ID" };
  }
  return { language: "en", region: "US" };
}

function normalizeStringList(value: any) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]+/) : value ? [value] : [];
  const seen = new Set<string>();
  return values
    .map((item: any) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") return String(item.name || item.city || item.label || item.area || item.description || item.text || "").trim();
      return "";
    })
    .filter((item: string) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function placeAddressComponents(place: any) {
  const components = place.address_components || place.addressComponents || [];
  return Array.isArray(components) ? components : [];
}

function componentLongName(component: any) {
  return String(component?.long_name || component?.longText || component?.short_name || component?.shortText || "").trim();
}

function placeServedAreas(place: any, searchQuery = "") {
  const directAreas = normalizeStringList(
    place.locationServed ||
      place.locationsServed ||
      place.servedAreas ||
      place.serviceAreas ||
      place.service_area?.places ||
      place.serviceArea?.places ||
      place.serviceAreaBusiness?.places,
  );
  if (directAreas.length > 0) return directAreas;

  const components = placeAddressComponents(place);
  const componentAreas = components
    .filter((component: any) => {
      const types = Array.isArray(component?.types) ? component.types : [];
      return types.includes("locality") || types.includes("postal_town") || types.includes("administrative_area_level_2");
    })
    .map(componentLongName)
    .filter(Boolean);
  const queryText = String(searchQuery || "");
  const queryArea = /\bnear\b|\bin\b|,/i.test(queryText)
    ? queryText
        .split(/\bnear\b|\bin\b|,/i)
        .map((part) => part.trim())
        .filter((part) => /[a-z]/i.test(part))
        .slice(-1)
    : [];
  const formattedAddressArea = String(place.formatted_address || place.formattedAddress || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /[a-z]/i.test(part))
    .slice(-3, -2);
  return normalizeStringList([...componentAreas, ...queryArea, ...formattedAddressArea]).slice(0, 6);
}

export function placeDisplayName(place: any) {
  const displayName = place.displayName;
  if (typeof displayName === "string") return displayName;
  if (displayName && typeof displayName === "object" && typeof displayName.text === "string") return displayName.text;
  if (typeof place.name === "string" && !place.name.startsWith("places/")) return place.name;
  return "Untitled Business";
}

function faviconSvgForBusiness(businessName: string, background = "#111827") {
  const initial = String(businessName || "S").trim().slice(0, 1).toUpperCase() || "S";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`;
}

function iconSvgForText(text: string) {
  const key = text.toLowerCase();
  if (key.includes("contact") || key.includes("hubung") || key.includes("call")) {
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.34 1.9.63 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.2a2 2 0 0 1 2.11-.45c.91.29 1.85.5 2.81.63A2 2 0 0 1 22 16.92z'/></svg>";
  }
  if (key.includes("local") || key.includes("lokal") || key.includes("maps") || key.includes("location")) {
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 10c0 4.99-5.54 10.18-7.4 11.78a1 1 0 0 1-1.2 0C9.54 20.18 4 14.99 4 10a8 8 0 0 1 16 0z'/><circle cx='12' cy='10' r='3'/></svg>";
  }
  if (key.includes("fast") || key.includes("cepat") || key.includes("response")) {
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 13a8 8 0 0 1 7-7.94'/><path d='M12 2v4'/><path d='m13 12 4-4'/><path d='M20.49 15A8 8 0 1 1 5 8'/></svg>";
  }
  if (key.includes("product") || key.includes("produk") || key.includes("order")) {
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7.5 4.27 9 5.15'/><path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'/><path d='m3.3 7 8.7 5 8.7-5'/><path d='M12 22V12'/></svg>";
  }
  return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 6 9 17l-5-5'/></svg>";
}

function inferProductServiceMode(place: any) {
  const text = [place.name, ...(Array.isArray(place.types) ? place.types : [])].join(" ").toLowerCase();
  const productSignals = ["store", "shop", "restaurant", "cafe", "bakery", "meal", "food", "bar", "florist", "clothing", "furniture", "jewelry"];
  const serviceSignals = ["contractor", "repair", "lawyer", "dentist", "doctor", "plumber", "electrician", "cleaning", "salon", "spa", "agency", "service"];
  const hasProducts = productSignals.some((signal) => text.includes(signal));
  const hasServices = serviceSignals.some((signal) => text.includes(signal));
  if (hasProducts && hasServices) return "both";
  if (hasProducts) return "products";
  return hasServices ? "services" : "services";
}

function keywordRelevantReviews(reviews: any[], keywords: string[]) {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const matching = reviews.filter((review) => {
    const text = String(review.text || "").toLowerCase();
    return normalized.some((keyword) => text.includes(keyword));
  });
  return (matching.length ? matching : reviews).slice(0, 3);
}

function meaningfulTypeLabel(place: any, isEnglish: boolean, fallbackQuery = "") {
  const rawTypes = Array.isArray(place.types) ? place.types.map((item: string) => String(item).replace(/_/g, " ")) : [];
  const generic = new Set(["establishment", "point of interest", "store", "local business"]);
  const fromType = rawTypes.find((type) => type && !generic.has(type.toLowerCase()));
  if (fromType) return fromType;
  const fromQuery = String(place.searchQuery || fallbackQuery || "").replace(/\b(near me|texas|dallas|usa|united states)\b/gi, "").trim();
  if (fromQuery) return fromQuery;
  return isEnglish ? "local service" : "layanan lokal";
}

function titleCaseLabel(value = "") {
  const stopWords = new Set(["and", "or", "for", "of", "the", "a", "an", "to", "in", "on", "at", "by", "with", "dan", "atau", "untuk", "di", "ke", "dari", "yang"]);
  return String(value)
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      if (index > 0 && stopWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function inferredServiceTitles(place: any, typeLabel: string, isEnglish: boolean, fallbackQuery = "") {
  const key = [place.name, typeLabel, fallbackQuery, ...(Array.isArray(place.types) ? place.types : [])].join(" ").toLowerCase();
  if (!isEnglish) return ["Layanan Utama", "Konsultasi Cepat", "Perencanaan Kebutuhan", "Dukungan Lokal"];
  if (/(concrete|cement|ready mix|paving|driveway|foundation|masonry)/i.test(key)) {
    return [
      "Concrete Driveway Repair",
      "Walkway Concrete Repair",
      "Patio Concrete Repair",
      "Garage Floor Concrete Repair",
      "Retaining Wall Concrete Repair",
      "Concrete Project Consultation",
    ];
  }
  if (/(roof|roofing|gutter|shingle)/i.test(key)) {
    return ["Roof Repair", "Roof Replacement", "Leak Inspection", "Storm Damage Support", "Gutter and Flashing Work"];
  }
  if (/(plumb|drain|water heater|pipe)/i.test(key)) {
    return ["Plumbing Repair", "Drain Cleaning", "Water Heater Service", "Pipe Leak Support", "Fixture Installation"];
  }
  if (/(hvac|air conditioning|heating|furnace|ac repair)/i.test(key)) {
    return ["AC Repair", "Heating Service", "HVAC Maintenance", "System Installation", "Emergency Comfort Support"];
  }
  if (/(clean|janitorial|maid|pressure washing)/i.test(key)) {
    return ["Recurring Cleaning", "Deep Cleaning", "Move-In and Move-Out Cleaning", "Commercial Cleaning", "Pressure Washing"];
  }
  if (/(landscap|lawn|tree|garden|irrigation)/i.test(key)) {
    return ["Lawn Care", "Landscape Maintenance", "Seasonal Cleanup", "Tree and Shrub Care", "Irrigation Support"];
  }
  if (/(dent|clinic|medical|doctor|health)/i.test(key)) {
    return ["New Patient Consultation", "Preventive Care", "Treatment Planning", "Follow-Up Care", "Family Appointments"];
  }
  const base = titleCaseLabel(typeLabel || "local service");
  return [`${base} Consultation`, `${base} Planning`, `${base} Support`, `${base} Service`, "Fast Project Questions"];
}

function inferredProductTitles(place: any, typeLabel: string, isEnglish: boolean, fallbackQuery = "") {
  const key = [place.name, typeLabel, fallbackQuery, ...(Array.isArray(place.types) ? place.types : [])].join(" ").toLowerCase();
  if (!isEnglish) return ["Produk Unggulan", "Pilihan Populer", "Rekomendasi Lokal"];
  if (/(restaurant|cafe|coffee|bakery|food|meal)/i.test(key)) return ["Popular Menu Items", "Fresh Daily Options", "Catering or Group Orders", "Quick Takeout Choices"];
  if (/(flower|florist|garden|nursery)/i.test(key)) return ["Fresh Arrangements", "Seasonal Plants", "Gift Orders", "Event Florals"];
  if (/(furniture|home decor|interior)/i.test(key)) return ["Featured Furniture", "Home Decor Pieces", "Room Planning Help", "Delivery Questions"];
  if (/(auto parts|supply|hardware|store|retail|shop)/i.test(key)) return ["Featured Products", "Popular Local Picks", "Special Orders", "Product Availability Questions"];
  const base = titleCaseLabel(typeLabel || "product");
  return [`Featured ${base}`, "Popular Options", "Current Availability", "Ordering Help"];
}

function buildOfferings(place: any, isEnglish: boolean, mode: string, imageUrl: string, fallbackQuery = "") {
  const typeLabel = titleCaseLabel(meaningfulTypeLabel(place, isEnglish, fallbackQuery));
  const serviceBase = inferredServiceTitles(place, typeLabel, isEnglish, fallbackQuery).slice(0, 6).map((title, index) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `service-${index + 1}`;
    return {
      id,
      type: "service",
      title,
      summary: isEnglish ? `Practical help for ${title.toLowerCase()} needs.` : `Bantuan praktis untuk kebutuhan ${title.toLowerCase()}.`,
      description: isEnglish
        ? `A focused service page for customers comparing options, timing, scope, and next steps for ${title.toLowerCase()}.`
        : `Halaman layanan untuk pelanggan yang ingin memahami pilihan, jadwal, cakupan, dan langkah berikutnya.`,
      priceHint: isEnglish ? "Contact for estimate" : "Hubungi untuk estimasi",
      image: index === 0 ? imageUrl : "",
      detailPageId: `service-${id}`,
      bestFor: isEnglish ? ["Property owners", "Local projects", "Clear next steps"] : ["Pelanggan lokal", "Tanya cepat", "Kebutuhan khusus"],
      included: isEnglish ? ["Project discussion", "Scope guidance", "Availability check"] : ["Diskusi kebutuhan", "Arahan cakupan", "Cek ketersediaan"],
      highlights: [
        { title: isEnglish ? "Built around the job" : "Sesuai kebutuhan", description: isEnglish ? "We help customers clarify the scope, timing, and next step before work begins." : "Kami membantu pelanggan memperjelas cakupan, waktu, dan langkah berikutnya sebelum pekerjaan dimulai." },
        { title: isEnglish ? "Local next step" : "Langkah lokal", description: place.formatted_address || place.formattedAddress || "" },
      ],
      relatedReviewKeywords: ["service", "help", "professional", "quality", "repair", "project", "layanan", "ramah"],
    };
  });
  const productBase = inferredProductTitles(place, typeLabel, isEnglish, fallbackQuery).slice(0, 5).map((title, index) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `product-${index + 1}`;
    return {
      id,
      type: "product",
      title,
      summary: isEnglish ? `A practical option for customers comparing ${title.toLowerCase()}.` : `Pilihan praktis untuk pelanggan yang membandingkan ${title.toLowerCase()}.`,
      description: isEnglish ? "A product-led page for customers who want to understand availability, fit, and ordering steps before visiting or buying." : "Halaman produk untuk pelanggan yang ingin memahami ketersediaan, kecocokan, dan cara pesan sebelum membeli.",
      priceHint: isEnglish ? "Ask for current price" : "Tanya harga terbaru",
      image: index === 0 ? imageUrl : "",
      detailPageId: `product-${id}`,
      bestFor: isEnglish ? ["First-time buyers", "Local pickup", "Popular choice"] : ["Pembeli pertama", "Pickup lokal", "Pilihan populer"],
      included: isEnglish ? ["Product overview", "Current availability", "How to order"] : ["Ringkasan produk", "Ketersediaan terbaru", "Cara pesan"],
      highlights: [
        { title: isEnglish ? "Easy to compare" : "Mudah dibandingkan", description: isEnglish ? "Customers can ask about fit, timing, and current availability." : "Pelanggan bisa bertanya tentang kecocokan, waktu, dan ketersediaan terbaru." },
      ],
      relatedReviewKeywords: ["product", "menu", "food", "coffee", "produk", "enak"],
    };
  });
  if (mode === "products") return productBase;
  if (mode === "both") return [...productBase, ...serviceBase.slice(0, 1)];
  return serviceBase;
}

export function buildGeneratedSiteScaffold(place: any, options: ScaffoldOptions) {
  const businessName = placeDisplayName(place);
  const businessId = options.businessId;
  const imageUrl = options.imageUrl || "";
  const palette = Array.isArray(options.palette) ? options.palette : [];
  const paletteOptions = Array.isArray(options.paletteOptions) ? options.paletteOptions : [];
  const primaryColor = palette[0] || "#111827";
  const accentColor = palette[1] || "#4F46E5";
  const secondaryColor = palette[2] || "#F3F4F6";
  const phone = placePhone(place);
  const mapsUrl = placeMapsUrl(place);
  const address = place.formatted_address || place.formattedAddress || "";
  const rating = Number(place.rating || 0);
  const reviewCount = Number(place.user_ratings_total || place.userRatingCount || 0);
  const locale = inferLocaleFromPlace(place);
  const isEnglish = locale.language === "en";
  const context = [
    businessName,
    address,
    Array.isArray(place.types) ? place.types.join(" ") : "",
    place.searchQuery,
    options.searchQuery,
  ].filter(Boolean).join(" ");
  const stylePreset = inferStylePresetFromText(context);
  const stylePresetMeta = getStylePreset(stylePreset);
  const visualStyle = inferVisualStyleFromText(context);
  const visualStyleMeta = siteVisualStyles.find((item) => item.id === visualStyle) || siteVisualStyles[0];
  const shaderPreset = inferShaderPresetFromText(context);
  const shaderPresetMeta = getShaderPreset(shaderPreset);
  const fontPairingOptions = fontPairingsForText(context, 5);
  const fontPairingSeed = [
    businessName,
    businessId,
    place.place_id || place.id || "",
    address,
  ].filter(Boolean).join(" ");
  const fontPairing = fontPairingVariantForText(context, fontPairingSeed, 5).id;
  const fontPairingMeta = getFontPairing(fontPairing);
  const googleReviews = Array.isArray(place.reviews) ? place.reviews : [];
  const offeringMode = inferProductServiceMode(place);
  const offerings = buildOfferings(place, isEnglish, offeringMode, imageUrl, options.searchQuery);
  const typeLabel = meaningfulTypeLabel(place, isEnglish, options.searchQuery);
  const businessStatus = place.business_status || place.businessStatus || "";
  const websiteUrl = place.website || place.websiteUri || "";
  const servedAreas = placeServedAreas(place, options.searchQuery || place.searchQuery || "");
  const products = offerings.filter((item) => item.type === "product");
  const services = offerings.filter((item) => item.type === "service");
  const photoUrls = Array.isArray(place.photos)
    ? place.photos
        .map((photo: any) => photoReference(photo))
        .filter(Boolean)
        .slice(0, 8)
        .map((reference: string) => `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=960`)
    : [];
  const reviews = googleReviews.slice(0, 3).map((review: any) => ({
    authorName: review.author_name || review.authorName || "Google reviewer",
    rating: Number(review.rating || 5),
    text: review.text || "",
    relativePublishTimeDescription: review.relative_time_description || review.relativePublishTimeDescription || "",
    attribution: "Google",
  }));
  const offeringMenuChildren = offerings.map((item) => ({
    label: item.title,
    href: `#${item.detailPageId}`,
    description: item.type === "product"
      ? (isEnglish ? "Product detail" : "Detail produk")
      : (isEnglish ? "Service detail" : "Detail layanan"),
  }));
  const offeringDetailPages = offerings.map((item) => ({
    pageId: item.detailPageId,
    pageTitle: item.title,
    sections: [
      {
        type: "hero",
        id: `${item.id}-hero`,
        content: {
          headline: isEnglish ? `${item.title} from ${businessName}` : `${item.title} dari ${businessName}`,
          subheadline: item.summary,
          buttons: [
            { text: isEnglish ? "Ask about this" : "Tanya layanan/produk ini", href: "#contact", style: "primary" },
            { text: isEnglish ? "Back to offers" : "Lihat pilihan lain", href: "#services", style: "outline" },
          ],
          image: item.image,
        },
      },
      {
        type: "offeringDetail",
        id: `${item.id}-detail`,
        content: {
          kind: item.type === "product" ? (isEnglish ? "Product" : "Produk") : (isEnglish ? "Service" : "Layanan"),
          title: item.title,
          summary: item.summary,
          description: item.description,
          priceHint: item.priceHint,
          image: item.image,
          bestFor: item.bestFor,
          included: item.included,
          highlights: item.highlights,
        },
      },
      {
        type: "features",
        id: `${item.id}-features`,
        content: {
          title: isEnglish ? `Why choose ${item.title}` : `Kenapa memilih ${item.title}`,
          items: [
            {
              title: item.type === "product" ? (isEnglish ? "Clear product fit" : "Produk mudah dipahami") : (isEnglish ? "Clear service fit" : "Layanan mudah dipahami"),
              description: item.summary,
              iconSvg: iconSvgForText(item.type === "product" ? "product" : "service"),
            },
            {
              title: isEnglish ? "Fast next step" : "Langkah berikutnya cepat",
              description: isEnglish ? "Call, ask questions, or open maps when you are ready for the next step." : "Telepon, bertanya, atau buka maps saat siap mengambil langkah berikutnya.",
              iconSvg: iconSvgForText("fast contact"),
            },
            {
              title: isEnglish ? "Local context" : "Konteks lokal",
              description: address || (isEnglish ? "Built around local customer intent." : "Disusun sesuai kebutuhan pelanggan lokal."),
              iconSvg: iconSvgForText("local maps"),
            },
          ],
        },
      },
      {
        type: "reviews",
        id: `${item.id}-reviews`,
        content: {
          title: isEnglish ? `Relevant customer notes for ${item.title}` : `Catatan pelanggan terkait ${item.title}`,
          reviews: keywordRelevantReviews(googleReviews, item.relatedReviewKeywords),
        },
      },
      {
        type: "faq",
        id: `${item.id}-faq`,
        content: {
          title: isEnglish ? `Questions about ${item.title}` : `Pertanyaan tentang ${item.title}`,
          items: [
            {
              question: isEnglish ? `How do I ask about ${item.title}?` : `Bagaimana cara bertanya tentang ${item.title}?`,
              answer: isEnglish ? "Use the contact button or call the business directly for current availability and pricing." : "Gunakan tombol kontak atau hubungi bisnis langsung untuk ketersediaan dan harga terbaru.",
            },
            {
              question: isEnglish ? "Can details be customized?" : "Apakah detail bisa disesuaikan?",
              answer: isEnglish ? "Yes. Call with your exact need, timing, location, and any requirements so the next step is clear." : "Bisa. Hubungi dengan kebutuhan, waktu, lokasi, dan syarat khusus agar langkah berikutnya jelas.",
            },
          ],
        },
      },
      { type: "hoursLocation", id: `${item.id}-contact`, content: { title: isEnglish ? "Contact and location" : "Kontak dan lokasi", address, phone, directionsUrl: mapsUrl } },
    ],
  }));

  const scaffold: any = {
    meta: {
      businessName,
      businessId,
      niche: typeLabel,
      language: locale.language,
      region: locale.region,
      seoDescription: isEnglish ? `Official website for ${businessName}.` : `Website resmi untuk ${businessName}.`,
      faviconSvg: faviconSvgForBusiness(businessName, primaryColor),
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
      businessStatus,
      pureServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness),
      hasWebsite: Boolean(websiteUrl),
      websiteUri: websiteUrl || null,
      attributions: options.selectedPhotoAttributions || [],
    },
    design: {
      stylePreset,
      stylePresetConfig: { label: stylePresetMeta.label, mood: stylePresetMeta.mood, industries: stylePresetMeta.industries, recommendedColors: stylePresetMeta.recommendedColors },
      visualStyle,
      visualStyleConfig: { label: visualStyleMeta.label, description: visualStyleMeta.description, allowedValues: siteVisualStyles.map((item) => item.id), selectionRule: "Choose the visual structure that best matches the industry and desired feel." },
      shaderPreset,
      shaderConfig: { preset: shaderPreset, label: shaderPresetMeta.label, description: shaderPresetMeta.description, defaultOpacity: shaderPresetMeta.defaultOpacity, defaultMotion: shaderPresetMeta.defaultMotion, allowedValues: siteShaderPresets.map((item) => item.id), selectionRule: "Choose a lightweight CSS procedural shader that matches the industry mood. Use none for maximum restraint." },
      fontPairing,
      fontPairingConfig: { label: fontPairingMeta.label, headingFont: fontPairingMeta.headingFont, bodyFont: fontPairingMeta.bodyFont, mood: fontPairingMeta.mood, allowedValues: fontPairingOptions.map((item) => item.id), selectionMode: "stable_seeded_business_variant", seed: fontPairingSeed, selectionRule: "Choose an industry-matched Google Font pairing; owners can switch among these matching options before download." },
      themeVariables: { colors: { primary: primaryColor, secondary: secondaryColor, accent: accentColor, textMain: "#1F2937", textMuted: "#6B7280", background: "#FFFFFF" }, typography: { headingFont: fontPairingMeta.headingCss, bodyFont: fontPairingMeta.bodyCss } },
    },
    brand: {
      logoImageUrl: imageUrl,
      logoSvg: "",
      faviconSvg: faviconSvgForBusiness(businessName, primaryColor),
      palette,
      paletteOptions,
      preferredHeroImage: imageUrl,
      photoSource: imageUrl ? (options.selectedPhotoSource || "google_places") : "",
      googlePhotoReference: options.selectedPhotoReference || "",
      photoCaption: imageUrl ? "Photo from Google Business Profile" : "",
      photoAttributions: options.selectedPhotoAttributions || [],
      selectedPhotoPriority: options.selectedPhotoPriority || "",
    },
    businessProfile: {
      name: businessName,
      primaryType: typeLabel,
      typeLabel,
      categories: Array.isArray(place.types) ? place.types : [],
      shortPitch: isEnglish ? `A trusted ${typeLabel} serving customers around ${address || "the local area"}.` : `Layanan lokal terpercaya di ${address || "area sekitar"}.`,
      address: { formatted: address },
      serviceAreas: servedAreas,
      contact: { phoneNational: phone, phoneInternational: phone, directionsUrl: mapsUrl },
    },
    trust: {
      rating,
      reviewCount,
      reviewSummary: reviewCount ? (isEnglish ? `${businessName} has a ${rating.toFixed(1)} rating from ${reviewCount} Google reviews.` : `${businessName} memiliki rating ${rating.toFixed(1)} dari ${reviewCount} review Google.`) : "",
      reviews,
      badges: [businessStatus === "OPERATIONAL" ? "Operational" : "", websiteUrl ? "Has website" : "No website lead", phone ? "Has phone" : ""].filter(Boolean),
    },
    productServiceStrategy: {
      mode: offeringMode,
      reasoning: isEnglish ? "The generator inferred whether this business should emphasize products, services, or both from Google Places types and the business name." : "Generator menentukan apakah bisnis ini lebih cocok menampilkan produk, layanan, atau keduanya dari tipe Google Places dan nama bisnis.",
      navbarGroupLabel: offeringMode === "products" ? (isEnglish ? "Products" : "Produk") : offeringMode === "both" ? (isEnglish ? "Products & Services" : "Produk & Layanan") : (isEnglish ? "Services" : "Layanan"),
      detailPageRule: isEnglish ? "Each offering has a dedicated page with overview, benefits, included details, reviews, FAQ, and conversion CTA." : "Setiap penawaran punya halaman detail berisi overview, manfaat, detail yang termasuk, review, FAQ, dan CTA.",
    },
    products,
    services,
    offers: offerings.map((item) => ({ title: item.title, description: item.summary, priceHint: item.priceHint, image: item.image, cta: { text: isEnglish ? "View details" : "Lihat detail", href: `#${item.detailPageId}` } })),
    capabilities: [
      { label: isEnglish ? "Local business" : "Bisnis lokal", enabled: true, source: "google_places.types", description: isEnglish ? "Business profile data is gathered from Google Places." : "Profil bisnis diambil dari data Google Places." },
      { label: "Google rating", enabled: rating > 0, source: "google_places.rating", description: reviewCount ? (isEnglish ? `${reviewCount} reviews available.` : `${reviewCount} review tersedia.`) : (isEnglish ? "Rating is not available yet." : "Rating belum tersedia.") },
      { label: isEnglish ? "Direct contact" : "Kontak langsung", enabled: Boolean(phone), source: "google_places.phone", description: isEnglish ? "CTA points to the business contact when available." : "CTA diarahkan ke kontak bisnis." },
    ],
    location: { formattedAddress: address, directionsUrl: mapsUrl, isServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness), servedAreas },
    locationServed: servedAreas,
    hours: { timezone: "", openNow: Boolean(place.opening_hours?.open_now), regular: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : [], current: [] },
    conversion: {
      primaryCta: { text: isEnglish ? "Call Now" : "Hubungi Sekarang", href: phone ? `tel:${phone}` : "#contact" },
      secondaryCta: { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact" },
      stickyMobileCta: true,
      leadForm: { enabled: true, fields: ["name", "phone", "message"], submitLabel: isEnglish ? "Send Message" : "Kirim Pesan" },
    },
    seo: {
      title: isEnglish ? `${businessName} - Official Website` : `${businessName} - Website Resmi`,
      description: isEnglish ? `Official website for ${businessName} in ${address || "the local area"}.` : `Website resmi untuk ${businessName} di ${address || "area lokal"}.`,
      localBusinessSchema: {},
      keywords: Array.isArray(place.types) ? place.types : [],
      cityLandingPhrase: address,
    },
    global: { header: { logoImageUrl: imageUrl, ctaButton: { text: isEnglish ? "Call Now" : "Hubungi", href: phone ? `tel:${phone}` : "#contact" } }, footer: { text: `© 2026 ${businessName}. All rights reserved.` } },
    navigation: {
      headerMenu: [
        { label: isEnglish ? "Home" : "Beranda", href: "#home" },
        {
          label: offeringMode === "products" ? (isEnglish ? "Products" : "Produk") : offeringMode === "both" ? (isEnglish ? "Products & Services" : "Produk & Layanan") : (isEnglish ? "Services" : "Layanan"),
          href: "#services",
          children: offeringMenuChildren,
        },
        { label: isEnglish ? "Contact" : "Kontak", href: "#contact" },
      ],
    },
    pages: [
      {
        pageId: "home",
        pageTitle: isEnglish ? "Home" : "Beranda",
        sections: [
          { type: "hero", id: "hero-1", content: { headline: isEnglish ? `${businessName} is ready to help locally` : `${businessName} siap membantu kebutuhan lokal Anda`, subheadline: address || (isEnglish ? "Business information from Google Places." : "Informasi bisnis dari Google Places."), buttons: [{ text: isEnglish ? "Contact Us" : "Hubungi Kami", href: "#contact", style: "primary" }, { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl || "#contact", style: "outline" }], image: imageUrl } },
          { type: "trustBar", id: "trust-1", content: { items: [{ label: "Google Rating", value: rating ? rating.toFixed(1) : "-" }, { label: "Reviews", value: reviewCount ? `${reviewCount}+` : "-" }, { label: "Phone", value: phone || (isEnglish ? "Available soon" : "Segera tersedia") }] } },
          { type: "features", id: "features-1", content: { title: isEnglish ? "Why this business stands out" : "Kenapa bisnis ini relevan", items: [{ title: isEnglish ? "Local business profile" : "Profil bisnis lokal", description: businessStatus || (isEnglish ? "Find service details, location, and next steps in one place." : "Temukan detail layanan, lokasi, dan langkah berikutnya di satu tempat."), iconSvg: iconSvgForText("local maps") }, { title: isEnglish ? "Easy to contact" : "Mudah dihubungi", description: phone || (isEnglish ? "Reach out with your questions and preferred timing." : "Hubungi kami dengan pertanyaan dan waktu yang diinginkan."), iconSvg: iconSvgForText("contact call") }, { title: isEnglish ? "Simple next step" : "Langkah berikutnya mudah", description: websiteUrl ? (isEnglish ? "Review the available details, then contact us when you are ready." : "Lihat detail yang tersedia, lalu hubungi kami saat siap.") : (isEnglish ? "Call or send a question to confirm service fit and availability." : "Telepon atau kirim pertanyaan untuk memastikan kecocokan layanan dan ketersediaan."), iconSvg: iconSvgForText("contact next step") }] } },
          { type: "offers", id: "offers-1", content: { title: isEnglish ? "Services to highlight" : "Layanan yang bisa ditonjolkan", items: offerings } },
          ...(photoUrls.length > 1 ? [{ type: "imageGallery", id: "gallery", content: { title: isEnglish ? "Project and profile photos" : "Foto profil dan pekerjaan", images: photoUrls } }] : []),
          { type: "reviews", id: "reviews-1", content: { title: isEnglish ? "Google social proof" : "Social proof dari Google", reviews } },
          { type: "hoursLocation", id: "location-1", content: { title: isEnglish ? "Location and contact" : "Lokasi dan kontak", address, phone, directionsUrl: mapsUrl } },
          { type: "faq", id: "faq-1", content: { title: isEnglish ? "Common questions" : "Pertanyaan umum", items: [{ question: isEnglish ? "How do I contact this business?" : "Bagaimana cara menghubungi bisnis ini?", answer: phone ? (isEnglish ? `Call directly at ${phone}.` : `Hubungi langsung di ${phone}.`) : (isEnglish ? "Phone number is not available yet and can be completed manually." : "Nomor telepon belum tersedia dan bisa dilengkapi manual.") }, { question: isEnglish ? "What should I prepare before contacting you?" : "Apa yang perlu disiapkan sebelum menghubungi?", answer: isEnglish ? "Share what you need, your location, preferred timing, and any important details so we can point you to the right next step." : "Sampaikan kebutuhan, lokasi, waktu yang diinginkan, dan detail penting agar kami bisa mengarahkan langkah berikutnya." }] } },
        ],
      },
      ...offeringDetailPages,
    ],
  };
  applyGeneratedSitePageInserts(scaffold, place);
  return scaffold;
}
