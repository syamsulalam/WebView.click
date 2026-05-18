export async function readApiJson<T = any>(response: Response, fallbackLabel = "Request"): Promise<T> {
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 240);
      throw new Error(`${fallbackLabel} returned a non-JSON response (HTTP ${response.status})${snippet ? `: ${snippet}` : ""}`);
    }
  }

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `${fallbackLabel} failed with HTTP ${response.status}`);
  }

  return data as T;
}
