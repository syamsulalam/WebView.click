# WebView.click Codebase Reference

Terakhir diperbarui: 15 Mei 2026.

Dokumen ini menjelaskan isi, fungsi, dan logic utama tiap laman/komponen agar debugging berikutnya tidak mulai dari nol.

## Routing

File: `src/App.tsx`

Routes utama:
- `/` -> `HubPage`
- `/demo` -> `DemoSite`
- `/admin` -> `AdminLayout` + `AdminDashboard`
- `/admin/leads` -> `AdminLeads`
- `/admin/schema` -> `AdminSchema`
- `/admin/settings` -> `AdminSettings`
- `/:businessId` -> `PublicViewer`

## Components

### `src/components/SiteRenderer.tsx`

Fungsi:
- Renderer bersama untuk preview public dan demo JSON sample.
- Mengubah struktur JSON website menjadi UI halaman lengkap.

Props penting:
- `siteData`: JSON website yang akan dirender.
- `publicLinks`: payment links untuk panel prospek.
- `businessId`: slug untuk download filename/metadata.
- `showProspectPanel`: menampilkan atau menyembunyikan panel CTA prospek.
- `onDownloadZip`: callback download HTML static.

Logic penting:
- `normalizeSiteData()` menerima variasi schema lama/baru, termasuk `design.themeVariables.typography` dan `design.typography`.
- Field penting yang hilang diberi fallback agar preview tidak blank.
- State `activeTab` dipakai untuk navigasi antar page dari `navigation.headerMenu`.
- Header logo/title bisa diklik untuk kembali ke tab home.
- Navbar dan CTA memakai icon lucide.
- Navbar product/service submenu memakai hover persistence agar dropdown tidak langsung hilang saat cursor bergerak ke child menu.
- Pergantian tab menjalankan scroll-to-top.
- Section renderer mendukung `hero`, `trustBar`, `features`, `offers`, `reviews`, `hoursLocation`, `faq`, `textImageBlock`, `teamGrid`, `gridCards`, `imageGallery`, dan `contactForm`.
- Renderer membaca schema baru: `brand`, `businessProfile`, `trust`, `offers`, `capabilities`, `location`, `hours`, dan `conversion`.
- Renderer membaca `design.stylePreset` untuk niche style modifier. Registry dan CSS preset ada di `src/lib/siteStylePresets.ts`.
- Gambar dirender sebagai `<img>` jika URL usable (`http`, `/`, atau `data:`); filename placeholder tetap ditampilkan sebagai fallback supaya preview tidak blank.
- Untuk gambar Google Places, renderer menampilkan attribution overlay dari `brand.photoCaption` dan `brand.photoAttributions`.
- `conversion.stickyMobileCta` menampilkan CTA sticky di mobile.
- Footer dirender lebih lengkap: brand/about, sosial, halaman, highlights/offers, kontak, alamat, dan jam operasional jika tersedia.
- Footer highlights/offers/products/services menjadi link tab jika item punya `detailPageId` atau `href`.
- Nomor telepon dirender sebagai `tel:` link dan email sebagai `mailto:` link.
- Contact form membuat `mailto:` URL berisi nama, email, pesan, dan semua field form yang diisi.
- Visitor action panel untuk download/setup dirender lewat shared component `WebsiteActionPanel`, bukan logic lokal di renderer.
- Fallback section unknown tampil sebagai label `[Section: type]`, supaya schema baru tidak membuat halaman blank.

Risiko debug:
- Jika UI demo/public berbeda dari ekspektasi, cek mapping section di file ini dulu sebelum mengubah `PublicViewer`.
- Jika menambah `section.type` baru di JSON, tambahkan renderer di file ini dan update dokumen ini.

### `src/components/AdminLayout.tsx`

Fungsi:
- Shell admin dengan sidebar icon navigation.
- Mengamankan halaman admin via Clerk.
- Menyediakan dev bypass jika publishable key tidak tersedia atau live key dipakai di host dev.

Logic penting:
- `NavContent` menampilkan link Dashboard, CRM Leads, JSON Schema Info, dan Settings.
- `ClerkSecureLayout` hanya mengizinkan user dengan `publicMetadata.role === "admin"`.
- Jika role belum admin, halaman menampilkan instruksi update metadata Clerk.

