import { useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { toCanvas } from "html-to-image";
import { saveAs } from "file-saver";
import HoverTooltip from "./HoverTooltip";

type FullPageScreenshotButtonProps = {
  businessId: string;
};

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "website";
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

async function captureFullPageWebp() {
  const node = document.querySelector<HTMLElement>("[data-wv-site-canvas]");
  if (!node) throw new Error("Generated site canvas was not found.");

  const width = Math.ceil(Math.max(node.scrollWidth, node.getBoundingClientRect().width));
  const height = Math.ceil(Math.max(node.scrollHeight, node.getBoundingClientRect().height));
  if (!width || !height) throw new Error("Generated site canvas is empty.");

  const maxCanvasSide = 15000;
  const pixelRatio = Math.max(1, Math.min(2, maxCanvasSide / Math.max(width, height)));
  const canvas = await toCanvas(node, {
    cacheBust: true,
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
    },
    filter: (element) => !(element instanceof HTMLElement && element.closest("[data-export-remove='true'], [data-wv-tool-ui]")),
  });

  return blobFromCanvas(canvas);
}

export default function FullPageScreenshotButton({ businessId }: FullPageScreenshotButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState("");

  const handleClick = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const blob = await captureFullPageWebp();
      const response = await fetch(`/api/sites/${encodeURIComponent(businessId)}/screenshot`, {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Screenshot upload failed: HTTP ${response.status}`);
      saveAs(blob, `${sanitizeFilename(businessId)}-full-page.webp`);
      setStatus("saved");
      setMessage(data?.publicUrl ? `Saved to R2 and downloaded. ${data.publicUrl}` : "Saved to R2 and downloaded.");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Screenshot failed.");
    }
  };

  return (
    <div data-export-remove="true" data-wv-tool-ui="full-page-screenshot" className="hide-in-export fixed bottom-5 left-1/2 z-[230] flex -translate-x-1/2 flex-col items-center gap-2">
      {message && (
        <div className={`max-w-[min(28rem,calc(100vw-2rem))] rounded-xl border px-3 py-2 text-center text-xs font-medium shadow-xl backdrop-blur ${status === "failed" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-white/95 text-emerald-700"}`}>
          {message}
        </div>
      )}
      <HoverTooltip text="Download a full-page WebP screenshot and save a compressed copy to R2 for reachout.">
        <button
          type="button"
          onClick={handleClick}
          disabled={status === "saving"}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-900 shadow-2xl backdrop-blur transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          aria-label="Download full-page WebP screenshot"
        >
          {status === "saving" ? <Loader2 size={22} className="animate-spin" /> : status === "saved" ? <Check size={22} /> : <Camera size={22} />}
        </button>
      </HoverTooltip>
    </div>
  );
}
