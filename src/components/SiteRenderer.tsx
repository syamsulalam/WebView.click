import { useState } from "react";
import { CheckCircle2, Clock, MapPin, Phone, Star } from "lucide-react";

type SiteRendererProps = {
  siteData: any;
  publicLinks?: { basic: string; premium: string };
  businessId?: string;
  showProspectPanel?: boolean;
  onDownloadZip?: () => void;
};

function normalizeSiteData(siteData: any) {
  const meta = siteData?.meta || {};
  const design = siteData?.design || {};
  const themeVariables = design.themeVariables || {};
  const colors = themeVariables.colors || {};
  const typography = themeVariables.typography || design.typography || {};
  const globalConfig = siteData?.global || {};
  const header = globalConfig.header || {};
  const footer = globalConfig.footer || {};
  const navigation = siteData?.navigation || {};
  const pages = Array.isArray(siteData?.pages) ? siteData.pages : [];
  const trust = siteData?.trust || globalConfig.socialProof || {};
  const businessProfile = siteData?.businessProfile || {};
  const brand = siteData?.brand || {};
  const offers = Array.isArray(siteData?.offers) ? siteData.offers : [];
  const capabilities = Array.isArray(siteData?.capabilities) ? siteData.capabilities : [];
  const location = siteData?.location || {};
  const hours = siteData?.hours || {};
  const conversion = siteData?.conversion || {};

  return {
    meta: {
      businessName: meta.businessName || "Demo Business",
      businessId: meta.businessId || "demo-business",
      ...meta,
    },
    colors: {
      primary: colors.primary || "#111827",
      secondary: colors.secondary || "#F3F4F6",
      accent: colors.accent || "#4F46E5",
      textMain: colors.textMain || "#1F2937",
      textMuted: colors.textMuted || "#6B7280",
      background: colors.background || "#FFFFFF",
    },
    typography: {
      headingFont: typography.headingFont || "'Inter', sans-serif",
      bodyFont: typography.bodyFont || "'Inter', sans-serif",
    },
    brand: {
      logoImageUrl: brand.logoImageUrl || header.logoImageUrl || "",
      logoSvg: brand.logoSvg || header.logoSvg || "",
      preferredHeroImage: brand.preferredHeroImage || "",
      palette: Array.isArray(brand.palette) ? brand.palette : [],
      photoSource: brand.photoSource || "",
      googlePhotoReference: brand.googlePhotoReference || "",
      photoCaption: brand.photoCaption || "",
      photoAttributions: Array.isArray(brand.photoAttributions) ? brand.photoAttributions : [],
    },
    businessProfile: {
      name: businessProfile.name || meta.businessName || "Demo Business",
      typeLabel: businessProfile.typeLabel || meta.niche || "Local business",
      shortPitch: businessProfile.shortPitch || meta.seoDescription || "",
      contact: {
        phoneNational: businessProfile.contact?.phoneNational || "",
        phoneInternational: businessProfile.contact?.phoneInternational || "",
        directionsUrl: businessProfile.contact?.directionsUrl || "",
        ...businessProfile.contact,
      },
      ...businessProfile,
    },
    trust: {
      rating: Number(trust.rating || trust.googleRating || 0),
      reviewCount: Number(trust.reviewCount || 0),
      reviewSummary: trust.reviewSummary || "",
      reviews: Array.isArray(trust.reviews) ? trust.reviews : [],
      badges: Array.isArray(trust.badges) ? trust.badges : [],
    },
    offers,
    capabilities,
    location,
    hours,
    conversion: {
      primaryCta: conversion.primaryCta || header.ctaButton || { text: "Hubungi Kami", href: "#contact" },
      secondaryCta: conversion.secondaryCta || { text: "Lihat Lokasi", href: "#contact" },
      stickyMobileCta: Boolean(conversion.stickyMobileCta),
      ...conversion,
    },
    globalConfig: {
      ...globalConfig,
      header: {
        ctaButton: { text: "Hubungi Kami", href: "#contact" },
        ...header,
        ctaButton: {
          text: header.ctaButton?.text || "Hubungi Kami",
          href: header.ctaButton?.href || "#contact",
        },
      },
      footer: {
        text: footer.text || `© 2026 ${meta.businessName || "Demo Business"}.`,
        ...footer,
      },
    },
    navigation: {
      headerMenu: Array.isArray(navigation.headerMenu)
        ? navigation.headerMenu
        : pages.map((page: any) => ({ label: page.pageTitle || page.pageId, href: `#${page.pageId}` })),
    },
    pages,
  };
}