Risiko debug:
- Jika admin terkunci, cek `VITE_CLERK_PUBLISHABLE_KEY` dan metadata user di Clerk.
- `isDevBypass` hanya fallback untuk dev/AI Studio, bukan mode auth production ideal.

### `src/components/WebsiteActionPanel.tsx`

Fungsi:
- Shared visitor action panel untuk `/demo` dan public preview `/:businessId`.
- Menangani download free, domain selection, domain availability/ownership pre-check, dan checkout setup `$197/year`.

Props penting:
- `siteData`: dipakai untuk business name/business ID default.
- `businessId`: fallback ID checkout.
- `variant`: `demo` atau `public` untuk positioning/label kecil.
- `onDownloadZip`: callback download zip, tersedia di demo dan public preview.

Logic penting:
- Domain extension list berasal dari `src/lib/domainExtensions.ts`.
- Domain availability memakai `GET /api/domains/check?domain=...`.
- Checkout memakai `POST /api/payments/checkout`.
- Checkout modal memakai flow bertahap: pilih domain baru atau domain milik sendiri, cek domain, lalu baru munculkan email untuk setup updates.
- Domain baru memakai compact inline input: label domain, extension selector berkategori, dan tombol check dalam satu baris. Filter extension berada di panel collapsible supaya form tidak terlalu tinggi.
- Domain milik sendiri memakai input domain penuh, lalu endpoint menampilkan sinyal registrar/nameserver dari RDAP jika tersedia.
- Untuk domain milik sendiri, user diarahkan mengganti nameserver ke Cloudflare kita atau menambah DNS record yang kita berikan jika ingin tetap memakai nameserver lama.
- Indikator hijau pada domain baru berarti `available` dari pre-check; indikator hijau pada domain sendiri berarti domain terdeteksi registered/usable untuk setup DNS, bukan tersedia untuk dibeli.
- Domain sendiri hanya bisa lanjut jika RDAP/DNS memberi sinyal registered/aktif; hasil inconclusive tetap ditahan sebagai warning.
- Mode mock checkout tetap mencatat lead `checkout_pending` jika Lemon Squeezy belum dikonfigurasi.

Risiko debug:
- Jika ada perubahan pada flow download/setup, ubah komponen ini agar `/demo` dan `/:businessId` tetap sinkron.
- Jangan menggandakan flow domain di `DemoSite` atau `PublicViewer`; keduanya harus lewat `WebsiteActionPanel`.

## Admin Pages

### `src/pages/admin/AdminDashboard.tsx`

Fungsi:
- Menampilkan overview CRM: total leads, conversion rate, total revenue, dan aktivitas terbaru.

API yang dipakai:
- `GET /api/stats`
- `GET /api/activities`

Logic penting:
- Response API divalidasi. Jika endpoint 500 atau return shape salah, halaman tidak crash.
- `toNumber()` memastikan `toFixed()` hanya dipanggil pada angka valid.
- Jika API bermasalah, dashboard menampilkan banner fallback dan angka kosong.

### `src/pages/admin/AdminLeads.tsx`

Fungsi:
- Mencari prospek bisnis dari Google Places.
- Memilih provider/model AI.
- Menghasilkan JSON website untuk lead.
- Mengelola status lead.

API yang dipakai:
- `GET /api/leads`
- `GET /api/prospects`
- `PUT /api/prospects/:placeId/status`
- `GET /api/settings`
- `GET /api/places/search?query=...`
- `GET /api/places/search?query=...&refresh=1`
- `GET /api/places/details?placeId=...`
- `GET /api/places/photo?reference=...`
- `POST /api/sites/generate`
- `PUT /api/leads/:id/status`

