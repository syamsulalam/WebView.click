export type FontPairing = {
  id: string;
  label: string;
  headingFont: string;
  bodyFont: string;
  headingCss: string;
  bodyCss: string;
  mood: string;
  industries: string[];
  keywords: string[];
  sourceNote: string;
};

const font = (name: string) => `'${name}', sans-serif`;
const serifFont = (name: string) => `'${name}', serif`;
const scriptFont = (name: string) => `'${name}', cursive`;

export const fontPairings: FontPairing[] = [
  { id: "montserrat-raleway", label: "Montserrat + Raleway", headingFont: "Montserrat", bodyFont: "Raleway", headingCss: font("Montserrat"), bodyCss: font("Raleway"), mood: "geometric, polished, approachable", industries: ["general", "professional", "local service", "agency"], keywords: ["general", "local", "service", "agency", "consulting"], sourceNote: "Article pairing #1" },
  { id: "lobster-open-sans", label: "Lobster + Open Sans", headingFont: "Lobster", bodyFont: "Open Sans", headingCss: scriptFont("Lobster"), bodyCss: font("Open Sans"), mood: "playful, friendly, casual", industries: ["restaurant", "cafe", "bakery", "beauty"], keywords: ["restaurant", "cafe", "coffee", "bakery", "cake", "salon", "spa"], sourceNote: "Article pairing #2" },
  { id: "ubuntu-nanum", label: "Ubuntu + Nanum Gothic", headingFont: "Ubuntu", bodyFont: "Nanum Gothic", headingCss: font("Ubuntu"), bodyCss: font("Nanum Gothic"), mood: "digital, friendly, clear", industries: ["technology", "education", "software", "repair"], keywords: ["tech", "software", "computer", "education", "repair", "electronics"], sourceNote: "Article pairing #3" },
  { id: "bebas-source", label: "Bebas Neue + Source Sans Pro", headingFont: "Bebas Neue", bodyFont: "Source Sans Pro", headingCss: font("Bebas Neue"), bodyCss: font("Source Sans Pro"), mood: "strong, condensed, direct", industries: ["contractor", "construction", "auto", "fitness", "security"], keywords: ["contractor", "concrete", "construction", "roof", "paving", "auto", "garage", "fitness", "security"], sourceNote: "Article pairing #4" },
  { id: "arvo-roboto", label: "Arvo + Roboto", headingFont: "Arvo", bodyFont: "Roboto", headingCss: serifFont("Arvo"), bodyCss: font("Roboto"), mood: "trustworthy, sturdy, readable", industries: ["local service", "repair", "home service", "clinic"], keywords: ["repair", "home", "service", "clinic", "dental", "medical"], sourceNote: "Article pairing #5" },
  { id: "monoton-rubik", label: "Monoton + Rubik", headingFont: "Monoton", bodyFont: "Rubik", headingCss: font("Monoton"), bodyCss: font("Rubik"), mood: "retro, nightlife, energetic", industries: ["bar", "event", "entertainment", "fitness"], keywords: ["bar", "club", "event", "music", "party", "gym", "training"], sourceNote: "Article pairing #6" },
  { id: "ibm-plex", label: "IBM Plex Sans + Condensed", headingFont: "IBM Plex Sans", bodyFont: "IBM Plex Sans Condensed", headingCss: font("IBM Plex Sans"), bodyCss: font("IBM Plex Sans Condensed"), mood: "technical, precise, enterprise", industries: ["technology", "b2b", "industrial", "finance"], keywords: ["technology", "industrial", "engineering", "finance", "accounting", "b2b"], sourceNote: "Article pairing #7" },
  { id: "courgette-libre", label: "Courgette + Libre Baskerville", headingFont: "Courgette", bodyFont: "Libre Baskerville", headingCss: scriptFont("Courgette"), bodyCss: serifFont("Libre Baskerville"), mood: "elegant, classic, soft", industries: ["wedding", "beauty", "boutique", "restaurant"], keywords: ["wedding", "beauty", "boutique", "florist", "restaurant", "spa"], sourceNote: "Article pairing #8" },
  { id: "roboto-mono", label: "Roboto Black + Roboto Mono", headingFont: "Roboto", bodyFont: "Roboto Mono", headingCss: font("Roboto"), bodyCss: "'Roboto Mono', monospace", mood: "modern, utilitarian, systematic", industries: ["technology", "repair", "security", "industrial"], keywords: ["tech", "repair", "security", "industrial", "automation"], sourceNote: "Article pairing #9" },
  { id: "abril-work-sans", label: "Abril Fatface + Work Sans", headingFont: "Abril Fatface", bodyFont: "Work Sans", headingCss: serifFont("Abril Fatface"), bodyCss: font("Work Sans"), mood: "editorial, premium, confident", industries: ["real estate", "interior", "fashion", "restaurant"], keywords: ["real estate", "interior", "design", "fashion", "luxury", "restaurant"], sourceNote: "Article pairing #10" },
  { id: "merriweather-lora", label: "Merriweather + Lora", headingFont: "Merriweather", bodyFont: "Lora", headingCss: serifFont("Merriweather"), bodyCss: serifFont("Lora"), mood: "serious, editorial, authoritative", industries: ["legal", "finance", "consulting", "education"], keywords: ["law", "legal", "attorney", "finance", "insurance", "accounting", "school", "education"], sourceNote: "Article pairing #11" },
  { id: "roboto-mono-spectral", label: "Roboto Mono + Spectral", headingFont: "Roboto Mono", bodyFont: "Spectral", headingCss: "'Roboto Mono', monospace", bodyCss: serifFont("Spectral"), mood: "technical, literary, distinctive", industries: ["technology", "architecture", "consulting"], keywords: ["architecture", "engineering", "tech", "consulting", "studio"], sourceNote: "Article pairing #12" },
  { id: "oswald-nunito", label: "Oswald + Nunito", headingFont: "Oswald", bodyFont: "Nunito", headingCss: font("Oswald"), bodyCss: font("Nunito"), mood: "compact, friendly, active", industries: ["contractor", "cleaning", "fitness", "local service"], keywords: ["cleaning", "contractor", "concrete", "landscape", "fitness", "service"], sourceNote: "Article pairing #13" },
  { id: "permanent-marker-abeezee", label: "Permanent Marker + ABeeZee", headingFont: "Permanent Marker", bodyFont: "ABeeZee", headingCss: scriptFont("Permanent Marker"), bodyCss: font("ABeeZee"), mood: "playful, handmade, youthful", industries: ["kids", "education", "creative", "event"], keywords: ["kids", "child", "school", "creative", "party", "event"], sourceNote: "Article pairing #14" },
  { id: "archivo-hind", label: "Archivo Black + Hind", headingFont: "Archivo Black", bodyFont: "Hind", headingCss: font("Archivo Black"), bodyCss: font("Hind"), mood: "bold, practical, hard-working", industries: ["contractor", "industrial", "auto", "security"], keywords: ["contractor", "construction", "concrete", "industrial", "auto", "security", "roof"], sourceNote: "Article pairing #15" },
  { id: "gravitas-poppins", label: "Gravitas One + Poppins", headingFont: "Gravitas One", bodyFont: "Poppins", headingCss: serifFont("Gravitas One"), bodyCss: font("Poppins"), mood: "premium, poster-like, refined", industries: ["real estate", "restaurant", "boutique", "law"], keywords: ["real estate", "boutique", "restaurant", "law", "legal", "premium"], sourceNote: "Article pairing #16" },
  { id: "alfa-chivo", label: "Alfa Slab One + Chivo", headingFont: "Alfa Slab One", bodyFont: "Chivo", headingCss: serifFont("Alfa Slab One"), bodyCss: font("Chivo"), mood: "heavy, sturdy, confident", industries: ["contractor", "mechanic", "manufacturing", "sports"], keywords: ["contractor", "mechanic", "manufacturing", "concrete", "sports", "gym"], sourceNote: "Article pairing #17" },
  { id: "architects-abel", label: "Architects Daughter + Abel", headingFont: "Architects Daughter", bodyFont: "Abel", headingCss: scriptFont("Architects Daughter"), bodyCss: font("Abel"), mood: "sketched, human, informal", industries: ["architecture", "design", "landscaping", "creative"], keywords: ["architect", "design", "landscape", "garden", "studio", "creative"], sourceNote: "Article pairing #18" },
  { id: "fjalla-merriweather-sans", label: "Fjalla One + Merriweather Sans", headingFont: "Fjalla One", bodyFont: "Merriweather Sans", headingCss: font("Fjalla One"), bodyCss: font("Merriweather Sans"), mood: "sharp, service-ready, grounded", industries: ["contractor", "home service", "repair", "auto"], keywords: ["contractor", "repair", "plumbing", "hvac", "auto", "roof", "concrete"], sourceNote: "Article pairing #19" },
  { id: "rokkitt-raleway", label: "Rokkitt + Raleway", headingFont: "Rokkitt", bodyFont: "Raleway", headingCss: serifFont("Rokkitt"), bodyCss: font("Raleway"), mood: "slab, elegant, distinctive", industries: ["education", "professional", "local service", "real estate"], keywords: ["education", "professional", "service", "real estate", "local"], sourceNote: "Article pairing #20" },
  { id: "poiret-didact", label: "Poiret One + Didact Gothic", headingFont: "Poiret One", bodyFont: "Didact Gothic", headingCss: font("Poiret One"), bodyCss: font("Didact Gothic"), mood: "art deco, delicate, stylish", industries: ["salon", "spa", "fashion", "interior"], keywords: ["salon", "spa", "fashion", "interior", "design", "beauty"], sourceNote: "Article pairing #21" },
  { id: "bangers-playfair", label: "Bangers + Playfair Display", headingFont: "Bangers", bodyFont: "Playfair Display", headingCss: font("Bangers"), bodyCss: serifFont("Playfair Display"), mood: "comic, dramatic, expressive", industries: ["entertainment", "kids", "event", "creative"], keywords: ["comic", "kids", "event", "entertainment", "creative", "party"], sourceNote: "Article pairing #22" },
  { id: "ultra-slabo", label: "Ultra + Slabo", headingFont: "Ultra", bodyFont: "Slabo 13px", headingCss: serifFont("Ultra"), bodyCss: serifFont("Slabo 13px"), mood: "bold slab, editorial, classic", industries: ["restaurant", "retail", "local service", "bar"], keywords: ["restaurant", "bar", "retail", "store", "local"], sourceNote: "Article pairing #23" },
  { id: "francois-karla", label: "Francois One + Karla", headingFont: "Francois One", bodyFont: "Karla", headingCss: font("Francois One"), bodyCss: font("Karla"), mood: "sharp, simple, versatile", industries: ["cleaning", "clinic", "service", "contractor"], keywords: ["cleaning", "clinic", "pool", "service", "contractor", "repair"], sourceNote: "Article pairing #24" },
  { id: "fugaz-lato", label: "Fugaz One + Lato", headingFont: "Fugaz One", bodyFont: "Lato", headingCss: font("Fugaz One"), bodyCss: font("Lato"), mood: "dynamic, warm, sporty", industries: ["fitness", "auto", "restaurant", "events"], keywords: ["fitness", "gym", "auto", "restaurant", "event", "sports"], sourceNote: "Article pairing #25" },
  { id: "bevan-pontano", label: "Bevan + Pontano Sans", headingFont: "Bevan", bodyFont: "Pontano Sans", headingCss: serifFont("Bevan"), bodyCss: font("Pontano Sans"), mood: "solid, vintage, readable", industries: ["contractor", "retail", "restaurant", "local service"], keywords: ["contractor", "retail", "restaurant", "service", "local"], sourceNote: "Article pairing #26" },
  { id: "nixie-prompt", label: "Nixie One + Prompt", headingFont: "Nixie One", bodyFont: "Prompt", headingCss: serifFont("Nixie One"), bodyCss: font("Prompt"), mood: "light, modern, composed", industries: ["clinic", "spa", "architecture", "design"], keywords: ["clinic", "spa", "architecture", "design", "wellness"], sourceNote: "Article pairing #27" },
  { id: "sacramento-barlow", label: "Sacramento + Barlow", headingFont: "Sacramento", bodyFont: "Barlow", headingCss: scriptFont("Sacramento"), bodyCss: font("Barlow"), mood: "graceful, warm, personal", industries: ["beauty", "wedding", "florist", "boutique"], keywords: ["beauty", "wedding", "florist", "boutique", "salon", "spa"], sourceNote: "Article pairing #28" },
  { id: "sansita-overpass", label: "Sansita + Overpass", headingFont: "Sansita", bodyFont: "Overpass", headingCss: font("Sansita"), bodyCss: font("Overpass"), mood: "playful authority, road-ready, clear", industries: ["auto", "transport", "service", "restaurant"], keywords: ["auto", "transport", "truck", "service", "restaurant"], sourceNote: "Article pairing #29" },
  { id: "vollkorn-pt-sans", label: "Vollkorn SC + PT Sans", headingFont: "Vollkorn SC", bodyFont: "PT Sans", headingCss: serifFont("Vollkorn SC"), bodyCss: font("PT Sans"), mood: "robust, formal, readable", industries: ["legal", "finance", "education", "government"], keywords: ["law", "legal", "finance", "school", "education", "government"], sourceNote: "Article pairing #30" },
];

