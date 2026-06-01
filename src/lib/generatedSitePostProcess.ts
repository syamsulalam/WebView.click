export type GeneratedSiteRecord = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringList(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]+/) : value ? [value] : [];
  const seen = new Set<string>();
  return values
    .map((item: unknown) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const source = item as Record<string, unknown>;
        return String(source.name || source.city || source.label || source.area || source.description || source.text || "").trim();
      }
      return "";
    })
    .filter((item: string) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function safeCopyText(value: unknown, maxLength = 420) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const clean = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;

  const clipped = clean.slice(0, maxLength).trim();
  const sentenceMinimum = Math.min(Math.max(80, Math.floor(maxLength * 0.55)), Math.max(0, maxLength - 1));
  const sentenceStops = [...clipped.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentenceStop = sentenceStops[sentenceStops.length - 1];
  if (lastSentenceStop && lastSentenceStop.index !== undefined && lastSentenceStop.index + 1 >= sentenceMinimum) {
    return clipped.slice(0, lastSentenceStop.index + 1).trim();
  }

  const wordMinimum = Math.min(Math.max(32, Math.floor(maxLength * 0.72)), Math.max(0, maxLength - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace >= wordMinimum) {
    return clipped.slice(0, lastSpace).replace(/[,:;/-]+$/g, "").trim();
  }
  return clipped.replace(/[,:;/-]+$/g, "").trim();
}

export function photoReferenceFromPlacePhoto(photo: unknown) {
  if (!photo || typeof photo !== "object" || Array.isArray(photo)) return "";
  const record = photo as Record<string, unknown>;
  return asString(record.photo_reference, asString(record.reference, asString(record.name)));
}

export function googlePlacesPhotoProxyUrl(reference: string, maxWidth = 960) {
  return `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=${maxWidth}`;
}

export function addUniqueImageUrl(target: string[], value: unknown) {
  const url = asString(value).trim();
  if (!url || target.includes(url)) return;
  target.push(url);
}

function isUsableImageUrl(value: unknown) {
  const url = asString(value).trim();
  return Boolean(url && (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:")));
}

function firstUsableImage(...values: unknown[]) {
  return values.map((value) => asString(value).trim()).find(isUsableImageUrl) || "";
}

export function collectGalleryImages(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord) {
  const images: string[] = [];
  const brand = objectValue(finalJson.brand);
  addUniqueImageUrl(images, brand.preferredHeroImage);
  addUniqueImageUrl(images, brand.logoImageUrl);

  for (const key of ["products", "services", "offers"]) {
    const items = Array.isArray(finalJson[key]) ? finalJson[key] as Array<Record<string, unknown>> : [];
    for (const item of items) {
      addUniqueImageUrl(images, item.image);
    }
  }

  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    for (const section of sections) {
      const content = objectValue(section.content);
      if (asString(section.type) === "imageGallery" && Array.isArray(content.images)) {
        for (const image of content.images) addUniqueImageUrl(images, image);
      }
    }
  }

  const photos = Array.isArray(originData.photos) ? originData.photos : [];
  for (const photo of photos) {
    const reference = photoReferenceFromPlacePhoto(photo);
    if (reference) addUniqueImageUrl(images, googlePlacesPhotoProxyUrl(reference, 960));
  }

  return images.filter((image) => !image.startsWith("data:")).slice(0, 8);
}

export function ensureGalleryPage(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const hasGallery = pages.some((page) =>
    asString(page.pageId).toLowerCase() === "gallery",
  );
  if (hasGallery) return;

  const galleryImages = collectGalleryImages(finalJson, originData);
  if (galleryImages.length < 2) return;

  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  pages.push({
    pageId: "gallery",
    pageTitle: isIndonesian ? "Galeri" : "Gallery",
    sections: [
      {
        type: "imageGallery",
        id: "gallery-main",
        content: {
          title: isIndonesian ? "Galeri Foto" : "Photo Gallery",
          description: isIndonesian ? "Foto profil bisnis dan visual yang tersedia dari data Google Business Profile." : "Business profile photos and available visuals from Google Business Profile data.",
          images: galleryImages,
        },
      },
    ],
  });
  finalJson.pages = pages;

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#gallery")) {
    const galleryItem = { label: isIndonesian ? "Galeri" : "Gallery", href: "#gallery" };
    const contactIndex = headerMenu.findIndex((item) => /contact|kontak/i.test(asString(item.label)) || asString(item.href) === "#contact");
    if (contactIndex >= 0) {
      headerMenu.splice(contactIndex, 0, galleryItem);
    } else {
      headerMenu.push(galleryItem);
    }
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

export function offeringIndexItems(finalJson: GeneratedSiteRecord) {
  const products = Array.isArray(finalJson.products) ? finalJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(finalJson.services) ? finalJson.services as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(finalJson.offers) ? finalJson.offers as Array<Record<string, unknown>> : [];
  const sourceItems = [...products, ...services].length > 0 ? [...products, ...services] : offers;
  return sourceItems
    .map((item) => ({
      title: item.title || item.label,
      navLabel: item.navLabel || item.shortLabel,
      description: item.summary || item.description,
      priceHint: item.priceHint,
      image: item.image,
      href: item.href,
      detailPageId: item.detailPageId,
      cta: item.cta,
    }))
    .filter((item) => item.title || item.description || item.href || item.detailPageId);
}

function shortOfferingMenuLabel(item: Record<string, unknown>) {
  const explicit = safeCopyText(item.navLabel || item.shortLabel, 34);
  if (explicit) return explicit;
  const raw = safeCopyText(item.title || item.label, 90);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\b(services?|products?|solutions?|packages?|programs?)\b/gi, "")
    .replace(/\b(for|and|with|from|by|near me)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const source = cleaned || raw;
  if (source.length <= 28) return source;
  const words = source.split(/\s+/).filter(Boolean);
  const compact = words.slice(0, 3).join(" ");
  return compact.length <= 34 ? compact : compact.slice(0, 31).replace(/\s+\S*$/, "").trim() || source.slice(0, 28).trim();
}

export function repairOfferingNavLabels(finalJson: GeneratedSiteRecord) {
  const products = Array.isArray(finalJson.products) ? finalJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(finalJson.services) ? finalJson.services as Array<Record<string, unknown>> : [];
  let changed = 0;
  [...products, ...services].forEach((item) => {
    if (safeCopyText(item.navLabel || item.shortLabel, 34)) return;
    const label = shortOfferingMenuLabel(item);
    if (!label) return;
    item.navLabel = label;
    changed += 1;
  });
  return { changed };
}

export function ensureAboutPage(finalJson: GeneratedSiteRecord) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const hasAboutPage = pages.some((page) => asString(page.pageId).toLowerCase() === "about");
  const meta = objectValue(finalJson.meta);
  const businessProfile = objectValue(finalJson.businessProfile);
  const brand = objectValue(finalJson.brand);
  const trust = objectValue(finalJson.trust);
  const location = objectValue(finalJson.location);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const businessName = asString(meta.businessName, asString(businessProfile.name, isIndonesian ? "Bisnis ini" : "This business"));
  const niche = asString(businessProfile.typeLabel, asString(businessProfile.primaryType, asString(meta.niche)));
  const address = asString(location.formattedAddress, asString(objectValue(businessProfile.address).formatted));
  const shortPitch = safeCopyText(businessProfile.shortPitch || meta.seoDescription, 420);
  const image = firstUsableImage(brand.preferredHeroImage, brand.logoImageUrl);

  if (!hasAboutPage) {
    pages.splice(Math.min(1, pages.length), 0, {
      pageId: "about",
      pageTitle: isIndonesian ? "Tentang" : "About",
      sections: [
        {
          type: "hero",
          id: "about-hero",
          content: {
            headline: isIndonesian ? `Tentang ${businessName}` : `About ${businessName}`,
            subheadline: shortPitch || (isIndonesian
              ? `Kami membantu pelanggan lokal memahami layanan, lokasi, dan langkah berikutnya untuk ${niche || "kebutuhan ini"}.`
              : `We help local customers understand our ${niche || "services"}, location, and next step before they contact us.`),
            buttons: [
              { text: isIndonesian ? "Lihat layanan" : "View services", href: "#services", style: "primary" },
              { text: isIndonesian ? "Hubungi kami" : "Contact us", href: "#contact", style: "outline" },
            ],
            image,
          },
        },
        {
          type: "features",
          id: "about-values",
          content: {
            title: isIndonesian ? "Cara kami membantu pelanggan" : "How we help customers",
            description: isIndonesian
              ? "Halaman ini memberi konteks singkat tentang bisnis, pendekatan layanan, dan alasan pelanggan menghubungi kami."
              : "This page gives visitors quick context about the business, service approach, and reasons to get in touch.",
            items: [
              {
                title: isIndonesian ? "Fokus lokal" : "Local focus",
                description: address || (isIndonesian ? "Dibuat untuk pelanggan di area sekitar." : "Built around customers in the local service area."),
              },
              {
                title: isIndonesian ? "Langkah jelas" : "Clear next steps",
                description: isIndonesian ? "Pengunjung dapat melihat layanan, membuka maps, atau menghubungi langsung." : "Visitors can review services, open maps, or contact the business directly.",
              },
              {
                title: isIndonesian ? "Bukti kepercayaan" : "Trust context",
                description: Number(trust.rating || 0) > 0
                  ? (isIndonesian ? `Rating Google ${Number(trust.rating).toFixed(1)} ditampilkan sebagai konteks kepercayaan.` : `A ${Number(trust.rating).toFixed(1)} Google rating is included as trust context.`)
                  : (isIndonesian ? "Profil bisnis dapat dilengkapi dengan ulasan dan bukti sosial." : "The business profile can be completed with reviews and social proof."),
              },
            ],
          },
        },
        {
          type: "gridCards",
          id: "about-approach",
          content: {
            title: isIndonesian ? "Yang bisa diharapkan" : "What visitors can expect",
            description: isIndonesian
              ? "Konten dapat disesuaikan setelah pemilik bisnis meninjau detail layanan."
              : "The copy can be refined after the business owner reviews the service details.",
            cards: [
              { title: isIndonesian ? "Informasi layanan" : "Service information", description: isIndonesian ? "Ringkasan layanan utama dan halaman detail tersedia." : "Core service summaries and detail pages are included.", image },
              { title: isIndonesian ? "Kontak mudah" : "Easy contact", description: isIndonesian ? "Tombol panggilan, formulir, dan arah maps disiapkan." : "Call buttons, inquiry form, and directions are ready.", image },
              { title: isIndonesian ? "Siap dikembangkan" : "Ready to refine", description: isIndonesian ? "Pemilik bisa menyesuaikan teks, gambar, dan halaman tambahan." : "The owner can refine copy, images, and added pages.", image },
            ],
          },
        },
      ],
    });
    finalJson.pages = pages;
  }

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#about")) {
    const aboutItem = { label: isIndonesian ? "Tentang" : "About", href: "#about" };
    const homeIndex = headerMenu.findIndex((item) => asString(item.href) === "#home");
    headerMenu.splice(homeIndex >= 0 ? homeIndex + 1 : Math.min(1, headerMenu.length), 0, aboutItem);
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

function detailPageImageById(finalJson: GeneratedSiteRecord) {
  const result = new Map<string, string>();
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  pages.forEach((page) => {
    const pageId = asString(page.pageId);
    if (!pageId) return;
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    for (const section of sections) {
      const content = objectValue(section.content);
      const image = firstUsableImage(content.image, content.media, content.photo);
      if (image) {
        result.set(pageId, image);
        break;
      }
    }
  });
  return result;
}

function pageGalleryImages(finalJson: GeneratedSiteRecord) {
  const images: string[] = [];
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    for (const section of sections) {
      const content = objectValue(section.content);
      if (asString(section.type) === "imageGallery" && Array.isArray(content.images)) {
        for (const image of content.images) addUniqueImageUrl(images, image);
      }
    }
  }
  return images.filter(isUsableImageUrl);
}

function availableServiceImages(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord) {
  const images: string[] = [];
  const brand = objectValue(finalJson.brand);
  pageGalleryImages(finalJson).forEach((image) => addUniqueImageUrl(images, image));
  collectGalleryImages(finalJson, originData).forEach((image) => addUniqueImageUrl(images, image));
  addUniqueImageUrl(images, brand.preferredHeroImage);
  addUniqueImageUrl(images, brand.logoImageUrl);
  return images.filter(isUsableImageUrl);
}

function imageUsageFor(items: Array<Record<string, unknown>>) {
  const usage = new Map<string, number>();
  items.forEach((item) => {
    const image = firstUsableImage(item.image);
    if (image) usage.set(image, (usage.get(image) || 0) + 1);
  });
  return usage;
}

export function repairServiceCardImages(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const products = Array.isArray(finalJson.products) ? finalJson.products as Array<Record<string, unknown>> : [];
  const services = Array.isArray(finalJson.services) ? finalJson.services as Array<Record<string, unknown>> : [];
  const offers = Array.isArray(finalJson.offers) ? finalJson.offers as Array<Record<string, unknown>> : [];
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const detailImages = detailPageImageById(finalJson);
  const fallbackImages = availableServiceImages(finalJson, originData);
  const detailImageUsage = new Map<string, number>();
  detailImages.forEach((image) => detailImageUsage.set(image, (detailImageUsage.get(image) || 0) + 1));
  const currentImageUsage = imageUsageFor([...products, ...services]);
  const offerCurrentImageUsage = imageUsageFor(offers);
  let changed = 0;

  const imageForOffering = (item: Record<string, unknown>, index: number) => {
    const currentImage = firstUsableImage(item.image);
    const detailPageId = asString(item.detailPageId);
    const detailImage = firstUsableImage(detailImages.get(detailPageId));
    const rotatedImage = firstUsableImage(fallbackImages[index % Math.max(1, fallbackImages.length)]);
    if (currentImage && (currentImageUsage.get(currentImage) || 0) === 1) return currentImage;
    if (detailImage && (detailImageUsage.get(detailImage) || 0) === 1) return detailImage;
    return firstUsableImage(rotatedImage, currentImage, detailImage);
  };

  const offerings = [...products, ...services];
  offerings.forEach((item, index) => {
    const image = imageForOffering(item, index);
    if (image && item.image !== image) {
      item.image = image;
      changed += 1;
    }
  });

  const offeringImageById = new Map<string, string>();
  offerings.forEach((item, index) => {
    const image = imageForOffering(item, index);
    const detailPageId = asString(item.detailPageId);
    if (detailPageId && image) offeringImageById.set(detailPageId, image);
    const title = asString(item.title).toLowerCase();
    if (title && image) offeringImageById.set(`title:${title}`, image);
  });

  offers.forEach((offer, index) => {
    const detailPageId = asString(offer.detailPageId, asString(objectValue(offer.cta).href).replace(/^#/, ""));
    const titleKey = `title:${asString(offer.title).toLowerCase()}`;
    const currentImage = firstUsableImage(offer.image);
    const matchedImage = firstUsableImage(
      detailPageId ? offeringImageById.get(detailPageId) : "",
      offeringImageById.get(titleKey),
    );
    const image = currentImage && (offerCurrentImageUsage.get(currentImage) || 0) === 1
      ? currentImage
      : firstUsableImage(
          matchedImage,
          fallbackImages[index % Math.max(1, fallbackImages.length)],
          currentImage,
        );
    if (image && offer.image !== image) {
      offer.image = image;
      changed += 1;
    }
  });

  pages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections
      .filter((section) => asString(section.type) === "offers")
      .forEach((section) => {
        const content = objectValue(section.content);
        const items = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
        const itemImageUsage = imageUsageFor(items);
        items.forEach((item, index) => {
          const detailPageId = asString(item.detailPageId, asString(objectValue(item.cta).href).replace(/^#/, ""));
          const titleKey = `title:${asString(item.title).toLowerCase()}`;
          const currentImage = firstUsableImage(item.image);
          const matchedImage = firstUsableImage(
            detailPageId ? offeringImageById.get(detailPageId) : "",
            offeringImageById.get(titleKey),
          );
          const image = currentImage && (itemImageUsage.get(currentImage) || 0) === 1
            ? currentImage
            : firstUsableImage(
                matchedImage,
                fallbackImages[index % Math.max(1, fallbackImages.length)],
                currentImage,
              );
          if (image && item.image !== image) {
            item.image = image;
            changed += 1;
          }
        });
        section.content = content;
      });
  });

  return { changed, availableImages: fallbackImages.length };
}

export function ensureServicesPage(finalJson: GeneratedSiteRecord) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const items = offeringIndexItems(finalJson);
  if (items.length === 0) return;

  const hasServicesPage = pages.some((page) => asString(page.pageId).toLowerCase() === "services");
  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");

  if (!hasServicesPage) {
    pages.push({
      pageId: "services",
      pageTitle: isIndonesian ? "Layanan" : "Services",
      sections: [
        {
          type: "offers",
          id: "services",
          content: {
            title: isIndonesian ? "Semua produk dan layanan" : "All Products and Services",
            description: isIndonesian
              ? "Pilih penawaran untuk melihat halaman detail, manfaat, dan langkah berikutnya."
              : "Choose an offering to view details, benefits, and the next step.",
            items,
          },
        },
      ],
    });
    finalJson.pages = pages;
  } else {
    pages
      .filter((page) => asString(page.pageId).toLowerCase() === "services")
      .forEach((page) => {
        const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
        const offersSection = sections.find((section) => asString(section.type) === "offers");
        if (!offersSection) return;
        const content = objectValue(offersSection.content);
        content.items = items;
        offersSection.content = content;
      });
  }

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#services")) {
    headerMenu.push({
      label: isIndonesian ? "Layanan" : "Services",
      href: "#services",
    });
  }
  const servicesMenu = headerMenu.find((item) => asString(item.href) === "#services");
  if (servicesMenu) {
    servicesMenu.children = items
      .map((item) => ({
        label: shortOfferingMenuLabel(item),
        href: item.detailPageId ? `#${item.detailPageId}` : asString(item.href, asString(objectValue(item.cta).href)),
      }))
      .filter((item) => item.label && item.href);
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

export function ensureFeedbackPage(finalJson: GeneratedSiteRecord) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  if (pages.some((page) => asString(page.pageId).toLowerCase() === "feedback")) return;

  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  pages.push({
    pageId: "feedback",
    pageTitle: "Feedback",
    sections: [
      {
        type: "feedback",
        id: "feedback",
        content: {
          title: isIndonesian ? "Bagaimana pengalaman Anda?" : "How was your experience?",
          description: isIndonesian
            ? "Jika Anda sudah memakai layanan ini, beri rating agar bisnis bisa menjaga kualitasnya."
            : "If you have used this service, share a quick rating so the business can keep improving.",
        },
      },
    ],
  });
  finalJson.pages = pages;
}

function sourceTextForConversion(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const meta = objectValue(finalJson.meta);
  const profile = objectValue(finalJson.businessProfile);
  const sourceData = objectValue(finalJson.sourceData);
  return [
    meta.businessName,
    meta.niche,
    profile.name,
    profile.primaryType,
    profile.typeLabel,
    Array.isArray(profile.categories) ? profile.categories.join(" ") : "",
    sourceData.searchQuery,
    originData.searchQuery,
    Array.isArray(originData.types) ? originData.types.join(" ") : "",
    originData.formatted_address,
    originData.formattedAddress,
  ].map((item) => asString(item)).filter(Boolean).join(" ").toLowerCase();
}

function conversionPagePattern(text: string) {
  if (/(emergency|24 hour|24\/7|locksmith|towing|water damage|restoration|urgent|same day|hvac|plumb|electric|garage door)/i.test(text)) return "emergency-service";
  if (/(restaurant|cafe|coffee|bakery|food|pizza|taco|bar|bistro|diner|menu)/i.test(text)) return "menu-led-restaurant";
  if (/(law|attorney|legal|notary|tax|accountant|accounting|bookkeeping|financial|finance|insurance|advisor|consulting|professional)/i.test(text)) return "trust-led-professional";
  if (/(salon|spa|massage|beauty|nail|lashes|brow|esthetician|hair|clinic|dental|doctor|medical|fitness|gym|yoga|pilates)/i.test(text)) return "booking-led-local";
  if (/(concrete|roof|contractor|construction|remodel|landscap|lawn|tree|floor|paint|masonry|paving|pool|cleaning|pressure washing|repair)/i.test(text)) return "gallery-led-craft";
  if (/(consult|agency|studio|design|architect|real estate|realtor|broker|mortgage)/i.test(text)) return "premium-consultation";
  return "quote-led-service";
}

function highTicketStyleDirection(pattern: string, text: string) {
  if (/(insurance|financial|finance|bookkeeping|mortgage|loan|wealth|advisor|payroll)/i.test(text)) {
    return { stylePreset: "financial-trust", visualStyle: "boxy-editorial", note: "Stable professional palette for financial trust and confidence." };
  }
  if (/(law|attorney|legal|notary|immigration|tax|accountant|accounting|paralegal)/i.test(text) || pattern === "trust-led-professional") {
    return { stylePreset: "legal-authority", visualStyle: "boxy-editorial", note: "Restrained authority layout for professional trust." };
  }
  if (/(salon|spa|massage|beauty|nail|lashes|brow|esthetician|hair)/i.test(text)) {
    return { stylePreset: "salon-soft-luxe", visualStyle: "soft-rounded", note: "Soft luxe treatment for appointment-led beauty and wellness." };
  }
  if (/(dentist|dental|orthodont|clinic|medical|doctor|chiropractor|therapy|health)/i.test(text)) {
    return { stylePreset: "dental-clean", visualStyle: "clean-minimal", note: "Clean clinical layout for booking-led care." };
  }
  if (/(restaurant|cafe|coffee|bakery|food|pizza|taco|bar|bistro|diner)/i.test(text) || pattern === "menu-led-restaurant") {
    return { stylePreset: "cafe-warm", visualStyle: "soft-rounded", note: "Editorial warmth for menu and visit intent." };
  }
  if (/(landscap|garden|lawn|tree|nursery|florist|yard|irrigation|mulch|arborist)/i.test(text)) {
    return { stylePreset: "garden-organic", visualStyle: "soft-rounded", note: "Organic outdoor direction for landscaping and garden work." };
  }
  if (/(pool|spa|swimming|aquatic|hot tub|water feature)/i.test(text)) {
    return { stylePreset: "pool-aqua", visualStyle: "clean-minimal", note: "Fresh water-forward direction for pool and aquatic services." };
  }
  if (/(cleaning|janitorial|maid|pressure washing|power washing|carpet clean|window clean)/i.test(text)) {
    return { stylePreset: "cleaning-fresh", visualStyle: "clean-minimal", note: "Bright checklist-friendly direction for cleaning services." };
  }
  if (/(locksmith|security|alarm|fire safety|surveillance|camera|access control)/i.test(text) || pattern === "emergency-service") {
    return { stylePreset: "security-trust", visualStyle: "industrial-diagonal", note: "Phone-first trust direction for urgent local services." };
  }
  if (/(auto|mechanic|tire|body shop|detailing|transmission|brake|collision|car wash|oil change)/i.test(text)) {
    return { stylePreset: "auto-shop-steel", visualStyle: "industrial-diagonal", note: "Mechanical high-contrast direction for auto services." };
  }
  if (/(gym|fitness|trainer|martial|boxing|yoga|pilates|crossfit|workout)/i.test(text)) {
    return { stylePreset: "fitness-energy", visualStyle: "bold-sport", note: "Energetic action direction for fitness and training." };
  }
  if (/(real estate|realtor|property|broker|home staging|apartment|rental|mortgage)/i.test(text) || pattern === "premium-consultation") {
    return { stylePreset: "real-estate-premium", visualStyle: "boxy-editorial", note: "Spacious premium direction for consultation-led decisions." };
  }
  if (pattern === "gallery-led-craft") {
    return { stylePreset: "contractor-rugged", visualStyle: "industrial-diagonal", note: "Rugged proof-forward direction for hands-on service work." };
  }
  return { stylePreset: "local-clean", visualStyle: "clean-minimal", note: "Clean local-business fallback with conversion-first structure." };
}

function applyHighTicketStyleDirection(finalJson: GeneratedSiteRecord, pattern: string, text: string) {
  const direction = highTicketStyleDirection(pattern, text);
  const design = objectValue(finalJson.design);
  const currentStyle = asString(design.stylePreset);
  const currentVisual = asString(design.visualStyle || design.shapeStyle);
  if (!currentStyle || currentStyle === "local-clean") design.stylePreset = direction.stylePreset;
  if (!currentVisual || currentVisual === "soft-rounded") design.visualStyle = direction.visualStyle;
  design.highTicketStyleDirection = {
    pagePattern: pattern,
    stylePreset: design.stylePreset,
    visualStyle: design.visualStyle,
    note: direction.note,
  };
  finalJson.design = design;
}

type DesignIntent = {
  compositionPattern: string;
  heroLayout: string;
  mediaStrategy: string;
  proofTreatment: string;
  cardDensity: string;
  ctaTreatment: string;
  motionLevel: string;
  sectionRhythm: string;
  detailLayout: string;
  antiPatterns: string[];
};

function availableMediaCount(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const brand = objectValue(finalJson.brand);
  const photos = Array.isArray(originData.photos) ? originData.photos : [];
  const galleryImages = collectGalleryImages(finalJson, originData);
  return [
    asString(brand.preferredHeroImage),
    asString(brand.logoImageUrl),
    ...photos.map(photoReferenceFromPlacePhoto),
    ...galleryImages,
  ].filter(Boolean).length;
}

function mediaStrategyFor(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}, pattern = "") {
  const brand = objectValue(finalJson.brand);
  const heroImage = asString(brand.preferredHeroImage, asString(brand.logoImageUrl));
  const mediaCount = availableMediaCount(finalJson, originData);
  const mapsUrl = mapsUrlFromSite(finalJson, originData);
  if (heroImage && mediaCount >= 3 && (pattern === "gallery-led-craft" || pattern === "menu-led-restaurant")) return "gallery-grid";
  if (heroImage) return "real-photo-hero";
  if (mapsUrl && (pattern === "menu-led-restaurant" || pattern === "emergency-service")) return "map-contact";
  if (asString(brand.logoSvg) || asString(brand.logoImageUrl)) return "logo-proof";
  if (mediaCount <= 0) return "minimal-no-photo";
  return "icon-card";
}

function patternLayoutDefaults(pattern: string): Omit<DesignIntent, "mediaStrategy"> {
  const defaults: Record<string, Omit<DesignIntent, "mediaStrategy">> = {
    "emergency-service": {
      compositionPattern: "emergency-phone",
      heroLayout: "phone-first-emergency",
      proofTreatment: "emergency-rail",
      cardDensity: "compact",
      ctaTreatment: "phone-rail",
      motionLevel: "subtle",
      sectionRhythm: "compressed-urgent",
      detailLayout: "contact-rail",
      antiPatterns: ["decorative hero", "hidden phone", "multiple primary CTAs", "soft low-contrast buttons"],
    },
    "menu-led-restaurant": {
      compositionPattern: "menu-visit",
      heroLayout: "menu-location",
      proofTreatment: "location-strip",
      cardDensity: "image-led",
      ctaTreatment: "directions-split",
      motionLevel: "standard",
      sectionRhythm: "editorial-warm",
      detailLayout: "menu-detail",
      antiPatterns: ["generic SaaS cards", "no hours near CTA", "unrelated stock imagery", "buried directions"],
    },
    "trust-led-professional": {
      compositionPattern: "trust-authority",
      heroLayout: "authority-panel",
      proofTreatment: "authority-bar",
      cardDensity: "editorial",
      ctaTreatment: "consultation-card",
      motionLevel: "subtle",
      sectionRhythm: "measured-authority",
      detailLayout: "authority-detail",
      antiPatterns: ["playful gradients", "oversized rounded cards", "unsupported credentials", "casual CTA hierarchy"],
    },
    "booking-led-local": {
      compositionPattern: "booking-service",
      heroLayout: "consultation-led",
      proofTreatment: "rating-strip",
      cardDensity: "standard",
      ctaTreatment: "booking-pill",
      motionLevel: "standard",
      sectionRhythm: "soft-premium",
      detailLayout: "booking-detail",
      antiPatterns: ["cold corporate layout", "unclear booking step", "dense legalistic copy", "missing appointment CTA"],
    },
    "gallery-led-craft": {
      compositionPattern: "gallery-craft",
      heroLayout: "gallery-led",
      proofTreatment: "gallery-proof",
      cardDensity: "image-led",
      ctaTreatment: "estimate-block",
      motionLevel: "subtle",
      sectionRhythm: "proof-forward",
      detailLayout: "scope-detail",
      antiPatterns: ["thin service cards", "image-free hero when photos exist", "generic learn-more CTAs", "no estimate path"],
    },
    "premium-consultation": {
      compositionPattern: "consultation-premium",
      heroLayout: "consultation-led",
      proofTreatment: "authority-bar",
      cardDensity: "editorial",
      ctaTreatment: "consultation-card",
      motionLevel: "subtle",
      sectionRhythm: "spacious-premium",
      detailLayout: "consultation-detail",
      antiPatterns: ["busy grids", "commodity pricing language", "generic startup hero", "unsupported guarantees"],
    },
    "quote-led-service": {
      compositionPattern: "quote-service",
      heroLayout: "split-media-proof",
      proofTreatment: "badge-row",
      cardDensity: "standard",
      ctaTreatment: "solid-contrast",
      motionLevel: "subtle",
      sectionRhythm: "balanced-local",
      detailLayout: "scope-detail",
      antiPatterns: ["generic contact us CTA", "no proof near hero", "long unscannable paragraphs", "same-looking sections"],
    },
  };
  return defaults[pattern] || defaults["quote-led-service"];
}

function buildDesignIntent(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}, pattern = ""): DesignIntent {
  const defaults = patternLayoutDefaults(pattern);
  const mediaStrategy = mediaStrategyFor(finalJson, originData, pattern);
  if (mediaStrategy === "minimal-no-photo" && defaults.heroLayout === "gallery-led") {
    return {
      ...defaults,
      heroLayout: "split-media-proof",
      mediaStrategy,
      proofTreatment: "badge-row",
      antiPatterns: [...defaults.antiPatterns, "forcing gallery layout without usable media"],
    };
  }
  return { ...defaults, mediaStrategy };
}

function applyDesignIntent(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}, pattern: string, text: string) {
  const design = objectValue(finalJson.design);
  const deterministicIntent = buildDesignIntent(finalJson, originData, pattern);
  const existingIntent = objectValue(design.designIntent);
  const intent: DesignIntent = {
    ...deterministicIntent,
    ...Object.fromEntries(Object.entries(existingIntent).filter(([, value]) => typeof value === "string" || Array.isArray(value))),
    antiPatterns: Array.isArray(existingIntent.antiPatterns) ? existingIntent.antiPatterns.map((item) => safeCopyText(item, 120)).filter(Boolean) : deterministicIntent.antiPatterns,
  };
  design.compositionPattern = design.compositionPattern || intent.compositionPattern;
  design.heroLayout = design.heroLayout || intent.heroLayout;
  design.mediaStrategy = design.mediaStrategy || intent.mediaStrategy;
  design.proofTreatment = design.proofTreatment || intent.proofTreatment;
  design.cardDensity = design.cardDensity || intent.cardDensity;
  design.ctaTreatment = design.ctaTreatment || intent.ctaTreatment;
  design.motionLevel = design.motionLevel || intent.motionLevel;
  design.sectionRhythm = design.sectionRhythm || intent.sectionRhythm;
  design.detailLayout = design.detailLayout || intent.detailLayout;
  design.antiPatterns = Array.isArray(design.antiPatterns) && design.antiPatterns.length ? design.antiPatterns : intent.antiPatterns;
  design.designIntent = {
    compositionPattern: design.compositionPattern,
    heroLayout: design.heroLayout,
    mediaStrategy: design.mediaStrategy,
    proofTreatment: design.proofTreatment,
    cardDensity: design.cardDensity,
    ctaTreatment: design.ctaTreatment,
    motionLevel: design.motionLevel,
    sectionRhythm: design.sectionRhythm,
    detailLayout: design.detailLayout,
    antiPatterns: design.antiPatterns,
    source: "deterministic_pattern_map",
    pagePattern: pattern,
    contextHashBasis: safeCopyText(text, 220),
  };
  finalJson.design = design;
  return design.designIntent as Record<string, unknown>;
}

function primaryActionForPattern(pattern: string, hasPhone: boolean, isIndonesian: boolean) {
  if (pattern === "emergency-service" && hasPhone) return isIndonesian ? "Telepon Sekarang" : "Call Now";
  if (pattern === "booking-led-local") return isIndonesian ? "Jadwalkan Kunjungan" : "Book Appointment";
  if (pattern === "menu-led-restaurant") return isIndonesian ? "Buka Lokasi" : "Get Directions";
  if (pattern === "trust-led-professional" || pattern === "premium-consultation") return isIndonesian ? "Jadwalkan Konsultasi" : "Schedule a Consultation";
  if (pattern === "gallery-led-craft") return isIndonesian ? "Minta Estimasi" : "Request an Estimate";
  return isIndonesian ? "Minta Penawaran" : "Request a Quote";
}

function primaryActionReason(pattern: string, hasPhone: boolean, isIndonesian: boolean) {
  const contact = hasPhone
    ? (isIndonesian ? "nomor telepon tersedia dari data bisnis" : "a phone number is available from business data")
    : (isIndonesian ? "formulir kontak menjadi langkah aman saat telepon belum tersedia" : "the contact page is the safest next step when phone data is missing");
  const patterns: Record<string, string> = {
    "emergency-service": isIndonesian ? `Pengunjung butuh respons cepat dan ${contact}.` : `Visitors need fast response and ${contact}.`,
    "menu-led-restaurant": isIndonesian ? "Pengunjung restoran biasanya ingin membuka lokasi, jam, atau menu sebelum datang." : "Restaurant visitors usually want location, hours, or menu context before visiting.",
    "trust-led-professional": isIndonesian ? "Layanan profesional perlu membangun kepercayaan lalu mengarahkan ke konsultasi." : "Professional services need to build trust before asking for a consultation.",
    "booking-led-local": isIndonesian ? "Bisnis appointment-led perlu mengarahkan pengunjung ke jadwal atau pertanyaan booking." : "Appointment-led local businesses should guide visitors toward scheduling or booking questions.",
    "gallery-led-craft": isIndonesian ? "Bisnis pekerjaan lapangan perlu menunjukkan cakupan lalu mengarahkan ke estimasi." : "Hands-on service businesses need to show scope and move visitors toward an estimate.",
    "premium-consultation": isIndonesian ? "Pembelian bernilai tinggi perlu langkah konsultasi yang jelas dan rendah risiko." : "High-value decisions need a clear, low-risk consultation step.",
    "quote-led-service": isIndonesian ? "Layanan lokal paling baik diarahkan ke permintaan penawaran yang spesifik." : "Local service visitors are best moved toward a specific quote request.",
  };
  return patterns[pattern] || patterns["quote-led-service"];
}

function phoneFromSite(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const profile = objectValue(finalJson.businessProfile);
  const contact = objectValue(profile.contact);
  const sourceData = objectValue(finalJson.sourceData);
  return safeCopyText(
    contact.phoneInternational ||
      contact.phoneNational ||
      sourceData.international_phone_number ||
      sourceData.formatted_phone_number ||
      sourceData.nationalPhoneNumber ||
      originData.international_phone_number ||
      originData.formatted_phone_number ||
      originData.nationalPhoneNumber,
    80,
  );
}

function mapsUrlFromSite(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const profile = objectValue(finalJson.businessProfile);
  const contact = objectValue(profile.contact);
  const location = objectValue(finalJson.location);
  const sourceData = objectValue(finalJson.sourceData);
  return asString(contact.directionsUrl, asString(location.directionsUrl, asString(sourceData.googleMapsUri, asString(originData.url, asString(originData.googleMapsUri)))));
}

function sourceSafeProofBadges(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const trust = objectValue(finalJson.trust);
  const sourceData = objectValue(finalJson.sourceData);
  const location = objectValue(finalJson.location);
  const hours = objectValue(finalJson.hours);
  const brand = objectValue(finalJson.brand);
  const rating = Number(trust.rating || trust.googleRating || originData.rating || 0);
  const reviewCount = Number(trust.reviewCount || originData.user_ratings_total || originData.userRatingCount || 0);
  const photos = Array.isArray(originData.photos) ? originData.photos : [];
  const serviceAreas = normalizeStringList(location.servedAreas || location.serviceAreas || sourceData.servedAreas || sourceData.locationServed);
  const badges: Array<{ label: string; source: string }> = [];
  if (rating >= 4 && reviewCount > 0) badges.push({ label: "Highly rated", source: "google_places.rating" });
  if (reviewCount > 0) badges.push({ label: `${reviewCount}+ Google reviews`, source: "google_places.review_count" });
  if (serviceAreas.length > 0 || location.isServiceAreaBusiness || sourceData.pureServiceAreaBusiness) badges.push({ label: "Local service area", source: "google_places.service_area" });
  if (mapsUrlFromSite(finalJson, originData)) badges.push({ label: "Directions ready", source: "google_places.maps_url" });
  if (phoneFromSite(finalJson, originData)) badges.push({ label: "Direct phone available", source: "google_places.phone" });
  if (hours.openNow === true) badges.push({ label: "Open today", source: "google_places.hours" });
  if (photos.length > 0 || asString(brand.preferredHeroImage) || asString(brand.logoImageUrl)) badges.push({ label: "Photos available", source: "google_places.photos" });
  if (asString(sourceData.businessStatus, asString(originData.business_status, asString(originData.businessStatus))) === "OPERATIONAL") badges.push({ label: "Operational listing", source: "google_places.business_status" });

  const seen = new Set<string>();
  return badges.filter((badge) => {
    const key = badge.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function mergeTrustBadges(finalJson: GeneratedSiteRecord, badges: Array<{ label: string; source: string }>) {
  const trust = objectValue(finalJson.trust);
  const existing = Array.isArray(trust.badges) ? trust.badges.map((item) => safeCopyText(item, 80)).filter(Boolean) : [];
  const merged = [...existing, ...badges.map((badge) => badge.label)].filter(Boolean);
  const seen = new Set<string>();
  trust.badges = merged.filter((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  finalJson.trust = trust;
}

function isGenericCta(value: unknown) {
  return /^(submit|send|send message|learn more|contact|contact us|get started|click here|more info|inquire|book now)$/i.test(safeCopyText(value, 80));
}

function isPrimaryActionLike(value: unknown) {
  return /(call|phone|telepon|contact|hubungi|estimate|quote|penawaran|estimasi|book|booking|schedule|appointment|consult|directions|maps|lokasi|request|minta)/i.test(safeCopyText(value, 120));
}

function applyCtaText(target: Record<string, unknown>, fallbackText: string) {
  if (isGenericCta(target.text)) target.text = fallbackText;
}

function rewriteGenericCtas(finalJson: GeneratedSiteRecord, primaryText: string, secondaryText: string) {
  const conversion = objectValue(finalJson.conversion);
  const primaryCta = objectValue(conversion.primaryCta);
  const secondaryCta = objectValue(conversion.secondaryCta);
  applyCtaText(primaryCta, primaryText);
  applyCtaText(secondaryCta, secondaryText);
  conversion.primaryCta = primaryCta;
  conversion.secondaryCta = secondaryCta;
  finalJson.conversion = conversion;

  const globalConfig = objectValue(finalJson.global);
  const header = objectValue(globalConfig.header);
  const headerCta = objectValue(header.ctaButton);
  applyCtaText(headerCta, primaryText);
  header.ctaButton = headerCta;
  globalConfig.header = header;
  finalJson.global = globalConfig;

  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  pages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections.forEach((section) => {
      const content = objectValue(section.content);
      const buttons = Array.isArray(content.buttons) ? content.buttons as Array<Record<string, unknown>> : [];
      buttons.forEach((button, index) => {
        if (!isGenericCta(button.text)) return;
        button.text = index === 0 || asString(button.style) === "primary" ? primaryText : secondaryText;
      });
      const items = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
      items.forEach((item) => {
        const cta = objectValue(item.cta);
        if (isGenericCta(cta.text)) cta.text = primaryText;
        if (Object.keys(cta).length) item.cta = cta;
      });
      const formConfig = objectValue(content.formConfig);
      if (isGenericCta(formConfig.buttonText)) formConfig.buttonText = primaryText;
      if (Object.keys(formConfig).length) content.formConfig = formConfig;
      section.content = content;
    });
  });
}

function faqItemsForConversion(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}, isIndonesian = false) {
  const profile = objectValue(finalJson.businessProfile);
  const location = objectValue(finalJson.location);
  const conversion = objectValue(finalJson.conversion);
  const primaryAction = safeCopyText(conversion.primaryAction || objectValue(conversion.primaryCta).text, 80) || (isIndonesian ? "hubungi kami" : "contact us");
  const serviceArea = normalizeStringList(location.servedAreas || location.serviceAreas || profile.serviceAreas).slice(0, 3).join(", ");
  const phone = phoneFromSite(finalJson, originData);
  return isIndonesian
    ? [
        { question: "Apa langkah pertama untuk mulai?", answer: `Gunakan tombol ${primaryAction} dan sampaikan kebutuhan, lokasi, waktu, serta detail penting agar langkah berikutnya jelas.` },
        { question: "Apakah area layanan bisa dikonfirmasi dulu?", answer: serviceArea ? `Area yang tersedia mencakup ${serviceArea}. Hubungi kami untuk memastikan lokasi spesifik Anda.` : "Hubungi kami dengan alamat atau area Anda agar ketersediaan layanan bisa dikonfirmasi." },
        { question: "Apakah harga bisa dikonfirmasi sebelum datang?", answer: "Bagikan kebutuhan dan detail pekerjaan supaya bisnis dapat memberi arahan harga, estimasi, atau ketersediaan yang lebih relevan." },
        { question: "Informasi apa yang perlu saya siapkan?", answer: "Siapkan kebutuhan utama, lokasi, jadwal yang diinginkan, foto bila relevan, dan pertanyaan khusus." },
        { question: "Bisakah saya menghubungi langsung?", answer: phone ? `Ya. Anda bisa menghubungi ${phone} untuk pertanyaan cepat.` : "Gunakan formulir kontak agar pesan Anda terkirim dengan detail yang cukup." },
      ]
    : [
        { question: "What is the best first step?", answer: `Use the ${primaryAction} option and share your need, location, timing, and any important details so the next step is clear.` },
        { question: "Can I confirm the service area first?", answer: serviceArea ? `Available service-area context includes ${serviceArea}. Contact us to confirm your exact location.` : "Share your address or area when you reach out so availability can be confirmed." },
        { question: "Can pricing or availability be discussed before I commit?", answer: "Yes. Share the scope and timing so the business can guide you toward a relevant estimate, current price, or availability answer." },
        { question: "What should I prepare before contacting you?", answer: "Prepare the main need, location, preferred timing, photos if relevant, and any special requirements." },
        { question: "Can I contact the business directly?", answer: phone ? `Yes. Call ${phone} for quick questions or use the contact form for a written inquiry.` : "Use the contact form so your message includes enough detail for a useful reply." },
      ];
}

function ensureFaqDepth(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const defaults = faqItemsForConversion(finalJson, originData, isIndonesian);
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  pages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const isDetailPage = sections.some((section) => asString(section.type) === "offeringDetail");
    let faqSection = sections.find((section) => asString(section.type) === "faq");
    if (!faqSection && (asString(page.pageId) === "home" || isDetailPage)) {
      faqSection = {
        type: "faq",
        id: `${asString(page.pageId, "page")}-faq`,
        content: { title: isIndonesian ? "Pertanyaan umum" : "Common questions", items: [] },
      };
      const contactIndex = sections.findIndex((section) => asString(section.type) === "hoursLocation" || asString(section.type) === "contactForm");
      sections.splice(contactIndex >= 0 ? contactIndex : sections.length, 0, faqSection);
      page.sections = sections;
    }
    if (!faqSection) return;
    const content = objectValue(faqSection.content);
    const items = Array.isArray(content.items) ? content.items as Array<Record<string, unknown>> : [];
    const targetCount = asString(page.pageId) === "home" ? 5 : 3;
    defaults.forEach((item) => {
      if (items.length >= targetCount) return;
      if (items.some((existing) => safeCopyText(existing.question, 140).toLowerCase() === item.question.toLowerCase())) return;
      items.push(item);
    });
    content.items = items.slice(0, Math.max(targetCount, Math.min(8, items.length)));
    if (!safeCopyText(content.title, 140)) content.title = isIndonesian ? "Pertanyaan umum" : "Common questions";
    faqSection.content = content;
  });
}

function ensureOfferingDetailDepth(finalJson: GeneratedSiteRecord) {
  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  pages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    sections.filter((section) => asString(section.type) === "offeringDetail").forEach((section) => {
      const content = objectValue(section.content);
      const title = safeCopyText(content.title || page.pageTitle, 90) || (isIndonesian ? "layanan ini" : "this service");
      const included = Array.isArray(content.included) ? content.included as unknown[] : [];
      const bestFor = Array.isArray(content.bestFor) ? content.bestFor as unknown[] : [];
      const highlights = Array.isArray(content.highlights) ? content.highlights as Array<Record<string, unknown>> : [];
      while (included.length < 3) {
        included.push(isIndonesian ? `Diskusi kebutuhan untuk ${title}` : `${title} scope discussion`);
      }
      while (bestFor.length < 3) {
        bestFor.push(isIndonesian ? "Pelanggan yang ingin langkah jelas" : "Customers who want a clear next step");
      }
      while (highlights.length < 2) {
        highlights.push({
          title: isIndonesian ? "Langkah jelas" : "Clear next step",
          description: isIndonesian ? "Hubungi bisnis dengan kebutuhan, lokasi, dan jadwal agar detail dapat dikonfirmasi." : "Contact the business with your need, location, and timing so the details can be confirmed.",
        });
      }
      content.included = included.slice(0, 6);
      content.bestFor = bestFor.slice(0, 5);
      content.highlights = highlights.slice(0, 4);
      section.content = content;
    });
  });
}