Logic penting:
- Provider AI tersedia: OpenRouter, OpenAI, Gemini, KIE.ai, dan Opencode.
- Pilihan AI provider/model disimpan ke localStorage agar refresh tetap memakai pilihan terakhir.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- Jika hasil Google Places punya `photos`, admin bisa memilih salah satu sebagai logo/brand source.
- Gambar logo diambil melalui proxy same-origin `/api/places/photo`, lalu canvas browser mengekstrak palette warna dominan.
- Foto Places diurutkan best-effort: attribution yang mirip nama bisnis, lalu tanpa attribution, lalu UGC/attributed. Places API tidak menyediakan flag owner photo yang reliable.
- Palette dikirim ke `/api/sites/generate` sebagai `brandPalette`.
- Logo yang dipilih dikirim sebagai `selectedLogoImageUrl`.
- Photo reference dan source dikirim sebagai `selectedLogoReference` dan `selectedLogoSource`.
- Attribution foto yang dipilih dikirim sebagai `selectedLogoAttributions` dan disimpan di JSON sebagai `brand.photoAttributions`.
- Untuk situs gratis, foto Google Places tetap hotlink/proxy runtime dan tidak di-upload ke R2.
- JSON mock fallback memakai palette tersebut untuk `primary`, `accent`, dan `secondary`.
- JSON mock fallback menentukan `meta.language` dari alamat/region Places: US default English, Indonesia default Indonesian.
- JSON mock fallback menentukan `design.stylePreset` dan `design.stylePresetConfig` via `src/lib/siteStylePresets.ts`.
- Prompt AI generator juga diinstruksikan memakai bahasa sesuai region bisnis.
- Prompt AI generator mengidentifikasi apakah bisnis menjual `products`, `services`, atau `both`, lalu membuat `productServiceStrategy`, arrays `products`/`services`, submenu navbar children, dan satu halaman detail non-thin untuk setiap produk/layanan.
- Mock fallback di `AdminLeads` juga membuat product/service detail pages memakai section `hero`, `offeringDetail`, `reviews`, `faq`, dan `hoursLocation`.
- Place Details mengambil field `reviews`; detail page bisa memakai review Google yang relevan via keyword best-effort.
- Search Google Places menampilkan feedback sukses/kosong/error melalui `searchMessage`, supaya response kosong tidak terlihat seperti tombol tidak bekerja.
- Search default membaca cache D1 `places_search_cache`; tombol `Refresh` memaksa request baru ke Google Places.
- Setiap result Google Places di-upsert ke `places_prospects` sebagai prospect draft agar pencarian lama tidak hilang.
- Filter prospect tersimpan memakai status, website/no website, minimum rating, minimum review count, city, state, dan niche. Default workflow memprioritaskan bisnis tanpa website.
- Hasil pencarian tidak dikosongkan setelah generate, termasuk saat `/api/sites/generate` gagal.
- Generate status ditampilkan per bisnis, dengan link preview jika sukses.
- Tombol `Load more photos/details` memanggil Place Details agar admin bisa memilih lebih banyak foto sebelum generate dan menyimpan `details_json`.
- Tombol `Details` membuka drawer berisi website, phone, rating, status prospect, Google Maps link, error generate terakhir, dan grid foto/palette.
- Tombol `Trim cache 30d` memanggil `POST /api/places/cache/trim` untuk membersihkan cache Places lama/expired.
- Tombol `Skip` mengubah status prospect ke `skipped`; status lain bisa diubah dari drawer.
- Checkbox prospect + `Generate selected` menjalankan batch generate queue secara sequential dari browser agar tidak menembak semua AI request paralel.
- Tombol `Jobs` membaca `GET /api/generation-jobs` dan menampilkan 100 job terakhir.
- Foto/palette yang dipilih admin disimpan via `PUT /api/prospects/:placeId/selection`, lalu dihydrate kembali saat prospect draft dibuka.

Risiko debug:
- Jika foto Google tidak muncul, cek Places API key dan apakah Text Search mengembalikan `photos`.
- Jika hanya satu foto muncul, klik `Load more photos/details`; Text Search memang sering mengembalikan foto terbatas.
- Jika pencarian tidak menampilkan hasil, cek pesan di UI dan response `/api/places/search`; Function menormalisasi status Google seperti `ZERO_RESULTS`, `REQUEST_DENIED`, dan fetch failure ke JSON.
- Error `API keys with referer restrictions cannot be used with this API` berarti key Google Places masih dibatasi HTTP referrer. Untuk Pages Functions/server-side, pakai server key tanpa application restriction dan batasi hanya API-nya di Google Cloud.
- Canvas palette butuh image same-origin/CORS; karena itu foto harus lewat proxy `/api/places/photo`, bukan langsung URL Google.
- Audit dan roadmap admin disimpan di `docs/ADMIN_WORKFLOW_AUDIT.md`.

### `src/pages/admin/AdminSchema.tsx`

Fungsi:
- Menampilkan baseline JSON schema yang dipakai AI generator.

