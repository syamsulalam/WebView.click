import { createClerkClient } from "@clerk/backend";

type ClerkBindings = {
  CLERK_SECRET_KEY?: string;
  VITE_CLERK_PUBLISHABLE_KEY?: string;
};

const origins = ["https://webview.click", "https://webview-click.pages.dev"];

export function isPublicApiRequest(method: string, segments: string[], query: URLSearchParams): boolean {
  const [group, id, action] = segments;
  const leaf = segments.length === 1;
  const pair = segments.length === 2;
  if (method === "GET") {
    if (!group || (leaf && ["public-settings", "schema"].includes(group))) return true;
    if (!pair || !/^[A-Za-z0-9_-]+$/.test(id)) return false;
    return group === "sites" ||
      (group === "audits" && !query.has("snapshot")) ||
      (group === "places" && id === "photo") ||
      (group === "domains" && id === "check");
  }
  if (method !== "POST") return false;
  if (pair) {
    return (group === "payments" && ["checkout", "paypal-webhook", "paypal-capture-order", "paypal-subscription-approved"].includes(id)) ||
      (group === "domains" && id === "quote");
  }
  return segments.length === 3 && /^[A-Za-z0-9_-]+$/.test(id) &&
    ((group === "leads" && action === "ping") || (group === "sites" && action === "downloaded"));
}

export async function authenticateAdmin(request: Request, env: ClerkBindings): Promise<string | 401 | 403 | 503> {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if ((origin && !origins.includes(origin)) || (site && site !== "same-origin" && site !== "none")) return 403;
  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) return 503;
  // Let Clerk handle cookie and bearer verification, including signature and expiry checks.
  try {
    const clerk = createClerkClient({ secretKey, publishableKey });
    const state = await clerk.authenticateRequest(request, { authorizedParties: origins });
    const auth = state.toAuth();
    if (!auth?.userId) return 401;
    const user = await clerk.users.getUser(auth.userId);
    return !user.banned && !user.locked && user.publicMetadata.role === "admin" ? user.id : 403;
  } catch {
    return 503;
  }
}
