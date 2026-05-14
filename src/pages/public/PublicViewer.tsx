import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import SiteRenderer from "../../components/SiteRenderer";

export default function PublicViewer() {
  const { businessId } = useParams();
  const [siteData, setSiteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [publicLinks, setPublicLinks] = useState({ basic: "", premium: "" });

  useEffect(() => {
    if (businessId) {
      localStorage.setItem("savedBusinessId", businessId);

      fetch(`/api/leads/${businessId}/ping`, { method: "POST" }).catch(() => {});

      fetch(`/api/public-settings`)
        .then(r => r.json())
        .then(data => {
          setPublicLinks({
            basic: data.PAYMENT_LINK_BASIC || "https://paypal.me/yourusername/120",
            premium: data.PAYMENT_LINK_PREMIUM || ""
          });
        })
        .catch(() => {});

      fetch(`/api/sites/${businessId}`)
        .then(r => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then(data => {
          setSiteData(data);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [businessId]);

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const htmlContent = document.documentElement.outerHTML;
    let cleanHtml = `<!DOCTYPE html>\n<html lang="id">\n${htmlContent}\n</html>`;
    cleanHtml = cleanHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    zip.file("index.html", cleanHtml);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${businessId}-website.zip`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading site...</div>;
  }

  if (error || !siteData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-2">404 - Not Found</h1>
        <p>Situs untuk "{businessId}" tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <SiteRenderer
      siteData={siteData}
      publicLinks={publicLinks}
      businessId={businessId}
      onDownloadZip={handleDownloadZip}
    />
  );
}