API yang dipakai:
- `GET /api/schema`

Logic penting:
- Jika API error, halaman menampilkan pesan error sebagai text di area schema.

### `src/pages/admin/AdminSettings.tsx`

Fungsi:
- Mengelola API keys dan payment links yang disimpan di D1.
- Menghitung estimasi biaya AI sebelum generate.

API yang dipakai:
- `GET /api/settings`
- `POST /api/settings`

Logic penting:
- Provider selector hanya menampilkan field API key untuk provider aktif.
- Provider tab dan estimator provider/model disimpan ke localStorage agar pilihan terakhir tetap dipakai setelah refresh.
- Auto-save berjalan 1,2 detik setelah perubahan terakhir.
- Banner status custom menggantikan `alert()` browser.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- KIE.ai ditampilkan sebagai estimasi diskon karena pricing live berada di dashboard/pricing KIE.
- Payment settings sekarang mencakup Lemon Squeezy API key, store ID, variant ID, dan nomor WhatsApp admin untuk mock/checkout notifications.

Risiko debug:
- Jika save gagal, form tetap menyimpan state lokal dan banner merah meminta retry.
- Jika D1 binding belum ada, `GET /api/settings` bisa fallback kosong dari Function.

## Public Pages

### `src/pages/public/HubPage.tsx`

Fungsi:
- Landing sederhana WebView.click.
- Mengarahkan visitor yang sudah punya `savedBusinessId` ke preview bisnis terakhir.
- Menyediakan toggle bahasa EN/ID dan tombol WhatsApp.

Logic penting:
- `localStorage.savedBusinessId` diset oleh `PublicViewer`.

### `src/pages/public/DemoSite.tsx`

Fungsi:
- Route `/demo` untuk merender sample dari `JSON/template-schema.json` tanpa API, D1, atau R2.
- Dipakai untuk koreksi visual dan menentukan variable JSON tambahan sebelum generator AI dipaksa mengikuti schema baru.

Logic penting:
- Import JSON sample langsung dari repo.
- Menampilkan floating inspector kecil berisi nama bisnis dan daftar `pageId:sectionType` yang sedang tersedia.
- Inspector menampilkan field JSON yang hilang jika renderer sedang memakai fallback.
- Inspector bisa diminimize agar tidak menutup preview.
- Menggunakan `SiteRenderer` dengan `showProspectPanel={false}` agar demo fokus ke hasil render website.

Risiko debug:
- Jika `/demo` blank, cek apakah `resolveJsonModule` aktif di `tsconfig.json`.
- Jika section baru tidak muncul sesuai harapan, update `SiteRenderer`.
- Tombol floating demo:
  - Download Free membuat zip owner berisi `index.html` saja via `downloadOwnerSiteZip`.
  - Paket `$197 Domain + Hosting` memanggil `POST /api/payments/checkout`.
  - Jika Lemon Squeezy belum dikonfigurasi, endpoint mencatat mock checkout dan membuka link WhatsApp admin.
- Demo memiliki selector style preset dari `src/lib/siteStylePresets.ts` agar preset bisa diuji tanpa edit JSON.
- Checkout demo memakai flow domain shared dari `WebsiteActionPanel`: domain baru atau domain milik sendiri, inline check, dan email hanya setelah domain lolos pre-check.
- Download/setup action panel memakai `WebsiteActionPanel` dengan `variant="demo"`, shared dengan public preview.

### `src/pages/public/PublicViewer.tsx`

Fungsi:
- Render website preview berdasarkan JSON site.
- Tracking view lead.
- Menampilkan CTA download HTML dan payment link.

API yang dipakai:
- `POST /api/leads/:businessId/ping`
- `GET /api/public-settings`
- `GET /api/sites/:businessId`

Logic penting:
- Jika JSON site ditemukan, halaman meneruskan data ke `SiteRenderer`.
- `handleDownloadZip()` membuat zip HTML statis dari DOM saat ini.
- Panel prospek dari `SiteRenderer` memakai `WebsiteActionPanel` dengan `variant="public"`, sehingga flow download/setup sama dengan `/demo`.
- Payment checkout memakai `POST /api/payments/checkout`; payment link basic/premium lama masih bisa dibaca tapi bukan flow utama.

