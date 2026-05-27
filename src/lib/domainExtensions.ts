export type DomainExtension = {
  tld: string;
  category: string;
  note?: string;
};

export const domainExtensions: DomainExtension[] = [
  { tld: ".com", category: "Classic", note: "Best default for US local businesses." },
  { tld: ".org", category: "Classic" },
  { tld: ".net", category: "Classic" },
  { tld: ".cc", category: "Classic" },
  { tld: ".name", category: "Personal" },
  { tld: ".business", category: "Business" },
  { tld: ".contact", category: "Business" },
  { tld: ".work", category: "Business" },
  { tld: ".trade", category: "Business" },
  { tld: ".one", category: "Modern" },
  { tld: ".page", category: "Modern" },
  { tld: ".click", category: "Modern" },
  { tld: ".link", category: "Modern" },
  { tld: ".fyi", category: "Modern" },
  { tld: ".channel", category: "Modern" },
  { tld: ".day", category: "Modern" },
  { tld: ".review", category: "Discovery" },
  { tld: ".top", category: "Budget" },
  { tld: ".vip", category: "Budget" },
  { tld: ".party", category: "Budget" },
  { tld: ".date", category: "Budget" },
  { tld: ".download", category: "Budget" },
  { tld: ".win", category: "Budget" },
  { tld: ".loan", category: "Budget" },
  { tld: ".men", category: "Budget" },
  { tld: ".stream", category: "Media" },
  { tld: ".zip", category: "Utility" },
];

export function normalizeDomainLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(".")[0]
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function buildDomain(label: string, tld: string) {
  const cleanLabel = normalizeDomainLabel(label);
  const cleanTld = tld.startsWith(".") ? tld : `.${tld}`;
  return cleanLabel ? `${cleanLabel}${cleanTld}` : cleanTld.replace(/^\./, "");
}
