import { useEffect, useState } from "react";
import { Search, Loader2, Camera, ExternalLink, Mail, MessageSquare } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { defaultOutputTokens, estimateCostUsd, estimateTokensFromText, formatUsd } from "../../lib/aiPricing";
import { useLocalStorageState } from "../../lib/localStorageState";
import { getStylePreset, inferStylePresetFromText } from "../../lib/siteStylePresets";

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiProvider, setAiProvider] = useLocalStorageState("webview.adminLeads.aiProvider", "OpenRouter");
  const [aiModel, setAiModel] = useLocalStorageState("webview.adminLeads.aiModel", "~anthropic/claude-sonnet-latest");
  const [settings, setSettings] = useState<any>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logoSelections, setLogoSelections] = useState<Record<string, { url: string; reference: string; palette: string[]; attributions: string[]; priorityLabel: string; source: string }>>({});

  const providers: Record<string, { label: string; models: { value: string; label: string }[] }> = {
    OpenAI: {
      label: "OpenAI API",
      models: [
        { value: "gpt-5.5", label: "GPT-5.5 ($5 in / $30 out)" },
        { value: "gpt-5.4", label: "GPT-5.4 ($2.50 in / $15 out)" },
        { value: "gpt-5.4-mini", label: "GPT-5.4 Mini ($0.75 in / $4.50 out)" },
        { value: "gpt-4.1", label: "GPT-4.1 Legacy ($2 in / $8 out)" }
      ]
    },
    Gemini: {
      label: "Gemini API",
      models: [
        { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview ($2 in / $12 out)" },
        { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview ($0.50 in / $3 out)" },
        { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite ($0.25 in / $1.50 out)" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro Legacy" }
      ]
    },
    OpenRouter: {
      label: "OpenRouter API",
      models: [
        { value: "~anthropic/claude-sonnet-latest", label: "Claude Sonnet Latest ($3 in / $15 out)" },
        { value: "~openai/gpt-latest", label: "OpenAI GPT Latest ($5 in / $30 out)" },
        { value: "~google/gemini-pro-latest", label: "Gemini Pro Latest ($2 in / $12 out)" },
        { value: "~google/gemini-flash-latest", label: "Gemini Flash Latest ($0.50 in / $3 out)" },
        { value: "qwen/qwen3.6-max-preview", label: "Qwen3.6 Max Preview ($1.04 in / $6.24 out)" },
        { value: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash ($0.25 in / $1.50 out)" }
      ]
    },
    KIE: {
      label: "KIE.ai API",
      models: [
        { value: "kie/gpt-5-5", label: "KIE GPT-5.5 (est. $2.50 in / $15 out)" },
        { value: "kie/gpt-5-2", label: "KIE GPT-5.2 (cek live credit KIE)" },
        { value: "kie/gemini-3.1-pro", label: "KIE Gemini 3.1 Pro (est. $1 in / $6 out)" },
        { value: "kie/gemini-3-flash", label: "KIE Gemini 3 Flash (est. $0.25 in / $1.50 out)" }
      ]
    },
    Opencode: {
      label: "Opencode API (Custom)",
      models: [
        { value: "opencode-default", label: "Default model dari endpoint" },
        { value: "qwen/qwen3.6-flash", label: "Qwen3.6 Flash" },
        { value: "qwen/qwen3.6-max-preview", label: "Qwen3.6 Max Preview" },
        { value: "custom-model", label: "Custom model alias" }
      ]
    }
  };
  const activeProviderKey = providers[aiProvider] ? aiProvider : "OpenRouter";
  const activeProvider = providers[activeProviderKey];
  const activeModel = activeProvider.models.some((model) => model.value === aiModel)
    ? aiModel
    : activeProvider.models[0].value;

  useEffect(() => {
    const provider = providers[aiProvider] ? aiProvider : "OpenRouter";
    if (provider !== aiProvider) {
      setAiProvider(provider);
      return;
    }

    const hasModel = providers[provider].models.some((model) => model.value === aiModel);
    if (!hasModel) {
      setAiModel(providers[provider].models[0].value);
    }
  }, [aiProvider, aiModel]);

  const fetchLeads = () => {
    fetch("/api/leads")
      .then(r => r.ok ? r.json() : [])
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .catch(e => console.error(e));
  };

  const selectedPrice = estimateCostUsd(activeProviderKey, activeModel);
  const providerApiKeyMap: Record<string, string> = {
    OpenRouter: "OPENROUTER_API_KEY",
    OpenAI: "OPENAI_API_KEY",
    Gemini: "GEMINI_API_KEY",
    KIE: "KIE_API_KEY",
    Opencode: "OPENCODE_API_KEY",
  };
  const settingsKey = providerApiKeyMap[activeProviderKey] || "";
  const missingRequiredSettings = [
    !String(settings?.GOOGLE_PLACES_API_KEY || "").trim() ? "Google Places API Key" : "",
    !String(settings?.[settingsKey] || "").trim() ? `${activeProvider.label} Key` : "",
  ].filter(Boolean);

  const getPhotoReference = (photo: any) => photo?.photo_reference || photo?.name || photo?.reference || "";

  const getPhotoUrl = (photo: any, maxWidth = 320) => {
    const reference = getPhotoReference(photo);
    if (!reference) return "";
    return `/api/places/photo?reference=${encodeURIComponent(reference)}&maxwidth=${maxWidth}`;
  };

  const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim();

  const getPhotoAttributions = (photo: any) => {
    const legacy = Array.isArray(photo?.html_attributions)
      ? photo.html_attributions.map((value: string) => stripHtml(String(value)))
      : [];
    const newApi = Array.isArray(photo?.authorAttributions)
      ? photo.authorAttributions
          .map((item: any) => item?.displayName || item?.uri || item?.photoUri || "")
          .filter(Boolean)
      : [];
    return [...legacy, ...newApi].filter(Boolean);
  };

  const photoPriority = (photo: any, businessName: string) => {
    const attributions = getPhotoAttributions(photo).join(" ").toLowerCase();
    const nameTokens = businessName.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
    if (attributions && nameTokens.some((token) => attributions.includes(token))) return 0;
    if (!attributions) return 1;
    return 2;
  };

  const photoPriorityLabel = (photo: any, businessName: string) => {
    const priority = photoPriority(photo, businessName);
    if (priority === 0) return "Owner-like";
    if (priority === 1) return "No attribution";
    return "UGC/attributed";
  };

  const sortedPhotosForPlace = (place: any) =>
    [...(Array.isArray(place?.photos) ? place.photos : [])].sort((a, b) =>
      photoPriority(a, place?.name || "") - photoPriority(b, place?.name || ""),
    );

  const estimateGenerateCost = (place?: any) => {
    const source = place ? JSON.stringify(place) : searchQuery;
    const inputTokens = estimateTokensFromText(source, 5000);
    return estimateCostUsd(activeProviderKey, activeModel, inputTokens, defaultOutputTokens);
  };

  const extractPaletteFromImage = (imageUrl: string) => new Promise<string[]>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 72;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas tidak tersedia."));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      const buckets = new Map<string, number>();

      for (let i = 0; i < pixels.length; i += 16) {
        const alpha = pixels[i + 3];
        if (alpha < 180) continue;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max > 245 || min < 10 || max - min < 18) continue;

        const key = [r, g, b].map((value) => Math.round(value / 32) * 32).join(",");
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      const palette = Array.from(buckets.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => {
          const [r, g, b] = key.split(",").map(Number);
          return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
        });

      resolve(palette.length ? palette : ["#111827", "#4F46E5", "#F3F4F6"]);
    };
    img.onerror = () => reject(new Error("Gagal membaca gambar logo."));
    img.src = imageUrl;
  });

  const selectLogoPhoto = async (placeId: string, imageUrl: string, photo: any, businessName: string) => {
    const attributions = getPhotoAttributions(photo);
    const priorityLabel = photoPriorityLabel(photo, businessName);
    const reference = getPhotoReference(photo);
    try {
      const palette = await extractPaletteFromImage(imageUrl);
      setLogoSelections(prev => ({ ...prev, [placeId]: { url: imageUrl, reference, palette, attributions, priorityLabel, source: "google_places" } }));
    } catch (error) {
      console.error(error);
      setLogoSelections(prev => ({ ...prev, [placeId]: { url: imageUrl, reference, palette: ["#111827", "#4F46E5", "#F3F4F6"], attributions, priorityLabel, source: "google_places" } }));
    }
  };

  const inferLocaleFromPlace = (place: any) => {
    const text = [
      place.formatted_address,
      place.formattedAddress,
      place.plus_code?.compound_code,
      place.vicinity,
    ].filter(Boolean).join(" ").toLowerCase();

    if (/\b(united states|usa|tx|texas|ca|california|fl|florida|ny|new york|az|arizona|ga|georgia)\b/.test(text)) {
      return { language: "en", region: "US" };
    }
    if (/\b(indonesia|jakarta|bandung|surabaya|bali|yogyakarta|semarang|medan)\b/.test(text)) {
      return { language: "id", region: "ID" };
    }
    return { language: "en", region: "US" };
  };

  const inferStylePresetFromPlace = (place: any) => {
    const text = [
      place.name,
      place.formatted_address,
      ...(Array.isArray(place.types) ? place.types : []),
    ].filter(Boolean).join(" ").toLowerCase();

    return inferStylePresetFromText(text);
  };

  useEffect(() => {
    fetchLeads();
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setSettings(data);
        setLoadingSettings(false);
      })
      .catch(() => setLoadingSettings(false));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchMessage("");
    setSearchResults([]);
    try {
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(searchQuery)}`);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Response bukan JSON: ${text.substring(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Places API returned ${res.status}`);
      }

      const results = Array.isArray(data.results) ? data.results : [];
      setSearchResults(results);
      if (results.length === 0) {
        setSearchMessage(data.hint || data.error || `Tidak ada hasil untuk "${searchQuery}". Coba query lebih spesifik seperti "concrete contractor Dallas Texas".`);
      } else {
        setSearchMessage(data.mock ? "Mode mock aktif karena Google Places API Key belum terbaca." : `${results.length} hasil ditemukan.`);
      }
    } catch (e) {
      console.error(e);
      setSearchMessage(e instanceof Error ? e.message : "Gagal mencari prospek.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateSite = async (place: any) => {
    setIsGenerating(true);
    
    // Simulate AI generation process with a mock JSON
    // A Real implementation would send 'place' to an OpenAI endpoint on our server
    const businessId = place.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-" + Math.floor(Math.random() * 1000);
    const logoSelection = logoSelections[place.place_id || place.name];
    const brandPalette = logoSelection?.palette || [];
    const primaryColor = brandPalette[0] || "#111827";
    const accentColor = brandPalette[1] || "#4F46E5";
    const secondaryColor = brandPalette[2] || "#F3F4F6";
    const phone = place.formatted_phone_number || place.international_phone_number || place.nationalPhoneNumber || "0000000000";
    const mapsUrl = place.url || place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
    const rating = Number(place.rating || 0);
    const reviewCount = Number(place.user_ratings_total || place.userRatingCount || 0);
    const locale = inferLocaleFromPlace(place);
    const stylePreset = inferStylePresetFromPlace(place);
    const stylePresetMeta = getStylePreset(stylePreset);
    const isEnglish = locale.language === "en";
    const mockJson = {
      meta: {
        businessName: place.name,
        businessId: businessId,
        niche: Array.isArray(place.types) ? place.types[0] : "general",
        language: locale.language,
        region: locale.region,
        seoDescription: isEnglish ? `Official website for ${place.name}.` : `Website resmi untuk ${place.name}.`,
        brandPalette,
      },
      sourceData: {
        provider: "google_places",
        placeId: place.place_id || place.id || "",
        resourceName: place.name?.startsWith?.("places/") ? place.name : "",
        googleMapsUri: mapsUrl,
        lastSyncedAt: new Date().toISOString(),
        businessStatus: place.business_status || place.businessStatus || "",
        pureServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness),
        hasWebsite: Boolean(place.website || place.websiteUri),
        websiteUri: place.website || place.websiteUri || null,
        attributions: logoSelection?.attributions || []
      },
      design: {
        stylePreset,
        stylePresetConfig: {
          label: stylePresetMeta.label,
          mood: stylePresetMeta.mood,
          industries: stylePresetMeta.industries,
          recommendedColors: stylePresetMeta.recommendedColors,
        },
        themeVariables: {
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor,
            textMain: "#1F2937",
            textMuted: "#6B7280",
            background: "#FFFFFF"
          },
          typography: {
            headingFont: "'Inter', sans-serif",
            bodyFont: "'Inter', sans-serif"
          }
        }
      },
      brand: {
        logoImageUrl: logoSelection?.url || "",
        logoSvg: "",
        palette: brandPalette,
        preferredHeroImage: logoSelection?.url || "",
        photoSource: logoSelection?.source || "",
        googlePhotoReference: logoSelection?.reference || "",
        photoCaption: logoSelection?.source === "google_places" ? "Photo from Google Business Profile" : "",
        photoAttributions: logoSelection?.attributions || [],
        selectedPhotoPriority: logoSelection?.priorityLabel || ""
      },
      businessProfile: {
        name: place.name,
        primaryType: Array.isArray(place.types) ? place.types[0] : "local_business",
        typeLabel: Array.isArray(place.types) ? String(place.types[0]).replace(/_/g, " ") : "Local business",
        categories: Array.isArray(place.types) ? place.types : [],
        shortPitch: isEnglish
          ? `A trusted local business serving customers around ${place.formatted_address || "the local area"}.`
          : `Layanan lokal terpercaya di ${place.formatted_address || "area sekitar"}.`,
        address: {
          formatted: place.formatted_address || place.formattedAddress || "",
        },
        contact: {
          phoneNational: phone,
          phoneInternational: phone,
          directionsUrl: mapsUrl
        }
      },
      trust: {
        rating,
        reviewCount,
        reviewSummary: reviewCount
          ? isEnglish
            ? `${place.name} has a ${rating.toFixed(1)} rating from ${reviewCount} Google reviews.`
            : `${place.name} memiliki rating ${rating.toFixed(1)} dari ${reviewCount} review Google.`
          : "",
        reviews: [],
        badges: [
          place.business_status === "OPERATIONAL" ? "Operational" : "",
          place.website || place.websiteUri ? "Has website" : "No website lead",
          phone !== "0000000000" ? "Has phone" : ""
        ].filter(Boolean)
      },
      offers: [
        {
          title: isEnglish ? "Core Service" : "Layanan Utama",
          description: isEnglish ? `Professional local support from ${place.name}.` : `Solusi profesional dari ${place.name} untuk pelanggan lokal.`,
          priceHint: isEnglish ? "Contact for estimate" : "Hubungi untuk estimasi",
          image: logoSelection?.url || "",
          cta: { text: isEnglish ? "Request Info" : "Minta Info", href: "#contact" },
        },
        {
          title: isEnglish ? "Fast Consultation" : "Konsultasi Cepat",
          description: isEnglish ? "Ask about your needs and get clear next steps." : "Tanyakan kebutuhan Anda dan dapatkan arahan layanan yang sesuai.",
          priceHint: isEnglish ? "Fast response" : "Respon cepat",
          image: "",
          cta: { text: isEnglish ? "Contact" : "Hubungi", href: "#contact" },
        },
        {
          title: isEnglish ? "Local Visit" : "Kunjungan Lokal",
          description: isEnglish ? "Location and directions are available through Google Maps." : "Informasi lokasi dan rute tersedia langsung dari Google Maps.",
          priceHint: isEnglish ? "Open Maps" : "Buka Maps",
          image: "",
          cta: { text: isEnglish ? "Get Directions" : "Lihat Lokasi", href: mapsUrl },
        }
      ],
      capabilities: [
        { label: "Bisnis lokal", enabled: true, source: "google_places.types", description: "Profil bisnis diambil dari data Google Places." },
        { label: "Rating Google", enabled: rating > 0, source: "google_places.rating", description: reviewCount ? `${reviewCount} review tersedia.` : "Rating belum tersedia." },
        { label: "Kontak langsung", enabled: phone !== "0000000000", source: "google_places.phone", description: "CTA diarahkan ke kontak bisnis." }
      ],
      location: {
        formattedAddress: place.formatted_address || place.formattedAddress || "",
        directionsUrl: mapsUrl,
        isServiceAreaBusiness: Boolean(place.pureServiceAreaBusiness)
      },
      hours: {
        timezone: "",
        openNow: Boolean(place.opening_hours?.open_now),
        regular: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : [],
        current: []
      },
      conversion: {
        primaryCta: { text: "Hubungi Sekarang", href: phone !== "0000000000" ? `tel:${phone}` : "#contact" },
        secondaryCta: { text: "Buka Maps", href: mapsUrl },
        stickyMobileCta: true,
        leadForm: { enabled: true, fields: ["name", "phone", "message"], submitLabel: "Kirim Pesan" }
      },
      seo: {
        title: `${place.name} - Website Resmi`,
        description: `Website resmi untuk ${place.name} di ${place.formatted_address || "area lokal"}.`,
        localBusinessSchema: {},
        keywords: Array.isArray(place.types) ? place.types : [],
        cityLandingPhrase: place.formatted_address || ""
      },
      global: {
        header: {
          logoImageUrl: logoSelection?.url || "",
          ctaButton: { text: isEnglish ? "Call Now" : "Hubungi", href: phone !== "0000000000" ? `tel:${phone}` : "#contact" }
        },
        footer: { text: `© 2026 ${place.name}. All rights reserved.` }
      },
      navigation: {
        headerMenu: [
          { label: isEnglish ? "Home" : "Beranda", href: "#home" },
          { label: isEnglish ? "Services" : "Layanan", href: "#services" },
          { label: isEnglish ? "Contact" : "Kontak", href: "#contact" }
        ]
      },
      pages: [
        {
          pageId: "home",
          sections: [
            {
              type: "hero",
              id: "hero-1",
              content: {
                headline: isEnglish ? `${place.name} is ready to help locally` : `${place.name} siap membantu kebutuhan lokal Anda`,
                subheadline: place.formatted_address || (isEnglish ? "Business information from Google Places." : "Informasi bisnis dari Google Places."),
                buttons: [
                  { text: isEnglish ? "Contact Us" : "Hubungi Kami", href: "#contact", style: "primary" },
                  { text: isEnglish ? "Open Maps" : "Buka Maps", href: mapsUrl, style: "outline" }
                ],
                image: logoSelection?.url || ""
              }
            },
            { type: "trustBar", id: "trust-1", content: {} },
            {
              type: "features",
              id: "features-1",
              content: {
                title: isEnglish ? "Why this business stands out" : "Kenapa bisnis ini relevan",
                items: [
                  { title: isEnglish ? "Active Google profile" : "Profil Google aktif", description: place.business_status || (isEnglish ? "Business data is available from Google Places." : "Data bisnis tersedia dari Google Places.") },
                  { title: isEnglish ? "Easy to contact" : "Mudah dihubungi", description: phone !== "0000000000" ? phone : (isEnglish ? "Contact details can be completed by admin." : "Kontak bisa dilengkapi oleh admin.") },
                  { title: isEnglish ? "Website-ready" : "Siap dibuatkan website", description: place.website || place.websiteUri ? (isEnglish ? "Already has a website, good for redesign." : "Sudah punya website, cocok untuk redesign.") : (isEnglish ? "No website detected yet." : "Belum terdeteksi punya website.") }
                ]
              }
            },
            { type: "offers", id: "offers-1", content: { title: isEnglish ? "Services to highlight" : "Layanan yang bisa ditonjolkan" } },
            { type: "reviews", id: "reviews-1", content: { title: isEnglish ? "Google social proof" : "Social proof dari Google" } },
            {
              type: "hoursLocation",
              id: "location-1",
              content: {
                title: isEnglish ? "Location and contact" : "Lokasi dan kontak",
                address: place.formatted_address || "",
                phone,
                directionsUrl: mapsUrl
              }
            },
            {
              type: "faq",
              id: "faq-1",
              content: {
                title: isEnglish ? "Common questions" : "Pertanyaan umum",
                items: [
                  { question: isEnglish ? "How do I contact this business?" : "Bagaimana cara menghubungi bisnis ini?", "answer": phone !== "0000000000" ? (isEnglish ? `Call directly at ${phone}.` : `Hubungi langsung di ${phone}.`) : (isEnglish ? "Phone number is not available yet and can be completed manually." : "Nomor telepon belum tersedia dan bisa dilengkapi manual.") },
                  { question: isEnglish ? "Can this data be edited?" : "Apakah data ini bisa diedit?", "answer": isEnglish ? "Yes. The generated JSON can be corrected before the final website is used." : "Bisa. JSON hasil generate dapat dikoreksi sebelum dipakai sebagai website final." }
                ]
              }
            }
          ]
        }
      ]
    };

    try {
      await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: activeModel,
          provider: activeProviderKey,
          jsonContent: mockJson,
          businessId,
          businessName: place.name,
          phone,
          originData: place,
          brandPalette,
          selectedLogoImageUrl: logoSelection?.url || "",
          selectedLogoReference: logoSelection?.reference || "",
          selectedLogoSource: logoSelection?.source || "",
          selectedLogoAttributions: logoSelection?.attributions || [],
          selectedLogoPriority: logoSelection?.priorityLabel || ""
        })
      });
      fetchLeads();
      setSearchResults([]);
      setSearchQuery("");
    } catch (e) {
      console.error(e);
    }
    
    setIsGenerating(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    fetchLeads();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <h1 className="text-3xl font-semibold mb-8 text-gray-900">CRM Leads</h1>

      {(!loadingSettings && missingRequiredSettings.length > 0) && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <div className="text-amber-500 mt-0.5">⚠️</div>
          <div>
            <h3 className="text-amber-800 font-semibold text-sm">Persiapan Belum Selesai</h3>
            <p className="text-amber-700 text-sm mt-1">
              Field berikut belum terbaca dari settings: <strong>{missingRequiredSettings.join(", ")}</strong>.
              Pencarian Maps atau Generasi AI mungkin tidak akan berfungsi tanpa API Key yang tepat.
            </p>
            <a href="/admin/settings" className="inline-block mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition">
              Atur API Keys di Settings
            </a>
          </div>
        </div>
      )}

      {/* SEARCH SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <h2 className="text-lg font-medium text-gray-900">Cari Prospek Baru (Google Maps)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 font-medium">AI Web Builder:</label>
            <select 
              value={activeProviderKey}
              onChange={(e) => {
                setAiProvider(e.target.value);
                setAiModel(providers[e.target.value].models[0].value);
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.keys(providers).map(pKey => (
                <option key={pKey} value={pKey}>{providers[pKey].label}</option>
              ))}
            </select>
            <select 
              value={activeModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {activeProvider.models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">Perkiraan biaya generate JSON</p>
            <p>
              {selectedPrice.total !== null
                ? `${formatUsd(estimateGenerateCost().total)} per generate awal (${activeModel})`
                : `Harga ${activeModel} belum fixed. Cek dashboard provider sebelum generate.`}
            </p>
          </div>
          <a href="/admin/settings" className="text-indigo-700 font-medium hover:underline">Lihat pricing & API key</a>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Contoh: Kedai Kopi di Senopati" 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center min-w-[120px]"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Cari"}
          </button>
        </div>

        {searchMessage && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            searchResults.length > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {searchMessage}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            {searchResults.map((place, idx) => (
              <div key={idx} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{place.name}</h3>
                  <p className="text-sm text-gray-500">{place.formatted_address}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Estimasi: {formatUsd(estimateGenerateCost(place).total)} untuk generate JSON ini.
                  </p>
                </div>
                <button 
                  onClick={() => handleGenerateSite(place)}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Generate Site
                </button>
                </div>
                {place.photos?.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pilih gambar logo/brand untuk palet warna</p>
                    <p className="text-xs text-gray-500 mb-3">
                      Foto gratis akan dipakai runtime via proxy Google Places, tidak di-upload ke R2. Caption attribution ikut disimpan di JSON.
                      Urutan tetap best-effort karena Places API tidak memberi flag owner photo.
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {sortedPhotosForPlace(place).slice(0, 6).map((photo: any, photoIdx: number) => {
                        const imageUrl = getPhotoUrl(photo);
                        const selected = logoSelections[place.place_id || place.name]?.url === imageUrl;
                        const priorityLabel = photoPriorityLabel(photo, place.name);
                        return (
                          <button
                            key={photo.photo_reference || photoIdx}
                            type="button"
                            onClick={() => selectLogoPhoto(place.place_id || place.name, imageUrl, photo, place.name)}
                            className={`relative w-24 h-24 rounded-xl overflow-hidden border-2 bg-white shrink-0 ${selected ? "border-indigo-600" : "border-gray-200 hover:border-gray-300"}`}
                            title={`Gunakan sebagai sumber warna brand. Prioritas: ${priorityLabel}`}
                          >
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                            <span className="absolute left-1 right-1 bottom-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                              {priorityLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {logoSelections[place.place_id || place.name]?.palette?.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Palette:</span>
                        {logoSelections[place.place_id || place.name].palette.map((color) => (
                          <span key={color} className="w-6 h-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEADS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
                <th className="p-4">Bisnis</th>
                <th className="p-4">Preview URL</th>
                <th className="p-4">Status & Views</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{lead.business_name}</p>
                    <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4">
                    <a 
                      href={`/${lead.business_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                    >
                      /{lead.business_id} <ExternalLink size={14} />
                    </a>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <select 
                        value={lead.status} 
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded p-1 bg-white text-gray-700 w-32"
                      >
                        <option value="scraped">Scraped</option>
                        <option value="contacted">Contacted</option>
                        <option value="viewed">Viewed</option>
                        <option value="checkout_pending">Checkout Pending</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="won_paid">Won (Paid)</option>
                        <option value="lost">Lost</option>
                      </select>
                      {lead.view_count > 0 && (
                        <span className="text-xs text-emerald-600 font-medium">
                          Dilihat {lead.view_count}x
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    {/* Instant screenshot feature (mock logic for demo) */}
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <Camera size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Screenshot Preview
                      </span>
                    </button>
                    <a href={`mailto:${lead.email || 'hello@example.com'}`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <Mail size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send Email
                      </span>
                    </a>
                    <a href={`sms:+10000000000`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded group relative">
                      <MessageSquare size={18} />
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
                        Send SMS
                      </span>
                    </a>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada prospek. Gunakan fitur pencarian di atas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