Risiko debug:
- Jika halaman 404, cek row `json_sites.business_id`.
- Jika warna/typography rusak, cek shape `design.themeVariables` di JSON.

## Shared Logic

### `src/lib/aiPricing.ts`

Fungsi:
- Sumber data pricing model untuk UI estimator.
- Menghitung perkiraan biaya berdasarkan input/output token.
- Format harga USD untuk Settings dan Leads.

Logic penting:
- `estimateTokensFromText()` memakai estimasi kasar 4 karakter per token.
- KIE.ai menggunakan estimasi diskon konservatif, bukan angka final resmi per model.

### `src/lib/localStorageState.ts`

Fungsi:
- Hook kecil `useLocalStorageState()` untuk menyimpan state select/form non-rahasia di browser.

Logic penting:
- Membaca nilai awal dari localStorage saat component mount.
- Menulis perubahan state ke localStorage.
- Error storage diabaikan agar UI tetap jalan di private/restricted browsing.

### `src/lib/siteStylePresets.ts`

Fungsi:
- Registry style preset niche untuk site builder.
- Menyediakan metadata label, industri, mood, recommended colors, dan keyword matching.
- Mengekspor CSS modifier yang diinjeksi oleh `SiteRenderer`.

Logic penting:
- `inferStylePresetFromText()` dipakai CRM generate untuk memilih preset dari nama bisnis, alamat, dan Places types.
- `normalizeStylePreset()` memastikan nilai JSON yang tidak dikenal fallback ke `local-clean`.

### `src/lib/domainExtensions.ts`

Fungsi:
- Daftar extension domain yang ditawarkan di checkout demo.
- Kategori extension untuk selector searchable/filterable.
- Helper `normalizeDomainLabel()` dan `buildDomain()`.

## Cloudflare Pages Functions

### `functions/api/[[path]].ts`

Fungsi:
- Catch-all API production untuk `/api/*` di Cloudflare Pages.
- Menggantikan Express API saat deploy di Cloudflare Pages.

Endpoint:
- `GET/POST /api/settings`
- `GET /api/public-settings`
- `GET /api/schema`
- `GET /api/stats`
- `GET /api/activities`
- `GET /api/leads`
- `PUT /api/leads/:id/status`
- `POST /api/leads/:business_id/ping`
- `GET /api/places/search`
- `GET /api/places/photo`
- `POST /api/sites/generate`
- `GET /api/sites/:business_id`
- `POST /api/payments/checkout`
- `GET /api/domains/check`

Logic D1:
- Binding wajib: `DB`.
- `setupTables()` membuat tabel jika belum ada.
- `addColumnIfMissing()` menjalankan migrasi ringan berbasis `PRAGMA table_info`.
- `addColumnIfMissing()` menangani duplicate-column race dan retry tanpa `DEFAULT` jika D1 menolak alter tertentu.
- Write path penting tetap defensif terhadap schema production lama: `/api/sites/generate`, `/api/payments/checkout`, `/api/leads/:business_id/ping`, dan `/api/prospects/:placeId/selection` akan mencoba self-heal kolom lalu fallback query tanpa kolom baru bila perlu.
- `/api/stats`, `/api/activities`, dan `/api/settings` punya fallback JSON agar admin tidak blank saat DB belum sempurna.

Logic AI:
- OpenRouter/OpenAI/Opencode memakai format Chat Completions.
- Gemini memakai endpoint Google Generative Language.
- KIE.ai mendukung:
  - `kie/gpt-5-5` via `https://api.kie.ai/codex/v1/responses`
  - `kie/gpt-5-2` via `https://api.kie.ai/gpt-5-2/v1/chat/completions`
  - `kie/gemini-3.1-pro` via `https://api.kie.ai/gemini-3.1-pro/v1/chat/completions`
  - `kie/gemini-3-flash` via `https://api.kie.ai/gemini-3-flash/v1/chat/completions`

Logic Google Places/logo:
- `/api/places/search` memakai Google Places Text Search.
- `/api/places/photo` mem-proxy Google Places Photo agar frontend bisa membaca pixel untuk palette.
- `brandPalette` dan `selectedLogoImageUrl` dikirim dari `AdminLeads` ke generator.
- `selectedLogoReference`, `selectedLogoSource`, `selectedLogoAttributions`, dan `selectedLogoPriority` ikut dikirim agar JSON final menyimpan provenance foto.
- Function memaksa `businessId` masuk ke `meta.businessId` dan menjaga `logoImageUrl` jika dipilih admin.
- Jika logo dipilih, Function juga menulis `brand.logoImageUrl`, `brand.photoSource`, `brand.googlePhotoReference`, `brand.photoCaption`, `brand.photoAttributions`, dan `brand.selectedPhotoPriority`.