function ensureFinalCtaSections(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const meta = objectValue(finalJson.meta);
  const conversion = objectValue(finalJson.conversion);
  const businessName = safeCopyText(meta.businessName || objectValue(finalJson.businessProfile).name, 120) || "this business";
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const primaryCta = objectValue(conversion.primaryCta);
  const secondaryCta = objectValue(conversion.secondaryCta);
  const proofBadges = Array.isArray(conversion.proofBadges) ? conversion.proofBadges : sourceSafeProofBadges(finalJson, originData).map((badge) => badge.label);
  const phone = phoneFromSite(finalJson, originData);
  const location = objectValue(finalJson.location);
  const serviceArea = normalizeStringList(location.servedAreas || location.serviceAreas).slice(0, 2).join(", ");
  const proofLine = isIndonesian
    ? [phone ? "Telepon langsung tersedia" : "Kirim pertanyaan singkat", serviceArea ? `Area: ${serviceArea}` : "", proofBadges[0] ? String(proofBadges[0]) : ""].filter(Boolean).join(" - ")
    : [phone ? "Direct phone available" : "Send a quick inquiry", serviceArea ? `Area: ${serviceArea}` : "", proofBadges[0] ? String(proofBadges[0]) : ""].filter(Boolean).join(" - ");
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  pages.forEach((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    if (!sections.length || sections.some((section) => asString(section.type) === "finalCta")) return;
    const isHome = asString(page.pageId) === "home";
    const detail = sections.find((section) => asString(section.type) === "offeringDetail");
    if (!isHome && !detail) return;
    const detailContent = objectValue(detail?.content);
    const topic = safeCopyText(detailContent.title || page.pageTitle, 100);
    const headline = isHome
      ? (isIndonesian ? `Siap membahas kebutuhan Anda dengan ${businessName}?` : `Ready to take the next step with ${businessName}?`)
      : (isIndonesian ? `Siap menanyakan ${topic}?` : `Ready to ask about ${topic}?`);
    const description = isHome
      ? (isIndonesian ? "Gunakan langkah kontak yang paling mudah dan sertakan lokasi, waktu, serta detail kebutuhan Anda." : "Use the easiest contact option and include your location, timing, and what you need help with.")
      : (isIndonesian ? "Sampaikan cakupan, lokasi, waktu, dan pertanyaan khusus agar bisnis dapat memberi arahan yang relevan." : "Share the scope, location, timing, and any special questions so the business can give a relevant next step.");
    const section = {
      type: "finalCta",
      id: `${asString(page.pageId, "page")}-final-cta`,
      content: {
        eyebrow: isIndonesian ? "Langkah berikutnya" : "Next step",
        headline,
        description,
        primaryCta,
        secondaryCta,
        proofLine,
        proofBadges,
      },
    };
    const contactIndex = sections.findIndex((item) => asString(item.type) === "hoursLocation" || asString(item.type) === "contactForm");
    sections.splice(contactIndex >= 0 ? contactIndex : sections.length, 0, section);
    page.sections = sections;
  });
}