const fallbackPairing = fontPairings[0];

export function getFontPairing(id?: string) {
  return fontPairings.find((pairing) => pairing.id === id) || fallbackPairing;
}

export function inferFontPairingFromText(text: string) {
  const haystack = text.toLowerCase();
  const matched = fontPairings.find((pairing) =>
    pairing.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  );
  return (matched || fallbackPairing).id;
}

export function fontPairingsForText(text: string, limit = 5) {
  const haystack = text.toLowerCase();
  const matches = fontPairings.filter((pairing) =>
    pairing.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())) ||
    pairing.industries.some((industry) => haystack.includes(industry.toLowerCase()))
  );
  const merged = [...matches, fallbackPairing, getFontPairing("oswald-nunito"), getFontPairing("merriweather-lora"), getFontPairing("francois-karla")]
    .filter((pairing, index, array) => array.findIndex((item) => item.id === pairing.id) === index);
  return merged.slice(0, limit);
}

export function googleFontImportUrl(pairings: FontPairing[]) {
  const families = Array.from(new Set(pairings.flatMap((pairing) => [pairing.headingFont, pairing.bodyFont])))
    .filter(Boolean)
    .filter((name) => !["Inter", "Arial", "sans-serif", "serif"].includes(name));
  if (families.length === 0) return "";
  const query = families.map((name) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