Logic R2:
- Binding optional: `R2`.
- Public URL: `R2_PUBLIC_BASE_URL`, default/fallback production `https://assets.webview.click`.
- Saat `POST /api/sites/generate`, Function:
  - Menormalisasi filename image non-URL agar mengandung slug `businessId`.
  - Meng-upload image URL non-Google yang bisa di-fetch ke `sites/{businessId}/assets/{businessId}-asset-XX.ext`.
  - Melewati Google Places photo URLs (`/api/places/photo`, Google photo media, `googleusercontent.com`) agar free preview tidak menyimpan ulang foto Google ke R2.
  - Meng-upload JSON final ke `sites/{businessId}/{businessId}.json`.
  - Menambahkan metadata `storage.r2JsonKey`, `storage.r2JsonUrl`, dan `storage.r2AssetKeys` ke JSON.

Risiko debug:
- Jika asset tidak bisa dibuka, cek custom domain R2 `assets.webview.click`, bucket public/custom domain setting, dan env `R2_PUBLIC_BASE_URL`.
- Asset yang hanya berupa filename lokal tidak bisa di-upload karena tidak ada binary sumber; Function hanya memastikan namanya mengandung slug.
- Jika R2 sync gagal saat generate, Function menyimpan `storage.r2SyncError` dan tetap lanjut menyimpan JSON ke D1.

Logic Places Cache:
- `places_search_cache` menyimpan response `GET /api/places/search` selama 30 hari.
- `GET /api/places/search?query=...` membaca cache jika masih valid.
- `GET /api/places/search?query=...&refresh=1` melewati cache dan menyimpan response terbaru.
- `POST /api/places/cache/trim` menghapus cache lama/expired; body: `{ "olderThanDays": 30 }`.

Logic Prospect Drafts:
- `places_prospects` menyimpan result Places per `place_id`.
- Search dan mock search memanggil upsert prospect draft.
- Place Details memperbarui `details_json`, phone, website, maps URL, dan `details_loaded_at`.
- `GET /api/prospects` menerima filter `status`, `website=none|has|all`, `minRating`, `minReviews`, `city`, `state`, dan `niche`.
- `PUT /api/prospects/:placeId/status` mengubah status workflow (`new`, `details_loaded`, `site_generated`, `contacted`, `skipped`).
- `PUT /api/prospects/:placeId/selection` menyimpan selected Google Places photo metadata dan palette.

Logic Generation Jobs:
- `generation_jobs` mencatat setiap request `/api/sites/generate` dengan status `running`, `success`, atau `failed`.
- Jika generate sukses, prospect draft diupdate ke `site_generated` dan `generated_business_id` diisi.
- Jika generate gagal, `generation_jobs.error` dan `places_prospects.last_error` diisi agar admin bisa melihat error di UI.
- `GET /api/generation-jobs` mengembalikan 100 job terbaru untuk panel Jobs di `/admin/leads`.

Logic Owner HTML Export:
- `src/lib/exportSiteHtml.ts` membuat zip owner berisi hanya `index.html`.
- Export menghapus `<script>` internal, `.hide-in-export`, dan `[data-export-remove="true"]`.
- Export tidak menyertakan `site-data.json` karena JSON internal hanya untuk generator WebView.click.
- Export mengambil gambar yang sedang tampil di DOM, menyimpannya ke folder `/img` di dalam zip, lalu mengubah `<img src>` menjadi path relatif seperti `img/{businessId}-hero.jpg`. Ini termasuk foto Google Business Profile yang sedang diproxy via WebView.click saat tombol download diklik, sehingga HTML owner tidak perlu hotlink ke Google atau Function WebView.click untuk gambar.
- Export menambahkan Tailwind CSS/CDN hotlink, stylesheet production absolute, style tags renderer, favicon dari logo bisnis/fallback SVG, dan mengubah URL relatif non-gambar/link menjadi absolute URL.
- Export menambahkan JS inline kecil untuk mengaktifkan tabbed navigation pada elemen `data-wv-tab` dan `data-wv-page` karena React handler tidak ikut dalam HTML statis.
- Export JS juga mengaktifkan hover-persistent submenu dan contact form `mailto:` supaya HTML owner tetap interaktif tanpa React.
- Favicon export memakai inline SVG dari `meta.faviconSvg` / `brand.faviconSvg` / `brand.logoSvg`, atau fallback SVG monogram; tidak memanggil favicon remote WebView.click.
- Jika gambar gagal di-fetch saat export karena network/CORS/provider error, exporter mencatat warning di console dan mempertahankan URL absolute sebagai fallback terakhir.

