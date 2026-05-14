import { useState } from "react";

type SiteRendererProps = {
  siteData: any;
  publicLinks?: { basic: string; premium: string };
  businessId?: string;
  showProspectPanel?: boolean;
  onDownloadZip?: () => void;
};

export default function SiteRenderer({
  siteData,
  publicLinks = { basic: "", premium: "" },
  businessId = "demo",
  showProspectPanel = true,
  onDownloadZip,
}: SiteRendererProps) {
  const initialPage = siteData?.pages?.[0]?.pageId || "home";
  const [activeTab, setActiveTab] = useState(initialPage);

  const { meta, design, global: globalConfig, navigation, pages } = siteData;
  const colors = design.themeVariables.colors;

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
      <header style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
        <div className="font-bold text-xl tracking-tight">{meta.businessName}</div>
        <nav className="hidden md:flex gap-6">
          {navigation.headerMenu.map((menu: any, idx: number) => {
            const pageId = menu.href.replace("#", "");
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(pageId)}
                className={`text-sm font-medium hover:opacity-80 transition ${activeTab === pageId ? "border-b-2 border-white" : ""}`}
              >
                {menu.label}
              </button>
            );
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

      <main className="flex-1">
        {pages.map((page: any) => (
          <div key={page.pageId} className={`transition-opacity duration-300 ${activeTab === page.pageId ? "block animate-in fade-in zoom-in-95" : "hidden"}`}>
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
                            backgroundColor: btn.style === "primary" ? colors.accent : "transparent",
                            color: btn.style === "primary" ? "#fff" : colors.textMain,
                            border: `2px solid ${btn.style === "primary" ? colors.accent : colors.textMain}`,
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
                            {item.iconSvg && (
                              <div className="w-10 h-10 mb-4 text-indigo-500" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                            )}
                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                            <p className="opacity-70">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "textImageBlock") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className={`max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center ${section.content.layout === "imageRight" ? "md:flex-row-reverse" : ""}`}>
                      <div className="flex-1">
                        <h2 className="text-3xl font-bold mb-6">{section.content.title}</h2>
                        <div className="opacity-80 prose max-w-none" dangerouslySetInnerHTML={{ __html: section.content.bodyHtml }} />
                      </div>
                      <div className="flex-1 w-full relative h-[400px] bg-gray-100 rounded-3xl overflow-hidden shadow-lg border border-gray-200">
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">{section.content.image}</div>
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "teamGrid") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {section.content.members.map((member: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-center pb-6">
                            <div className="h-48 bg-gray-200 mb-4 flex items-center justify-center text-xs text-gray-400">
                              {member.image}
                            </div>
                            <h3 className="text-lg font-semibold">{member.name}</h3>
                            <p className="text-sm opacity-60 font-medium">{member.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "gridCards") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-6xl mx-auto">
                      <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">{section.content.title}</h2>
                        <p className="opacity-70 max-w-2xl mx-auto">{section.content.description}</p>
                      </div>
                      <div className="grid md:grid-cols-3 gap-8">
                        {section.content.cards.map((card: any, i: number) => (
                          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                            <div className="h-48 bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                              {card.image}
                            </div>
                            <div className="p-6">
                              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                              <p className="opacity-70 mb-4">{card.description}</p>
                              {card.price && <p className="font-semibold text-lg" style={{ color: colors.accent }}>{card.price}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "imageGallery") {
                return (
                  <section key={section.id} className="py-20 px-6 bg-black/5">
                    <div className="max-w-6xl mx-auto">
                      <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {section.content.images.map((img: string, i: number) => (
                          <div key={i} className="h-64 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                            {img}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (section.type === "contactForm") {
                return (
                  <section key={section.id} className="py-20 px-6">
                    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                      <div style={{ backgroundColor: colors.primary, color: "#fff" }} className="p-10 md:w-2/5">
                        <h2 className="text-2xl font-bold mb-6">{section.content.title}</h2>
                        <div className="space-y-4 text-sm opacity-90">
                          <p><strong>Alamat:</strong><br />{section.content.address}</p>
                          <p><strong>Telepon:</strong><br />{section.content.phone}</p>
                          <p><strong>Email:</strong><br />{section.content.email}</p>
                          <div>
                            <strong>Jam Operasional:</strong>
                            <ul className="mt-1 space-y-1">
                              {section.content.openingHours.map((h: string, i: number) => <li key={i}>{h}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 md:w-3/5">
                        <h3 className="text-xl font-bold mb-6">{section.content.formConfig.heading}</h3>
                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); }}>
                          {section.content.formConfig.fields.map((f: any, i: number) => (
                            <div key={i}>
                              <label className="block text-sm font-medium opacity-80 mb-1">{f.label}</label>
                              {f.type === "textarea" ? (
                                <textarea required={f.required} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" rows={4}></textarea>
                              ) : (
                                <input required={f.required} type={f.type} className="w-full border border-gray-300 rounded-lg p-3 bg-transparent" />
                              )}
                            </div>
                          ))}
                          <button style={{ backgroundColor: colors.accent, color: "#fff" }} className="px-6 py-3 rounded-lg font-medium hover:opacity-90 transition pt-2">
                            {section.content.formConfig.buttonText}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              return <div key={section.id} className="py-20 text-center opacity-50">[Section: {section.type}]</div>;
            })}
          </div>
        ))}
      </main>

      <footer style={{ backgroundColor: colors.primary, color: "#fff" }} className="py-12 px-6 text-center opacity-90 text-sm">
        <p>{globalConfig.footer.text}</p>
      </footer>

      {showProspectPanel && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-4 rounded-full shadow-2xl border border-gray-200 flex items-center gap-4 z-[100] hide-in-export">
          <span className="font-semibold text-gray-900 mr-2 text-sm">Pratinjau Khusus</span>
          {onDownloadZip && (
            <button
              onClick={onDownloadZip}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-full transition"
            >
              Unduh Kode Html (Gratis)
            </button>
          )}
          <button
            onClick={() => {
              const link = publicLinks.basic;
              if (confirm("Layanan hosting & managed setup $120/tahun. Lanjutkan ke pembayaran?")) {
                window.open(link, "_blank");
              }
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full transition"
          >
            Terima Beres ($120/thn)
          </button>
        </div>
      )}

      <style>{`
        @media print { .hide-in-export { display: none !important; } }
      `}</style>
    </div>
  );
}