function buildConversionAudit(finalJson: GeneratedSiteRecord) {
  const conversion = objectValue(finalJson.conversion);
  const primaryCta = objectValue(conversion.primaryCta);
  const proofBadges = Array.isArray(conversion.proofBadges) ? conversion.proofBadges : [];
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const home = pages.find((page) => asString(page.pageId) === "home") || pages[0] || {};
  const homeSections = Array.isArray(home.sections) ? home.sections as Array<Record<string, unknown>> : [];
  const faqSections = pages.flatMap((page) => Array.isArray(page.sections) ? (page.sections as Array<Record<string, unknown>>).filter((section) => asString(section.type) === "faq") : []);
  const faqItemCount = faqSections.reduce((total, section) => {
    const items = objectValue(section.content).items;
    return total + (Array.isArray(items) ? items.length : 0);
  }, 0);
  const detailPages = pages.filter((page) => {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    return sections.some((section) => asString(section.type) === "offeringDetail");
  });
  const thinServicePages = detailPages.filter((page) => {
    const section = (page.sections as Array<Record<string, unknown>>).find((item) => asString(item.type) === "offeringDetail");
    const content = objectValue(section?.content);
    const detailCount = [
      ...(Array.isArray(content.included) ? content.included : []),
      ...(Array.isArray(content.bestFor) ? content.bestFor : []),
      ...(Array.isArray(content.highlights) ? content.highlights : []),
    ].filter(Boolean).length;
    return detailCount < 3;
  }).map((page) => asString(page.pageId));
  const firstTwoTypes = homeSections.slice(0, 2).map((section) => asString(section.type));
  const hero = homeSections.find((section) => asString(section.type) === "hero");
  const heroContent = objectValue(hero?.content);
  const heroButtons = Array.isArray(heroContent.buttons) ? heroContent.buttons as Array<Record<string, unknown>> : [];
  const primaryButtonLabels = heroButtons.filter((button) => asString(button.style) === "primary" || isPrimaryActionLike(button.text)).map((button) => safeCopyText(button.text, 80).toLowerCase()).filter(Boolean);
  const uniquePrimaryLabels = new Set(primaryButtonLabels);
  const summary = {
    pagePattern: asString(conversion.pagePattern),
    primaryAction: safeCopyText(conversion.primaryAction || primaryCta.text, 80),
    primaryCtaSpecific: !isGenericCta(primaryCta.text),
    proofAboveFold: proofBadges.length > 0 || firstTwoTypes.includes("trustBar"),
    objectionsCovered: faqItemCount >= 5,
    finalCtaPresent: pages.some((page) => Array.isArray(page.sections) && (page.sections as Array<Record<string, unknown>>).some((section) => asString(section.type) === "finalCta")),
    heroSpecific: Boolean(safeCopyText(heroContent.headline, 160) && safeCopyText(heroContent.subheadline, 240)),
    competingPrimaryCtas: uniquePrimaryLabels.size > 1,
    thinServicePages,
    proofBadgeCount: proofBadges.length,
    faqItemCount,
    checkedAt: new Date().toISOString(),
  };
  const flags = [
    !summary.primaryCtaSpecific ? "generic_primary_cta" : "",
    !summary.proofAboveFold ? "missing_proof_above_fold" : "",
    !summary.objectionsCovered ? "missing_objection_faq" : "",
    !summary.finalCtaPresent ? "missing_final_cta" : "",
    !summary.heroSpecific ? "non_specific_hero" : "",
    summary.competingPrimaryCtas ? "competing_primary_ctas" : "",
    summary.thinServicePages.length ? "thin_service_pages" : "",
  ].filter(Boolean);
  return { ...summary, flags };
}

