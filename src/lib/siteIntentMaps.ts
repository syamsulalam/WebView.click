// DOM-free design-intent → render decisions (PRD.md A1: every generated intent
// field must branch rendering). Tested in tests/siteIntentMaps.test.ts.

export function sectionRhythmPadClass(rhythm: string): string {
  switch (rhythm) {
    case "compressed-urgent":
      return "py-10 px-4";
    case "measured-authority":
      return "py-16 px-6";
    case "soft-premium":
    case "spacious-premium":
      return "py-24 md:py-32 px-6";
    default:
      // editorial-warm, proof-forward, balanced-local, and unknown values.
      return "py-20 px-6";
  }
}

export function detailLayoutGroup(layout: string): "rail" | "editorial" | "standard" {
  if (layout === "contact-rail" || layout === "booking-detail") return "rail";
  if (layout === "authority-detail" || layout === "consultation-detail" || layout === "menu-detail") return "editorial";
  return "standard";
}

export function motionLevelClass(level: string): string {
  if (level === "none") return "wv-motion-none";
  if (level === "subtle") return "wv-motion-subtle";
  return "";
}
