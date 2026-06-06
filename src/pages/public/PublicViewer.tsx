import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FullPageScreenshotButton from "../../components/FullPageScreenshotButton";
import SiteRenderer from "../../components/SiteRenderer";
import { downloadOwnerSiteZip } from "../../lib/exportSiteHtml";

const siteFetchRetryDelays = [700, 1600, 3200];

function ownerTrackingParamActive() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("owner") === "1" || params.get("review") === "owner" || params.get("claim") === "1")
    && params.get("ownerPreview") !== "1"
    && params.get("reviewPreview") !== "1";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchSiteWithRetry(businessId: string) {
  let lastError = "Site not found";
  for (let attempt = 0; attempt <= siteFetchRetryDelays.length; attempt += 1) {
    const response = await fetch(`/api/sites/${encodeURIComponent(businessId)}?preview=1&ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (response.ok) return response.json();

    const data = await response.json().catch(() => ({}));
    lastError = data?.error || `Preview request returned HTTP ${response.status}`;
    if (attempt < siteFetchRetryDelays.length) {
      await sleep(siteFetchRetryDelays[attempt]);
    }
  }
  throw new Error(lastError);
}

export default function PublicViewer() {
  const { businessId } = useParams();
  const [siteData, setSiteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [publicLinks, setPublicLinks] = useState({ basic: "", premium: "" });

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    localStorage.setItem("savedBusinessId", businessId);
    setLoading(true);
    setError(false);
    setErrorMessage("");
    setSiteData(null);

    if (ownerTrackingParamActive()) {
      fetch(`/api/leads/${encodeURIComponent(businessId)}/ping?owner=1`, { method: "POST" }).catch(() => {});
    }

    fetch(`/api/public-settings`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setPublicLinks({
            basic: data.PAYMENT_LINK_BASIC || "https://paypal.me/yourusername/120",
            premium: data.PAYMENT_LINK_PREMIUM || ""
          });
        }
      })
      .catch(() => {});

    fetchSiteWithRetry(businessId)
      .then(data => {
        if (cancelled) return;
        setSiteData(data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(true);
        setErrorMessage(loadError instanceof Error ? loadError.message : "Preview could not be loaded.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, reloadAttempt]);

  const handleDownloadZip = async (downloadSiteData = siteData) => {
    await downloadOwnerSiteZip(downloadSiteData, businessId || "website");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading site...</div>;
  }

  if (error || !siteData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Preview loading issue</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">This preview is still preparing</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            The demo for "{businessId}" was not available after a few automatic retries. It may still be syncing from the latest generation.
          </p>
          {errorMessage && <p className="mt-3 rounded-lg bg-slate-100 p-2 text-xs text-slate-500">{errorMessage}</p>}
          <button
            type="button"
            onClick={() => setReloadAttempt((attempt) => attempt + 1)}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteRenderer
        siteData={siteData}
        publicLinks={publicLinks}
        businessId={businessId}
        onDownloadZip={handleDownloadZip}
      />
      {businessId && <FullPageScreenshotButton businessId={businessId} />}
    </>
  );
}