function isUsableImage(src?: string) {
  return Boolean(src && (src.startsWith("http") || src.startsWith("/") || src.startsWith("data:")));
}

function isGooglePlacesImage(src?: string) {
  if (!src) return false;
  try {
    const url = new URL(src, window.location.origin);
    return (
      url.pathname.startsWith("/api/places/photo") ||
      url.hostname.endsWith("googleusercontent.com") ||
      (url.hostname === "maps.googleapis.com" && url.pathname.includes("/place/photo")) ||
      (url.hostname === "places.googleapis.com" && url.pathname.includes("/photos/") && url.pathname.endsWith("/media"))
    );
  } catch {
    return src.startsWith("/api/places/photo");
  }
}

function attributionText(src?: string, attributions: string[] = [], source = "", caption = "") {
  if (source !== "google_places" && !isGooglePlacesImage(src)) return "";
  const cleanAttributions = attributions.map((item) => String(item).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const base = caption || "Photo from Google Business Profile";
  return cleanAttributions.length ? `${base}: ${cleanAttributions.join(", ")}` : base;
}

function ImageFrame({ src, label, className = "", attribution = "" }: { src?: string; label?: string; className?: string; attribution?: string }) {
  if (isUsableImage(src)) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        <img src={src} alt={label || ""} className="w-full h-full object-cover" />
        {attribution && (
          <div className="absolute left-2 right-2 bottom-2 rounded bg-black/65 px-2 py-1 text-[11px] leading-snug text-white">
            {attribution}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 ${className}`}>
      {label || src || "Image"}
    </div>
  );
}

export default function SiteRenderer({
  siteData,
  publicLinks = { basic: "", premium: "" },
  businessId = "demo",
  showProspectPanel = true,
  onDownloadZip,
}: SiteRendererProps) {
  const initialPage = siteData?.pages?.[0]?.pageId || "home";
  const [activeTab, setActiveTab] = useState(initialPage);

  const { meta, colors, typography, brand, businessProfile, trust, offers, capabilities, location, hours, conversion, globalConfig, navigation, pages } = normalizeSiteData(siteData);
  const brandPhotoAttribution = (src?: string) => attributionText(src, brand.photoAttributions, brand.photoSource, brand.photoCaption);

  const customStyles = {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-text": colors.textMain,
    "--color-bg": colors.background,
    fontFamily: typography.bodyFont,
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  return (
    <div style={customStyles} className="min-h-screen flex flex-col" id="rendered-site">
      <header style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="font-bold text-xl tracking-tight flex items-center gap-3">
          {brand.logoSvg ? <span className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: brand.logoSvg }} /> : null}
          {isUsableImage(brand.logoImageUrl) ? <img src={brand.logoImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" /> : null}
          <span>{meta.businessName}</span>
        </div>
        <nav className="hidden md:flex gap-6">
          {navigation.headerMenu.map((menu: any, idx: number) => {
            const pageId = menu.href.replace("#", "");
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(pageId)}
                className={`text-sm font-medium hover:opacity-80 transition ${activeTab === pageId ? "border-b-2 border-white" : ""}`}
              >
                {menu.label}
              </button>
            );
          })}
        </nav>
        <a
          href={globalConfig.header.ctaButton.href}
          style={{ backgroundColor: colors.accent }}
          className="px-5 py-2 rounded-lg text-white font-medium hover:opacity-90 transition text-sm"
        >
          {globalConfig.header.ctaButton.text}
        </a>
      </header>

      <main className="flex-1">
        {pages.map((page: any) => (
          <div key={page.pageId} className={`transition-opacity duration-300 ${activeTab === page.pageId ? "block animate-in fade-in zoom-in-95" : "hidden"}`}>
            {(Array.isArray(page.sections) ? page.sections : []).map((section: any) => {
              if (section.type === "hero") {
                const heroContent = section.content || {};
                const heroImage = heroContent.image || brand.preferredHeroImage;
                return (
                  <section key={section.id} className="px-6 py-16 md:py-24 bg-white">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.accent }}>
                          {businessProfile.typeLabel}
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-slate-950" style={{ fontFamily: typography.headingFont }}>
                          {heroContent.headline || `Website resmi ${meta.businessName}`}
                        </h1>
                        <p className="text-lg md:text-xl mb-8 text-slate-600 max-w-2xl">
                          {heroContent.subheadline || businessProfile.shortPitch}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {(heroContent.buttons || []).map((btn: any, i: number) => {
                            const href = typeof btn.href === "string" ? btn.href : "#";
                            return (
                              <button
                                key={i}
                                style={{
                                  backgroundColor: btn.style === "primary" ? colors.accent : "transparent",
                                  color: btn.style === "primary" ? "#fff" : colors.textMain,
                                  border: `1px solid ${btn.style === "primary" ? colors.accent : "#CBD5E1"}`,
                                }}
                                className="px-6 py-3 rounded-lg font-semibold transition hover:translate-y-[-1px]"
                                onClick={() => {
                                  if (href.startsWith("#")) setActiveTab(href.replace("#", ""));
                                }}
                              >
                                {btn.text || "Pelajari Lebih Lanjut"}
                              </button>
                            );
                          })}
                        </div>
                        {(trust.rating > 0 || businessProfile.contact?.phoneNational) && (
                          <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
                            {trust.rating > 0 && <span className="inline-flex items-center gap-2"><Star size={16} fill={colors.accent} color={colors.accent} /> {trust.rating.toFixed(1)} dari {trust.reviewCount || "banyak"} review</span>}
                            {businessProfile.contact?.phoneNational && <span className="inline-flex items-center gap-2"><Phone size={16} /> {businessProfile.contact.phoneNational}</span>}
                          </div>
                        )}
                      </div>
                      <div className="h-[360px] md:h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100">
                        <ImageFrame src={heroImage} label={heroContent.image || meta.businessName} attribution={brandPhotoAttribution(heroImage)} />
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "trustBar") {
                const items = section.content?.items || [
                  trust.rating ? { label: "Google Rating", value: trust.rating.toFixed(1), icon: "star" } : null,
                  trust.reviewCount ? { label: "Reviews", value: `${trust.reviewCount}+`, icon: "check" } : null,
                  businessProfile.contact?.phoneNational ? { label: "Phone", value: businessProfile.contact.phoneNational, icon: "phone" } : null,
                ].filter(Boolean);
                return (
                  <section key={section.id} className="px-6 py-6 bg-slate-50 border-y border-slate-200">
                    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 px-4 py-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.secondary, color: colors.primary }}>
                            {item.icon === "star" ? <Star size={18} /> : item.icon === "phone" ? <Phone size={18} /> : <CheckCircle2 size={18} />}
                          </div>
                          <div>
                            <p className="text-xl font-bold text-slate-950">{item.value}</p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }

              if (section.type === "features") {
                const items = section.content?.items || capabilities.filter((item: any) => item.enabled !== false).map((item: any) => ({ title: item.label, description: item.description || "Tersedia di lokasi ini." }));
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content?.title || "Mengapa Memilih Kami?"}</h2>
                      <div className="grid md:grid-cols-3 gap-8">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="bg-white p-7 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100">
                            {item.iconSvg && (
                              <div className="w-10 h-10 mb-4 text-indigo-500" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                            )}
                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                            <p className="opacity-70">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "offers") {
                const offersSource = section.content?.items || offers;
                const items = Array.isArray(offersSource) ? offersSource : [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto">
                      <div className="max-w-2xl mb-10">
                        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>Layanan</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-950">{section.content?.title || "Yang Kami Tawarkan"}</h2>
                        {section.content?.description && <p className="mt-3 text-slate-600">{section.content.description}</p>}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {items.map((offer: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="h-44">
                              <ImageFrame src={offer.image} label={offer.title} attribution={brandPhotoAttribution(offer.image)} />
                            </div>
                            <div className="p-6">
                              <h3 className="text-lg font-bold text-slate-950">{offer.title}</h3>
                              <p className="mt-2 text-sm text-slate-600">{offer.description}</p>
                              {offer.priceHint && <p className="mt-4 text-sm font-semibold" style={{ color: colors.accent }}>{offer.priceHint}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "reviews") {
                const reviewsSource = section.content?.reviews || trust.reviews;
                const reviews = Array.isArray(reviewsSource) ? reviewsSource : [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-slate-50">
                    <div className="max-w-6xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.accent }}>Ulasan Pelanggan</p>
                          <h2 className="text-3xl md:text-4xl font-bold text-slate-950">{section.content?.title || "Dipercaya pelanggan lokal"}</h2>
                        </div>
                        {trust.reviewSummary && <p className="max-w-xl text-slate-600">{trust.reviewSummary}</p>}
                      </div>
                      <div className="grid md:grid-cols-3 gap-5">
                        {reviews.map((review: any, i: number) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex gap-1 mb-4" style={{ color: colors.accent }}>
                              {Array.from({ length: Math.round(review.rating || 5) }).map((_, idx) => <Star key={idx} size={16} fill="currentColor" />)}
                            </div>
                            <p className="text-slate-700">"{review.text}"</p>
                            <p className="mt-4 font-semibold text-slate-950">{review.authorName || review.author || "Google reviewer"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "hoursLocation") {
                const hoursSource = section.content?.hours || hours.regular || section.content?.openingHours || [];
                const regularHours = Array.isArray(hoursSource) ? hoursSource : [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-white">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
                      <div className="rounded-xl border border-slate-200 p-8 bg-slate-50">
                        <div className="flex items-center gap-3 mb-5">
                          <Clock size={22} style={{ color: colors.accent }} />
                          <h2 className="text-2xl font-bold text-slate-950">{section.content?.title || "Jam Operasional"}</h2>
                        </div>
                        <div className="space-y-2 text-slate-700">
                          {regularHours.map((item: any, i: number) => <p key={i}>{typeof item === "string" ? item : item.text || JSON.stringify(item)}</p>)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-8 bg-white">
                        <div className="flex items-center gap-3 mb-5">
                          <MapPin size={22} style={{ color: colors.accent }} />
                          <h2 className="text-2xl font-bold text-slate-950">Lokasi & Kontak</h2>
                        </div>
                        <p className="text-slate-700">{section.content?.address || location.formattedAddress || businessProfile.address?.formatted || "Alamat belum tersedia."}</p>
                        {(section.content?.phone || businessProfile.contact?.phoneNational) && <p className="mt-3 font-semibold text-slate-950">{section.content?.phone || businessProfile.contact.phoneNational}</p>}
                        {(section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl) && (
                          <a href={section.content?.directionsUrl || businessProfile.contact?.directionsUrl || location.directionsUrl} className="inline-flex mt-5 px-5 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: colors.primary }}>
                            Buka Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "faq") {
                const items = section.content?.items || [];
                return (
                  <section key={section.id} className="py-20 px-6 bg-slate-50">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-3xl md:text-4xl font-bold text-slate-950 mb-8">{section.content?.title || "Pertanyaan Umum"}</h2>
                      <div className="space-y-3">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="rounded-xl bg-white border border-slate-200 p-5">
                            <h3 className="font-semibold text-slate-950">{item.question}</h3>
                            <p className="mt-2 text-slate-600">{item.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "textImageBlock") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className={`max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center ${section.content.layout === "imageRight" ? "md:flex-row-reverse" : ""}`}>
                      <div className="flex-1">
                        <h2 className="text-3xl font-bold mb-6">{section.content.title}</h2>
                        <div className="opacity-80 prose max-w-none" dangerouslySetInnerHTML={{ __html: section.content.bodyHtml }} />
                      </div>
                      <div className="flex-1 w-full relative h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-lg border border-gray-200">
                        <ImageFrame src={section.content.image} label={section.content.title} attribution={brandPhotoAttribution(section.content.image)} />
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "teamGrid") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {section.content.members.map((member: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-center pb-6">
                            <div className="h-48 bg-gray-200 mb-4">
                              <ImageFrame src={member.image} label={member.name} attribution={brandPhotoAttribution(member.image)} />
                            </div>
                            <h3 className="text-lg font-semibold">{member.name}</h3>
                            <p className="text-sm opacity-60 font-medium">{member.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "gridCards") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-6xl mx-auto">
                      <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">{section.content.title}</h2>
                        <p className="opacity-70 max-w-2xl mx-auto">{section.content.description}</p>
                      </div>
                      <div className="grid md:grid-cols-3 gap-8">
                        {section.content.cards.map((card: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                            <div className="h-48 bg-gray-200">
                              <ImageFrame src={card.image} label={card.title} attribution={brandPhotoAttribution(card.image)} />
                            </div>
                            <div className="p-6">
                              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                              <p className="opacity-70 mb-4">{card.description}</p>
                              {card.price && <p className="font-semibold text-lg" style={{ color: colors.accent }}>{card.price}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "imageGallery") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {section.content.images.map((img: string, i: number) => (
                          <div key={i} className="h-64 bg-gray-200 rounded-xl overflow-hidden">
                            <ImageFrame src={img} label={`Gallery ${i + 1}`} attribution={brandPhotoAttribution(img)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "contactForm") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                      <div style={{ backgroundColor: colors.primary, color: "#fff" }} className="p-10 md:w-2/5">
                        <h2 className="text-2xl font-bold mb-6">{section.content.title}</h2>
                        <div className="space-y-4 text-sm opacity-90">
                          <p><strong>Alamat:</strong><br />{section.content.address}</p>
                          <p><strong>Telepon:</strong><br />{section.content.phone}</p>
                          <p><strong>Email:</strong><br />{section.content.email}</p>
                          <div>
                            <strong>Jam Operasional:</strong>
                            <ul className="mt-1 space-y-1">
                              {section.content.openingHours.map((h: string, i: number) => <li key={i}>{h}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 md:w-3/5">
                        <h3 className="text-xl font-bold mb-6">{section.content.formConfig.heading}</h3>
                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); }}>
                          {section.content.formConfig.fields.map((f: any, i: number) => (
                            <div key={i}>
                              <label className="block text-sm font-medium opacity-80 mb-1">{f.label}</label>
                              {f.type === "textarea" ? (
                                <textarea required={f.required} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" rows={4}></textarea>
                              ) : (
                                <input required={f.required} type={f.type} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" />
                              )}
                            </div>
                          ))}
                          <button style={{ backgroundColor: colors.accent, color: "#fff" }} className="px-6 py-3 rounded-lg font-medium hover:opacity-90 transition pt-2">
                            {section.content.formConfig.buttonText}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              return <div key={section.id} className="py-20 text-center opacity-50">[Section: {section.type}]</div>;
            })}
          </div>
        ))}
      </main>

      <footer style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-12 px-6 text-center opacity-90 text-sm">
        <p>{globalConfig.footer.text}</p>
      </footer>

      {conversion.stickyMobileCta && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-[110] bg-white border-t border-slate-200 p-3 flex gap-2">
          <a href={conversion.primaryCta?.href || globalConfig.header.ctaButton.href} className="flex-1 text-center rounded-lg px-4 py-3 text-white font-semibold" style={{ backgroundColor: colors.accent }}>
            {conversion.primaryCta?.text || globalConfig.header.ctaButton.text}
          </a>
          {conversion.secondaryCta?.href && (
            <a href={conversion.secondaryCta.href} className="flex-1 text-center rounded-lg px-4 py-3 font-semibold border border-slate-300 text-slate-800">
              {conversion.secondaryCta.text || "Lokasi"}
            </a>
          )}
        </div>
      )}

      {showProspectPanel && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-4 rounded-full shadow-2xl border border-gray-200 flex items-center gap-4 z-[100] hide-in-export">
          <span className="font-semibold text-gray-900 mr-2 text-sm">Pratinjau Khusus</span>
          {onDownloadZip && (
            <button
              onClick={onDownloadZip}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-full transition"
            >
              Unduh Kode Html (Gratis)
            </button>
          )}
          <button
            onClick={() => {
              const link = publicLinks.basic;
              if (confirm("Layanan hosting & managed setup $120/tahun. Lanjutkan ke pembayaran?")) {
                window.open(link, "_blank");
              }
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full transition"
          >
            Terima Beres ($120/thn)
          </button>
        </div>
      )}

      <style>{`
        @media print { .hide-in-export { display: none !important; } }
      `}</style>
    </div>
  );
}