function buildDesignAudit(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const design = objectValue(finalJson.design);
  const conversion = objectValue(finalJson.conversion);
  const intent = objectValue(design.designIntent);
  const pattern = asString(conversion.pagePattern, asString(intent.pagePattern));
  const mediaCount = availableMediaCount(finalJson, originData);
  const stylePreset = asString(design.stylePreset);
  const heroLayout = asString(design.heroLayout, asString(intent.heroLayout));
  const mediaStrategy = asString(design.mediaStrategy, asString(intent.mediaStrategy));
  const proofTreatment = asString(design.proofTreatment, asString(intent.proofTreatment));
  const ctaTreatment = asString(design.ctaTreatment, asString(intent.ctaTreatment));
  const compositionPattern = asString(design.compositionPattern, asString(intent.compositionPattern));
  const requiredFields = [
    compositionPattern,
    heroLayout,
    mediaStrategy,
    proofTreatment,
    asString(design.cardDensity, asString(intent.cardDensity)),
    ctaTreatment,
    asString(design.motionLevel, asString(intent.motionLevel)),
  ];
  const flags = [
    requiredFields.some((value) => !value) ? "missing_design_intent" : "",
    !stylePreset || stylePreset === "local-clean" ? "generic_style_preset" : "",
    mediaCount <= 0 && ["real-photo-hero", "gallery-grid"].includes(mediaStrategy) ? "weak_media_strategy" : "",
    mediaCount <= 1 && heroLayout === "gallery-led" ? "weak_image_hero" : "",
    !proofTreatment ? "missing_proof_treatment" : "",
    !ctaTreatment ? "missing_cta_treatment" : "",
  ].filter(Boolean);
  return {
    pagePattern: pattern,
    compositionPattern,
    heroLayout,
    mediaStrategy,
    proofTreatment,
    ctaTreatment,
    stylePreset,
    visualStyle: asString(design.visualStyle || design.shapeStyle),
    mediaCount,
    flags,
    ready: flags.length === 0,
    checkedAt: new Date().toISOString(),
  };
}

