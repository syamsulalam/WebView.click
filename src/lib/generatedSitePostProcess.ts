export type GeneratedSiteRecord = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
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
  ensureServicesPage(finalJson);
  ensureAboutPage(finalJson);
  ensureContactPage(finalJson, originData);
  ensureFeedbackPage(finalJson);
  ensureGalleryPage(finalJson, originData);
}