Logic Payments:
- `/api/payments/checkout` membuat checkout Lemon Squeezy jika `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, dan `LEMON_SQUEEZY_VARIANT_ID` sudah ada.
- Jika belum lengkap, endpoint berjalan mock mode, membuat/mengupdate lead dengan status `checkout_pending`, dan mengembalikan `adminNotifyUrl` WhatsApp.
- Paket saat ini: `$197` one-time untuk domain 1 tahun, hosting 1 tahun, dan free setup.
- Request checkout menyimpan `domainMode` (`new` atau `owned`) ke custom data Lemon Squeezy dan notifikasi admin.

Logic Domains:
- `/api/domains/check?domain=...` melakukan availability pre-check gratis.
- Primary provider: RDAP via `rdap.net`.
- Fallback signal: Google Public DNS SOA lookup.
- Jika RDAP `200`, response menyertakan `registrar`, `nameservers`, dan `rdapUrl` jika registry menyediakan field tersebut.
- Response harus diperlakukan sebagai kandidat availability, bukan jaminan pembelian; final confirmation terjadi saat registrar purchase.

## Data and Schema

### `JSON/template-schema.json`

Fungsi:
- Baseline struktur JSON website yang diberikan ke model AI.
- Sample kini berisi schema baru untuk site builder: `sourceData`, `brand`, `businessProfile`, `trust`, `offers`, `capabilities`, `location`, `hours`, `conversion`, dan `seo`.
- Sample juga berisi `productServiceStrategy`, `products`, `services`, submenu `navigation.headerMenu[].children`, dan halaman detail produk/layanan.
- `design` berisi `stylePreset`, `stylePresetConfig`, dan `styleSystem.allowedPresets` agar AI memilih nuansa niche yang valid.
- Homepage sample memakai section modern: `hero`, `trustBar`, `features`, `offers`, `reviews`, `hoursLocation`, dan `faq`.
- Halaman detail produk/layanan memakai `offeringDetail` plus review relevan, FAQ, dan CTA kontak/lokasi agar tidak thin.

### `SQL/schema.sql`

Fungsi:
- Skema Cloudflare D1 production.
- Tabel inti: `leads`, `subscriptions`, `crm_activities`, `json_sites`, `system_settings`.
- Tabel admin prospecting: `places_search_cache`, `places_prospects`, dan `generation_jobs`.

Tabel:
- `leads`
- `subscriptions`
- `crm_activities`
- `json_sites`
- `system_settings`

## Maintenance Rule

Jika menambah laman atau komponen baru:
- Update route/entry di dokumen ini.
- Jelaskan fungsi, API yang dipakai, logic state penting, dan risiko debug.
- Jika menambah endpoint Function baru, update bagian `Cloudflare Pages Functions`.

## Related Planning Docs

- `docs/GOOGLE_PLACES_DATA_INVENTORY.md`: inventaris data Google Places yang bisa dipakai untuk CRM lead scoring dan site generation.
- `docs/GOOGLE_PLACES_PHOTO_STRATEGY.md`: strategi foto Google Places untuk free preview vs paid website.
- `docs/NICHE_STYLE_PRESETS.md`: brainstorm dan kontrak `design.stylePreset`.
- `docs/LEMON_SQUEEZY_INTEGRATION.md`: catatan integrasi checkout Lemon Squeezy.
- `docs/DOMAIN_AVAILABILITY_RESEARCH.md`: riset provider gratis/murah untuk cek availability domain.
- `docs/SITE_BUILDER_UPGRADE_PLAN.md`: rencana upgrade JSON schema dan renderer agar demo/site output lebih modern dan personalized.