export function ensureConversionMetadata(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const text = sourceTextForConversion(finalJson, originData);
  const pattern = conversionPagePattern(text);
  const phone = phoneFromSite(finalJson, originData);
  const mapsUrl = mapsUrlFromSite(finalJson, originData);
  const primaryText = primaryActionForPattern(pattern, Boolean(phone), isIndonesian);
  const secondaryText = pattern === "menu-led-restaurant"
    ? (isIndonesian ? "Hubungi" : "Contact")
    : mapsUrl
      ? (isIndonesian ? "Buka Maps" : "Open Maps")
      : (isIndonesian ? "Lihat detail" : "View Details");
  const proofBadges = sourceSafeProofBadges(finalJson, originData);
  applyHighTicketStyleDirection(finalJson, pattern, text);
  applyDesignIntent(finalJson, originData, pattern, text);

  const conversion = objectValue(finalJson.conversion);
  const primaryCta = objectValue(conversion.primaryCta);
  const secondaryCta = objectValue(conversion.secondaryCta);
  if (!safeCopyText(primaryCta.text, 80) || isGenericCta(primaryCta.text)) primaryCta.text = primaryText;
  primaryCta.href = asString(primaryCta.href) || (phone ? `tel:${phone}` : "#contact");
  if (!safeCopyText(secondaryCta.text, 80) || isGenericCta(secondaryCta.text)) secondaryCta.text = secondaryText;
  secondaryCta.href = asString(secondaryCta.href) || mapsUrl || "#contact";
  conversion.pagePattern = conversion.pagePattern || pattern;
  conversion.primaryAction = conversion.primaryAction || primaryText;
  conversion.primaryActionReason = conversion.primaryActionReason || primaryActionReason(pattern, Boolean(phone), isIndonesian);
  conversion.proofBadges = proofBadges.map((badge) => badge.label);
  conversion.sourceSafeProofInputs = proofBadges;
  conversion.primaryCta = primaryCta;
  conversion.secondaryCta = secondaryCta;
  conversion.stickyMobileCta = conversion.stickyMobileCta !== false;
  finalJson.conversion = conversion;

  mergeTrustBadges(finalJson, proofBadges);
  rewriteGenericCtas(finalJson, safeCopyText(conversion.primaryAction, 80) || primaryText, secondaryText);
  ensureOfferingDetailDepth(finalJson);
  ensureFaqDepth(finalJson, originData);
  ensureFinalCtaSections(finalJson, originData);
  const updatedConversion = objectValue(finalJson.conversion);
  updatedConversion.conversionAudit = buildConversionAudit(finalJson);
  finalJson.conversion = updatedConversion;
  const updatedDesign = objectValue(finalJson.design);
  updatedDesign.designAudit = buildDesignAudit(finalJson, originData);
  finalJson.design = updatedDesign;
  return updatedConversion;
}

