import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function PublicViewer() {
  const { businessId } = useParams();
  const [siteData, setSiteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    if (businessId) {
      localStorage.setItem("savedBusinessId", businessId);
      
      // Ping view
      fetch(`/api/leads/\${businessId}/ping`, { method: "POST" }).catch(() => {});

      // Fetch JSON metadata
      fetch(`/api/sites/\${businessId}`)
        .then(r => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then(data => {
          setSiteData(data);
          if (data.pages && data.pages.length > 0) {
            setActiveTab(data.pages[0].pageId);
          }
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [businessId]);

  const handleDownloadZip = async () => {
    // Compile current rendered HTML structure into a ZIP
    const zip = new JSZip();
    const htmlContent = document.documentElement.outerHTML;
    
    // In a real app we'd fetch images and adjust paths. Here we just bundle a static HTML file.
    let cleanHtml = `<!DOCTYPE html>\n<html lang="id">\n` + htmlContent + `\n</html>`;
    cleanHtml = cleanHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""); // Remove injected vite scripts
    
    zip.file("index.html", cleanHtml);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${businessId}-website.zip`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading site...</div>;
  }

  if (error || !siteData) {
    return <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-2">404 - Not Found</h1>
      <p>Situs untuk "{businessId}" tidak ditemukan.</p>
    </div>;
  }

  const { meta, design, global: globalConfig, navigation, pages } = siteData;
  const colors = design.themeVariables.colors;
  const isPremium = false; // Demo flag

  // Custom styling injected
  const customStyles = {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-text": colors.textMain,
    "--color-bg": colors.background,
    fontFamily: design.typography.bodyFont,
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
  } as React.CSSProperties;

  return (
    <div style={customStyles} className="min-h-screen flex flex-col" id="rendered-site">
      {/* NAVBAR */}
      <header style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
        <div className="font-bold text-xl tracking-tight">{meta.businessName}</div>
        <nav className="hidden md:flex gap-6">
          {navigation.headerMenu.map((menu: any, idx: number) => {
            const pageId = menu.href.replace("#", "");
            return (
              <button 
                key={idx} 
                onClick={() => setActiveTab(pageId)}
                className={`text-sm font-medium hover:opacity-80 transition \${activeTab === pageId ? 'border-b-2 border-white' : ''}`}
              >
                {menu.label}
              </button>
            )
          })}
        </nav>
        <a 
          href={globalConfig.header.ctaButton.href} 
          style={{ backgroundColor: colors.accent }}
          className="px-5 py-2 rounded-lg text-white font-medium hover:opacity-90 transition text-sm"
        >
          {globalConfig.header.ctaButton.text}
        </a>
      </header>

      {/* DYNAMIC CONTENT */}
      <main className="flex-1">
        {pages.map((page: any) => (
          <div key={page.pageId} className={`transition-opacity duration-300 \${activeTab === page.pageId ? 'block animate-in fade-in zoom-in-95' : 'hidden'}`}>
            {page.sections.map((section: any) => {
              if (section.type === "hero") {
                return (
                  <section key={section.id} className="py-24 px-6 text-center max-w-4xl mx-auto">
                    <h1 className="text-5xl font-bold mb-6 tracking-tight leading-tight" style={{ fontFamily: design.typography.headingFont }}>
                      {section.content.headline}
                    </h1>
                    <p className="text-xl mb-10 opacity-80 max-w-2xl mx-auto">
                      {section.content.subheadline}
                    </p>
                    <div className="flex gap-4 justify-center">
                      {section.content.buttons.map((btn: any, i: number) => (
                        <button 
                          key={i}
                          style={{ 
                            backgroundColor: btn.style === 'primary' ? colors.accent : 'transparent',
                            color: btn.style === 'primary' ? '#fff' : colors.textMain,
                            border: `2px solid \${btn.style === 'primary' ? colors.accent : colors.textMain}`
                          }}
                          className="px-8 py-3 rounded-xl font-medium transition hover:scale-105"
                          onClick={() => {
                            if (btn.href.startsWith("#")) setActiveTab(btn.href.replace("#", ""));
                          }}
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              }
              if (section.type === "features") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid md:grid-cols-3 gap-8">
                        {section.content.items.map((item: any, i: number) => (
                          <div key={i} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition">
                            <div className="text-2xl mb-4 opacity-50">✦</div>
                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                            <p className="opacity-70">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }
              // Add more conditions for textImageBlock, teamGrid, gallery etc.
              return <div key={section.id} className="py-20 text-center opacity-50">[Section: {section.type}]</div>;
            })}
          </div>
        ))}
      </main>

      {/* FOOTER */}
      <footer style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-12 px-6 text-center opacity-90 text-sm">
        <p>{globalConfig.footer.text}</p>
      </footer>

      {/* PROSPECT CONTROL PANEL (Hidden in downloaded version) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-4 rounded-full shadow-2xl border border-gray-200 flex items-center gap-4 z-[100] hide-in-export">
        <span className="font-semibold text-gray-900 mr-2 text-sm">Pratinjau Khusus</span>
        <button 
          onClick={handleDownloadZip}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-full transition"
        >
          Unduh Kode Html (Gratis)
        </button>
        <button 
          onClick={() => {
            const link = import.meta.env.VITE_PAYMENT_LINK_BASIC || "https://paypal.me/yourusername/120";
            if(confirm("Layanan hosting & managed setup $120/tahun. Lanjutkan ke pembayaran?")) {
              window.open(link, "_blank");
            }
          }}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full transition"
        >
          Terima Beres ($120/thn)
        </button>
      </div>

      <style>{ `
        @media print { .hide-in-export { display: none !important; } }
      `}</style>
    </div>
  );
}
