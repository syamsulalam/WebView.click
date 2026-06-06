import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Camera, Check, Copy, Download, Loader2, RefreshCw, X } from "lucide-react";
import { toCanvas } from "html-to-image";
import { saveAs } from "file-saver";
import HoverTooltip from "./HoverTooltip";

export type ScreenshotMetadata = {
  exists: boolean;
  publicUrl: string;
  key: string;
  bytes: number;
  uploadedAt: string;
  contentType: string;
};

type FullPageScreenshotButtonProps = {
  businessId: string;
  mode?: "floating" | "icon";
  captureSource?: "current-page" | "iframe";
  tooltip?: string;
  onMetadataChange?: (metadata: ScreenshotMetadata | null) => void;
};

function emptyMetadata(): ScreenshotMetadata {
  return { exists: false, publicUrl: "", key: "", bytes: 0, uploadedAt: "", contentType: "" };
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "website";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
}

function blobFromCanvas(canvas: HTMLCanvasElement, quality = 0.78) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Browser could not encode this screenshot as WebP."));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

async function waitForImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    if (typeof image.decode === "function") return image.decode().catch(() => undefined);
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
}

async function captureElementWebp(node: HTMLElement) {
  const ownerDocument = node.ownerDocument || document;
  const ownerWindow = ownerDocument.defaultView || window;
  node.setAttribute("data-wv-capturing-screenshot", "true");
  const previousScrollTop = ownerWindow.scrollY;
  try {
    ownerWindow.scrollTo({ top: 0, left: 0, behavior: "auto" });
    await ownerDocument.fonts?.ready?.catch(() => undefined);
    await waitForImages(node);
    await nextFrame();
    await nextFrame();

    const rect = node.getBoundingClientRect();
    const width = Math.ceil(Math.max(node.scrollWidth, rect.width, ownerDocument.documentElement.clientWidth));
    const height = Math.ceil(Math.max(node.scrollHeight, rect.height));
    if (!width || !height) throw new Error("Generated site canvas is empty.");

    const maxCanvasSide = 15000;
    const pixelRatio = Math.max(1, Math.min(2, maxCanvasSide / Math.max(width, height)));
    const canvas = await toCanvas(node, {
      cacheBust: true,
      width,
      height,
      canvasWidth: Math.round(width * pixelRatio),
      canvasHeight: Math.round(height * pixelRatio),
      pixelRatio,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: "none",
        transform: "none",
        overflow: "visible",
      },
      filter: (element) => !(element instanceof HTMLElement && element.closest("[data-export-remove='true'], [data-wv-tool-ui]")),
    });

    return blobFromCanvas(canvas);
  } finally {
    node.removeAttribute("data-wv-capturing-screenshot");
    ownerWindow.scrollTo({ top: previousScrollTop, left: 0, behavior: "auto" });
  }
}

async function captureCurrentPageWebp() {
  const node = document.querySelector<HTMLElement>("[data-wv-site-canvas]");
  if (!node) throw new Error("Generated site canvas was not found.");
  return captureElementWebp(node);
}

async function waitForIframeCanvas(iframe: HTMLIFrameElement) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    const doc = iframe.contentDocument;
    const node = doc?.querySelector<HTMLElement>("[data-wv-site-canvas]");
    if (node && node.scrollHeight > 200) {
      await sleep(1200);
      return node;
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for the preview page to render for screenshot.");
}

async function waitForIframeRef(ref: RefObject<HTMLIFrameElement | null>) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 3000) {
    if (ref.current) return ref.current;
    await sleep(50);
  }
  throw new Error("Screenshot preview frame could not be created.");
}

async function fetchScreenshotMetadata(businessId: string) {
  const response = await fetch(`/api/sites/${encodeURIComponent(businessId)}/screenshot`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Screenshot metadata failed: HTTP ${response.status}`);
  return { ...emptyMetadata(), ...data } as ScreenshotMetadata;
}

async function uploadScreenshot(businessId: string, blob: Blob) {
  const response = await fetch(`/api/sites/${encodeURIComponent(businessId)}/screenshot`, {
    method: "POST",
    headers: { "content-type": "image/webp" },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Screenshot upload failed: HTTP ${response.status}`);
  return { ...emptyMetadata(), ...data, exists: true } as ScreenshotMetadata;
}

