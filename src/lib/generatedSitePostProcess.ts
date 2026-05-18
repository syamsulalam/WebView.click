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
      description: item.summary || item.description,
      priceHint: item.priceHint,
      image: item.image,
      href: item.href,
      detailPageId: item.detailPageId,
      cta: item.cta,
    }))
    .filter((item) => item.title || item.description || item.href || item.detailPageId);
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
  }

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#services")) {
    headerMenu.push({
      label: isIndonesian ? "Layanan" : "Services",
      href: "#services",
      children: items
        .map((item) => ({
          label: item.title,
          href: item.detailPageId ? `#${item.detailPageId}` : asString(item.href, asString(objectValue(item.cta).href)),
        }))
        .filter((item) => item.label && item.href),
    });
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
            openingHours: Array.isArray(sourceContent.openingHours)
              ? sourceContent.openingHours
              : Array.isArray(sourceContent.hours)
                ? sourceContent.hours
                : Array.isArray(hours.regular)
                  ? hours.regular
                  : [],
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

  const navigation = objectValue(finalJson.navigation);
  const headerMenu = Array.isArray(navigation.headerMenu) ? navigation.headerMenu as Array<Record<string, unknown>> : [];
  if (headerMenu.length > 0 && !headerMenu.some((item) => asString(item.href) === "#contact")) {
    headerMenu.push({ label: isIndonesian ? "Kontak" : "Contact", href: "#contact" });
    navigation.headerMenu = headerMenu;
    finalJson.navigation = navigation;
  }
}

export function applyGeneratedSitePageInserts(finalJson: GeneratedSiteRecord, originData: GeneratedSiteRecord = {}) {
  ensureServicesPage(finalJson);
  ensureContactPage(finalJson, originData);
  ensureFeedbackPage(finalJson);
  ensureGalleryPage(finalJson, originData);
}
