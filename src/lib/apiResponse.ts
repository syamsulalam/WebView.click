export async function readApiJson<T = any>(response: Response, fallbackLabel = "Request", requestPath = ""): Promise<T> {
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(describeNonJsonApiResponse(response, text, fallbackLabel, requestPath));
    }
  }

  if (!response.ok || data?.error) {
    throw new Error(`${data?.error || `${fallbackLabel} failed with HTTP ${response.status}`}${apiResponseContext(response, requestPath)}`);
  }

  return data as T;
}

function apiResponsePath(response: Response, requestPath = "") {
  if (requestPath) return requestPath;
  if (!response.url) return "";
  try {
    const url = new URL(response.url);
    return `${url.pathname}${url.search}`;
  } catch {
    return response.url;
  }
}

function apiResponseContext(response: Response, requestPath = "") {
  const path = apiResponsePath(response, requestPath);
  return `${path ? ` Request path: ${path}.` : ""} Status: HTTP ${response.status}.`;
}

export function describeNonJsonApiResponse(response: Response, text: string, fallbackLabel = "Request", requestPath = "") {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 240);
  const lower = snippet.toLowerCase();
  const looksLikeCloudflareHtml = lower.includes("cloudflare") || lower.includes("<!doctype html") || lower.includes("<html");
  const context = apiResponseContext(response, requestPath);
  if (looksLikeCloudflareHtml && response.status === 524) {
    return `${fallbackLabel} returned Cloudflare timeout HTML instead of JSON (HTTP 524).${context} Cloudflare connected to the Pages Function but did not receive a response before the proxy timeout, usually because this step waited too long on a slow provider call. The job progress saved before this request is still usable; resume the same chunk or switch provider/model if it repeats. Snippet: ${snippet}`;
  }
  if (looksLikeCloudflareHtml && response.status >= 500) {
    return `${fallbackLabel} returned Cloudflare/HTML instead of JSON (HTTP ${response.status}).${context} This usually means the Pages Function did not return normally, the deployment is failing at the edge, or Cloudflare is temporarily unavailable. Check Cloudflare Pages deployment logs, Functions logs, and Cloudflare Status. Snippet: ${snippet}`;
  }
  return `${fallbackLabel} returned a non-JSON response (HTTP ${response.status}).${context}${snippet ? ` Snippet: ${snippet}` : ""}`;
}