export function findContactSourceSection(finalJson: GeneratedSiteRecord) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const contactForm = sections.find((section) => asString(section.type) === "contactForm");
    if (contactForm) return contactForm;
  }
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
    const contactLike = sections.find((section) => {
      const sectionId = asString(section.id).toLowerCase();
      const type = asString(section.type);
      const content = objectValue(section.content);
      const title = `${asString(content.title)} ${asString(content.hoursTitle)} ${asString(content.openingHoursTitle)}`.toLowerCase();
      return type === "hoursLocation" || sectionId === "contact" || sectionId.endsWith("-contact") || title.includes("contact") || title.includes("kontak");
    });
    if (contactLike) return contactLike;
  }
  return null;
}

function normalizeHourText(value: unknown) {
  return safeCopyText(value, 140)
    .replace(/[\u202f\u2009]/g, " ")
    .replace(/\s*[–—-]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHourLine(value: unknown) {
  const clean = normalizeHourText(value);
  const match = clean.match(/^([^:]+):\s*(.+)$/);
  if (!match) return { day: "", time: clean };
  return { day: match[1].trim(), time: match[2].trim() };
}

function dayLabel(day = "", isIndonesian = false, short = false) {
  const lower = day.trim().toLowerCase();
  const labels: Record<string, { en: string; id: string; enShort: string; idShort: string }> = {
    monday: { en: "Monday", id: "Senin", enShort: "Mon", idShort: "Sen" },
    tuesday: { en: "Tuesday", id: "Selasa", enShort: "Tue", idShort: "Sel" },
    wednesday: { en: "Wednesday", id: "Rabu", enShort: "Wed", idShort: "Rab" },
    thursday: { en: "Thursday", id: "Kamis", enShort: "Thu", idShort: "Kam" },
    friday: { en: "Friday", id: "Jumat", enShort: "Fri", idShort: "Jum" },
    saturday: { en: "Saturday", id: "Sabtu", enShort: "Sat", idShort: "Sab" },
    sunday: { en: "Sunday", id: "Minggu", enShort: "Sun", idShort: "Min" },
  };
  const item = labels[lower] || Object.values(labels).find((entry) => entry.id.toLowerCase() === lower || entry.enShort.toLowerCase() === lower || entry.idShort.toLowerCase() === lower);
  if (!item) return day.trim();
  if (isIndonesian) return short ? item.idShort : item.id;
  return short ? item.enShort : item.en;
}

function localizedHourTime(time: string, isIndonesian = false) {
  if (!isIndonesian) return time;
  return time
    .replace(/^closed$/i, "Tutup")
    .replace(/^open 24 hours$/i, "Buka 24 jam");
}

function summarizeOpeningHours(items: unknown[], isIndonesian = false) {
  const parsed = items.map(parseHourLine).filter((item) => item.day || item.time);
  if (parsed.length === 0) return [];

  const groups: Array<{ days: string[]; time: string }> = [];
  parsed.forEach((item) => {
    const time = item.time || item.day;
    const day = item.time ? item.day : "";
    const last = groups[groups.length - 1];
    if (last && last.time === time) {
      if (day) last.days.push(day);
    } else {
      groups.push({ days: day ? [day] : [], time });
    }
  });

  return groups.map((group) => {
    const days = group.days.filter(Boolean);
    const time = localizedHourTime(group.time, isIndonesian);
    if (days.length >= 7) return `${isIndonesian ? "Setiap hari" : "Daily"}: ${time}`;
    if (days.length > 1) {
      return `${dayLabel(days[0], isIndonesian, true)}-${dayLabel(days[days.length - 1], isIndonesian, true)}: ${time}`;
    }
    if (days.length === 1) return `${dayLabel(days[0], isIndonesian)}: ${time}`;
    return time;
  }).slice(0, 4);
}

export function ensureContactPage(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  const pages = Array.isArray(finalJson.pages) ? finalJson.pages as Array<Record<string, unknown>> : [];
  const hasContactPage = pages.some((page) => asString(page.pageId).toLowerCase() === "contact");

  const meta = objectValue(finalJson.meta);
  const isIndonesian = asString(meta.language).toLowerCase().startsWith("id");
  const businessProfile = objectValue(finalJson.businessProfile);
  const contact = objectValue(businessProfile.contact);
  const location = objectValue(finalJson.location);
  const hours = objectValue(finalJson.hours);
  const sourceData = objectValue(finalJson.sourceData);
  const globalConfig = objectValue(finalJson.global);
  const footer = objectValue(globalConfig.footer);
  const sourceSection = findContactSourceSection(finalJson);
  const sourceContent = objectValue(sourceSection?.content);
  const formConfig = objectValue(sourceContent.formConfig);

  if (!hasContactPage) {
    pages.push({
      pageId: "contact",
      pageTitle: isIndonesian ? "Kontak" : "Contact",
      sections: [
        {
          type: "contactForm",
          id: "contact",
          content: {
            title: safeCopyText(sourceContent.title, 100) || (isIndonesian ? "Hubungi Kami" : "Contact Us"),
            address: safeCopyText(
              sourceContent.address ||
              location.formattedAddress ||
              objectValue(businessProfile.address).formatted ||
              sourceData.formattedAddress ||
              sourceData.formatted_address ||
              originData.formatted_address ||
              originData.formattedAddress,
              220,
            ),
            phone: safeCopyText(
              sourceContent.phone ||
              contact.phoneNational ||
              contact.phoneInternational ||
              originData.formatted_phone_number ||
              originData.nationalPhoneNumber ||
              originData.international_phone_number,
              80,
            ),
            email: safeCopyText(sourceContent.email || contact.email || businessProfile.email || footer.email, 120),
            directionsUrl: asString(sourceContent.directionsUrl, asString(contact.directionsUrl, asString(location.directionsUrl, asString(originData.url, asString(sourceData.googleMapsUri))))),
            openingHours: summarizeOpeningHours(
              Array.isArray(sourceContent.openingHours)
                ? sourceContent.openingHours
                : Array.isArray(sourceContent.hours)
                  ? sourceContent.hours
                  : Array.isArray(hours.regular)
                    ? hours.regular
                    : [],
              isIndonesian,
            ),
            formConfig: {
              heading: safeCopyText(formConfig.heading, 120) || (isIndonesian ? "Kirim pertanyaan" : "Send an Inquiry"),
              buttonText: safeCopyText(formConfig.buttonText, 80) || (isIndonesian ? "Kirim Pesan" : "Send Message"),
              fields: Array.isArray(formConfig.fields) && formConfig.fields.length > 0
                ? formConfig.fields
                : [
                    { label: isIndonesian ? "Nama" : "Name", type: "text", required: true },
                    { label: "Email", type: "email", required: true },
                    { label: isIndonesian ? "Pesan" : "Message", type: "textarea", required: true },
                  ],
            },
          },
        },
      ],
    });
    finalJson.pages = pages;
  }

  pages
    .filter((page) => asString(page.pageId).toLowerCase() === "contact")
    .forEach((page) => {
      const sections = Array.isArray(page.sections) ? page.sections as Array<Record<string, unknown>> : [];
      sections
        .filter((section) => asString(section.type) === "contactForm")
        .forEach((section) => {
          const content = objectValue(section.content);
          const openingHoursSource = Array.isArray(content.openingHours)
            ? content.openingHours
            : Array.isArray(content.hours)
              ? content.hours
              : Array.isArray(hours.regular)
                ? hours.regular
                : [];
          content.openingHours = summarizeOpeningHours(openingHoursSource, isIndonesian);
          if (!safeCopyText(content.title, 100)) content.title = isIndonesian ? "Hubungi Kami" : "Contact Us";
          section.content = content;
        });
    });

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#contact")) {
    headerMenu.push({ label: isIndonesian ? "Kontak" : "Contact", href: "#contact" });
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

export function applyGeneratedSitePageInserts(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  repairServiceCardImages(finalJson, originData);
  repairOfferingNavLabels(finalJson);
  ensureServicesPage(finalJson);
  ensureAboutPage(finalJson);
  ensureContactPage(finalJson, originData);
  ensureConversionMetadata(finalJson, originData);
  ensureFeedbackPage(finalJson);
  ensureGalleryPage(finalJson, originData);
}