export default function FullPageScreenshotButton({
  businessId,
  mode = "floating",
  captureSource = "current-page",
  tooltip = "Create, download, retake, or copy the R2 URL for this full-page WebP screenshot.",
  onMetadataChange,
}: FullPageScreenshotButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [metadata, setMetadata] = useState<ScreenshotMetadata | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [frameMounted, setFrameMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const updateMetadata = (next: ScreenshotMetadata | null) => {
    setMetadata(next);
    onMetadataChange?.(next);
  };

  const loadMetadata = async () => {
    setStatus("loading");
    try {
      const next = await fetchScreenshotMetadata(businessId);
      updateMetadata(next);
      setStatus("idle");
      return next;
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Screenshot metadata failed.");
      return null;
    }
  };

  useEffect(() => {
    if (mode === "icon") loadMetadata();
  }, [businessId, mode]);

  const captureWebp = async () => {
    if (captureSource === "current-page") return captureCurrentPageWebp();
    const iframe = await waitForIframeRef(iframeRef);
    iframe.src = `/${encodeURIComponent(businessId)}?ownerPreview=1&screenshot=1&ts=${Date.now()}`;
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });
    const node = await waitForIframeCanvas(iframe);
    return captureElementWebp(node);
  };

  const createOrRetake = async () => {
    setMenuOpen(false);
    setStatus("saving");
    setMessage("");
    try {
      if (captureSource === "iframe") {
        setFrameMounted(true);
        await nextFrame();
      }
      const blob = await captureWebp();
      const next = await uploadScreenshot(businessId, blob);
      updateMetadata(next);
      saveAs(blob, `${sanitizeFilename(businessId)}-full-page.webp`);
      setStatus("saved");
      setMessage(`Screenshot saved to R2 and downloaded. ${formatBytes(blob.size)}`);
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Screenshot failed.");
    } finally {
      if (captureSource === "iframe") setFrameMounted(false);
    }
  };

  const handlePrimaryClick = async () => {
    const next = metadata || await loadMetadata();
    if (next?.exists) {
      setMenuOpen((value) => !value);
      return;
    }
    await createOrRetake();
  };

  const copyUrl = async () => {
    if (!metadata?.publicUrl) return;
    await navigator.clipboard.writeText(metadata.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const downloadExisting = () => {
    if (!metadata?.publicUrl) return;
    saveAs(metadata.publicUrl, `${sanitizeFilename(businessId)}-full-page.webp`);
  };

  const wrapperClass = mode === "floating"
    ? "hide-in-export fixed bottom-5 left-1/2 z-[230] flex -translate-x-1/2 flex-col items-center gap-2"
    : "relative inline-flex";
  const buttonClass = mode === "floating"
    ? "inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-900 shadow-2xl backdrop-blur transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
    : "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60";

  return (
    <div data-export-remove="true" data-wv-tool-ui="full-page-screenshot" className={wrapperClass}>
      {captureSource === "iframe" && frameMounted && (
        <iframe
          ref={iframeRef}
          title={`Screenshot preview ${businessId}`}
          className="pointer-events-none fixed left-[-200vw] top-0 h-[1200px] w-[1440px] opacity-0"
          aria-hidden="true"
        />
      )}
      {message && mode === "floating" && (
        <div className={`max-w-[min(28rem,calc(100vw-2rem))] rounded-xl border px-3 py-2 text-center text-xs font-medium shadow-xl backdrop-blur ${status === "failed" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-white/95 text-emerald-700"}`}>
          {message}
        </div>
      )}
      <HoverTooltip text={tooltip}>
        <button
          type="button"
          onClick={handlePrimaryClick}
          disabled={status === "saving" || status === "loading"}
          className={buttonClass}
          aria-label="Screenshot actions"
        >
          {status === "saving" || status === "loading" ? <Loader2 size={mode === "floating" ? 22 : 16} className="animate-spin" /> : status === "saved" ? <Check size={mode === "floating" ? 22 : 16} /> : <Camera size={mode === "floating" ? 22 : 16} />}
        </button>
      </HoverTooltip>
      {mode === "icon" && metadata?.exists && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
      )}
      {menuOpen && metadata?.exists && (
        <div className={`${mode === "floating" ? "absolute bottom-16 left-1/2 w-72 -translate-x-1/2" : "absolute right-0 top-11 w-72"} z-[100002] rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 shadow-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">R2 screenshot exists</p>
              <p className="mt-1">{formatBytes(metadata.bytes)}{metadata.uploadedAt ? ` · ${new Date(metadata.uploadedAt).toLocaleDateString()}` : ""}</p>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Close screenshot menu">
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={copyUrl} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Copy URL
            </button>
            <button type="button" onClick={downloadExisting} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={14} />
              Download
            </button>
            <button type="button" onClick={createOrRetake} className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 font-semibold text-indigo-700 hover:bg-indigo-100">
              <RefreshCw size={14} />
              Retake and overwrite
            </button>
          </div>
          {metadata.publicUrl && <p className="mt-3 truncate rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-500">{metadata.publicUrl}</p>}
        </div>
      )}
      {message && mode === "icon" && status === "failed" && (
        <div className="absolute right-0 top-11 z-[100002] w-72 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 shadow-2xl">
          {message}
        </div>
      )}
    </div>
  );
}
