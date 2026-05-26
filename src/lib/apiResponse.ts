export async function readApiJson<T = any>(response: Response, fallbackLabel = "Request"): Promise<T> {
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(describeNonJsonApiResponse(response, text, fallbackLabel));
    }
  }

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `${fallbackLabel} failed with HTTP ${response.status}`);
  }

  return data as T;
}

export function describeNonJsonApiResponse(response: Response, text: string, fallbackLabel = "Request") {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 240);
  const lower = snippet.toLowerCase();
  const looksLikeCloudflareHtml = lower.includes("cloudflare") || lower.includes("<!doctype html") || lower.includes("<html");
  if (looksLikeCloudflareHtml && response.status === 524) {
    return `${fallbackLabel} returned Cloudflare timeout HTML instead of JSON (HTTP 524). Cloudflare connected to the Pages Function but did not receive a response before the proxy timeout, usually because this step waited too long on a slow provider call. The job progress saved before this request is still usable; resume the same chunk or switch provider/model if it repeats. Snippet: ${snippet}`;
  }
  if (looksLikeCloudflareHtml && response.status >= 500) {
    return `${fallbackLabel} returned Cloudflare/HTML instead of JSON (HTTP ${response.status}). This usually means the Pages Function did not return normally, the deployment is failing at the edge, or Cloudflare is temporarily unavailable. Check Cloudflare Pages deployment logs, Functions logs, and Cloudflare Status. Snippet: ${snippet}`;
  }
  return `${fallbackLabel} returned a non-JSON response (HTTP ${response.status})${snippet ? `: ${snippet}` : ""}`;
}
