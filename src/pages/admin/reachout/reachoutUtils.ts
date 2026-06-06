export const reachoutCampaign = "free_site_10000";
export const reachoutTarget = 10000;

export type ReachoutLead = {
  id: string;
  business_id: string;
  business_name: string;
  email?: string;
  phone?: string;
  niche?: string;
  status?: string;
  rating?: number;
  reviews?: number;
  address?: string;
  website_url?: string;
  view_count?: number;
  owner_view_count?: number;
  owner_last_viewed_at?: string | null;
  last_contacted?: string | null;
  download_count?: number;
  last_downloaded_at?: string | null;
  payment_status?: string;
};

export type OutreachBusinessSummary = {
  business_id: string;
  last_sent_at?: string | null;
  last_link_created_at?: string | null;
  last_owner_viewed_at?: string | null;
  sent_count?: number;
  link_created_count?: number;
  owner_view_count?: number;
};

export function validReachoutEmail(value: unknown) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^hello@example\.com$/i.test(email);
}

export function trackingTokenForLead(lead: Pick<ReachoutLead, "id" | "business_id">, channel = "email") {
  return [reachoutCampaign, channel, lead.business_id || lead.id].filter(Boolean).join(":");
}

export function trackedPreviewUrl(lead: ReachoutLead, channel = "email") {
  const businessId = lead.business_id || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://webview.click";
  const url = new URL(`/${encodeURIComponent(businessId)}`, origin);
  url.searchParams.set("owner", "1");
  url.searchParams.set("wv_channel", channel);
  url.searchParams.set("wv_source", "admin_reachout");
  url.searchParams.set("wv_campaign", reachoutCampaign);
  url.searchParams.set("wv_lead", lead.id);
  url.searchParams.set("wv_token", trackingTokenForLead(lead, channel));
  url.searchParams.set("utm_source", "webview_reachout");
  url.searchParams.set("utm_medium", channel);
  url.searchParams.set("utm_campaign", reachoutCampaign);
  return url.toString();
}

export function emailFirstTouch(lead: ReachoutLead) {
  return [
    `Subject: ${lead.business_name || lead.business_id}`,
    "",
    `hey, ${lead.business_name || "there"} is this your site?`,
    "",
    trackedPreviewUrl(lead, "email"),
    "",
    `If this is not useful, reply "no" and I will not follow up.`,
  ].join("\n");
}

export function formatDateTime(value: unknown) {
  const text = String(value || "");
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
