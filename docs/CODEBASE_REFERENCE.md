# WebView.click Codebase Reference

Terakhir diperbarui: 17 Mei 2026.

Dokumen ini menjelaskan isi, fungsi, dan logic utama tiap laman/komponen agar debugging berikutnya tidak mulai dari nol.

## Routing

File: `src/App.tsx`

Routes utama:
- `/` -> `HubPage`
- `/demo` -> `DemoSite`
- `/admin` -> `AdminLayout` + `AdminDashboard`
- `/admin/leads` -> `AdminLeads`
- `/admin/jobs` -> `AdminJobs`
- `/admin/sites` -> `AdminSites`
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
- Desktop submenu dirender sebagai fixed overlay sibling setelah header, bukan child layout di dalam header, agar navbar tidak membesar saat submenu terbuka.
- Header default lebih lega di posisi top, lalu berubah compact dengan `data-wv-header-compact` setelah scroll; export owner HTML mengaktifkan behavior yang sama via inline JS.
- Submenu diberi boundary `data-wv-site-submenu` agar mengikuti konteks navbar, bukan mewarisi styling body/card generated site.
- Pergantian tab menjalankan scroll-to-top.
- Section renderer mendukung `hero`, `trustBar`, `features`, `offers`, `reviews`, `hoursLocation`, `faq`, `textImageBlock`, `teamGrid`, `gridCards`, `imageGallery`, dan `contactForm`.
- Feature grid cards dirender center-aligned: icon, title, dan body berada di tengah card agar tampilan lebih rapi seperti demo.
- Trust bar dan feature icons dirender sebagai SVG langsung tanpa wrapper background agar icon tidak terlihat mengecil; icon subheading `hoursLocation` memakai ukuran relatif heading.
- Grid marketing 3 kolom seperti offers, reviews, dan generic grid cards memakai content text-center agar komposisi tiap card lebih seimbang.
- Review cards memakai quotation marks dekoratif sebagai `wv-heading` spans kiri/kanan, sehingga mengikuti font heading aktif tanpa memakai heading tag.
- Renderer membaca schema baru: `brand`, `businessProfile`, `trust`, `offers`, `capabilities`, `location`, `hours`, dan `conversion`.
- Renderer membaca `design.stylePreset` untuk niche style modifier dan `design.visualStyle` / `design.shapeStyle` untuk shape/image treatment. Registry dan CSS preset ada di `src/lib/siteStylePresets.ts`.
- Renderer membaca `design.shaderPreset` dan `design.shaderConfig`; registry shader procedural ada di `src/lib/siteStylePresets.ts` dan guide teknis di `docs/SHADERS_GUIDE.md`.
- Renderer membaca `design.fontPairing` dan `design.fontPairingConfig`; registry Google Font pairing ada di `src/lib/fontPairings.ts` dan ringkasannya di `docs/FONT_PAIRING_GUIDE.md`.
- Root `#rendered-site` hanya menyimpan CSS variables palette aktif; website client dirender di child `[data-wv-site-canvas]` dengan class `wv-preset-*` dan `wv-visual-*`.
- Tool UI seperti edit text, `WebsiteActionPanel`, demo inspector, download/domain/setup controls berada di luar `[data-wv-site-canvas]` agar tidak terkena CSS website.
- Font pairing aktif hanya diterapkan ke `[data-wv-site-canvas]`; panel/tools tetap memakai style app.
- Shader layer dirender sebagai inert `<div data-wv-site-shader>` di dalam `[data-wv-site-canvas]`; pointer JS hanya mengubah CSS variables `--wv-pointer-x`/`--wv-pointer-y`.
- Header website diberi `data-wv-site-header` dan CSS kompaktornya sendiri agar style/shader experience layer tidak membuat navbar ikut melebar/meninggi.
- `data-wv-tool-ui` punya reset typography di renderer; inline toolbar B/I/U memakai marker khusus `data-wv-format-toolbar` karena posisinya menempel di editable text dalam canvas website.
- Gambar dirender sebagai `<img>` jika URL usable (`http`, `/`, atau `data:`); filename placeholder tetap ditampilkan sebagai fallback supaya preview tidak blank.
- Untuk gambar Google Places, renderer menampilkan attribution overlay dari `brand.photoCaption` dan `brand.photoAttributions`.
- `conversion.stickyMobileCta` menampilkan CTA sticky di mobile.
- Footer dirender lebih lengkap: brand/about, sosial, halaman, highlights/offers, kontak, alamat, dan jam operasional jika tersedia.
- Footer diberi boundary `data-wv-site-footer` agar tetap memakai palette/font site tetapi terlindung dari efek card/body/image hover yang tidak cocok untuk konteks footer.
- Footer column labels seperti Pages/Highlights/Contact memakai class `wv-heading` agar mengikuti heading font pairing tanpa mengubah struktur semantik.
- Footer highlights memprioritaskan `products + services` daripada `offers`, supaya link footer menuju halaman detail `detailPageId` masing-masing. Jika tidak ada produk/layanan, footer fallback ke offers/capabilities.
- Product/service labels in navbar submenu and footer highlights are title-cased for presentation, while preserving the underlying `detailPageId` target.
- Nomor telepon dirender sebagai `tel:` link dan email sebagai `mailto:` link.
- Contact form membuat `mailto:` URL berisi nama, email, pesan, dan semua field form yang diisi.
- Visitor action panel untuk download/setup dirender lewat shared component `WebsiteActionPanel`, bukan logic lokal di renderer.
- Fallback section unknown tampil sebagai label `[Section: type]`, supaya schema baru tidak membuat halaman blank.
- Text utama di renderer dibungkus dengan shared `EditableText`, tetapi edit mode default off supaya teks normal bisa di-select/copy. Tombol floating `Edit text` di `/demo` dan `/:businessId` mengaktifkan contentEditable; perubahan tersimpan di localStorage per business/page/text key dan ikut masuk ke download HTML.

Risiko debug:
- Jika UI demo/public berbeda dari ekspektasi, cek mapping section di file ini dulu sebelum mengubah `PublicViewer`.
- Jika menambah `section.type` baru di JSON, tambahkan renderer di file ini dan update dokumen ini.
- Jika tool UI berubah mengikuti website, pastikan elemen tool tidak masuk ke `[data-wv-site-canvas]`.

### `src/components/EditableText.tsx`

Fungsi:
- Inline light text editor untuk preview owner di `/demo` dan `/:businessId`.
- Memakai native `contentEditable`, bukan dependency editor tambahan.

Logic penting:
- Setiap teks punya key `webview.inlineText.{businessId}.{page}.{field}` di localStorage.
- `enabled=false` merender teks biasa yang selectable/copyable; `enabled=true` baru mengaktifkan `contentEditable`, ring edit, dan toolbar.
- Toolbar kecil mendukung bold, italic, dan underline via browser command.
- Toolbar diberi `data-wv-format-toolbar` dan `data-wv-format-command` per tombol supaya typography/action button tidak mewarisi font/style website client.
- Paste dipaksa plain text agar HTML asing tidak ikut masuk.
- Export HTML membersihkan atribut `contenteditable` dan toolbar lewat `src/lib/exportSiteHtml.ts`, tetapi isi teks hasil edit tetap ikut karena sudah ada di DOM.

Risiko debug:
- Jika teks tidak ikut download, cek apakah field tersebut sudah dibungkus `EditableText` di `SiteRenderer`.
- Jika key berubah karena page/section ID berubah, localStorage edit lama tidak akan terpakai.

### `src/components/HelpTooltip.tsx`

Fungsi:
- Shared hover tooltip kecil untuk UI admin/visitor.
- Menghindari copy penjelasan panjang langsung di halaman.

Logic penting:
- Default width `w-72`, bisa dioverride via `widthClass`.
- Menerima `text` string atau `children` untuk konten custom.

### `src/components/GenerationJobsTable.tsx`

Fungsi:
- Shared table untuk generation jobs, dipakai oleh quick drawer `/admin/leads` dan halaman penuh `/admin/jobs`.
- Menghindari duplikasi logic filter/sort/retry agar kedua UI tidak drift.

Logic penting:
- Komponen sendiri yang mengambil `GET /api/generation-jobs?limit=...`, menghitung counter filter, menyimpan filter/sort ke localStorage berdasarkan `storageKeyPrefix`, dan menjalankan retry job.
- Dalam `serverBackedFilters` mode, perubahan filter `Failed`, `Fallback`, `Patch`, atau `No rewrite` memanggil endpoint dengan `status=failed`, `patch=fallback`, `patch=applied`, atau `aiRewrite=zero`, bukan hanya menyaring rows yang sudah loaded.
- Dalam `serverBackedSearch` mode, search box mengirim `q` ke server untuk mencari `business_id`, `place_id`, job `id`, nama prospect, dan metadata JSON.
- Full page mode menampilkan `Load more` jika rows loaded masih lebih sedikit dari count server; tombol ini memanggil endpoint dengan `offset={loadedRows}` lalu append ke tabel.
- Kolom Job menyediakan tombol copy kecil untuk Job ID dan Business ID; saat sukses icon berubah menjadi check sementara.
- Kolom Action punya tombol `Details` yang membuka drawer kanan berisi status, provider/model, business/place IDs, timestamps, raw error, retry dari drawer, audit copy AI, dan raw `metadata` JSON dengan tombol copy.
- Retry mengambil current copy brief dari `GET /api/sites/:businessId/copy-brief`, menghitung hash browser-side, lalu memperingatkan jika hash berbeda dari job lama sebelum membuat job baru.
- `variant="compact"` dipakai di `/admin/leads`; `variant="full"` dipakai di `/admin/jobs`.
- `onJobsLoaded` dipakai parent `/admin/leads` untuk memperbarui angka pada tombol `Jobs`.

### `src/components/AdminLayout.tsx`

Fungsi:
- Shell admin dengan sidebar icon navigation.
- Mengamankan halaman admin via Clerk.
- Menyediakan dev bypass jika publishable key tidak tersedia atau live key dipakai di host dev.

Logic penting:
- `NavContent` menampilkan link Dashboard, CRM Leads, Generation Jobs, Generated Sites, JSON Schema Info, dan Settings.
- Saat pindah route admin, container konten dan window otomatis scroll ke atas agar tab baru tidak mulai dari posisi scroll tab sebelumnya.
- Sidebar menampilkan badge kecil `DB` setelah `/admin/schema` berhasil menjalankan `Repair DB now`; timestamp disimpan di localStorage key `webview.admin.lastDbRepairAt`.
- `ClerkSecureLayout` hanya mengizinkan user dengan `publicMetadata.role === "admin"`.
- Jika role belum admin, halaman menampilkan instruksi update metadata Clerk.

Risiko debug:
- Jika admin terkunci, cek `VITE_CLERK_PUBLISHABLE_KEY` dan metadata user di Clerk.
- `isDevBypass` hanya fallback untuk dev/AI Studio, bukan mode auth production ideal.

### `src/components/WebsiteActionPanel.tsx`

Fungsi:
- Shared visitor action panel untuk `/demo` dan public preview `/:businessId`.
- Menangani download free, domain selection, domain availability/ownership pre-check, dan checkout setup `$197/year`.
- Floating trigger text is `Download / Setup` for both demo and public preview; pricing is shown inside the opened panel/checkout flow, not on the collapsed button.

Props penting:
- `siteData`: dipakai untuk business name/business ID default.
- `businessId`: fallback ID checkout.
- `variant`: `demo` atau `public` untuk positioning/label kecil.
- `onDownloadZip`: callback download zip, tersedia di demo dan public preview.
- `fontPairings`, `selectedFontPairing`, `onFontPairingChange`: opsi font pairing yang cocok dengan industri agar owner bisa memilih style font sebelum download/setup.
- `paletteOptions`, `selectedPaletteOption`, `onPaletteOptionChange`: opsi palette hasil ekstraksi foto bisnis agar owner bisa memilih warna sebelum download/setup.

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
- Jika font pairing selector muncul, perubahan langsung diterapkan ke renderer dan export HTML mengikuti pilihan yang aktif saat download.
- Jika palette selector muncul, perubahan langsung diterapkan ke renderer dan export HTML mengikuti warna yang aktif saat download.

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
- `GET /api/places/history`
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
- Hingga 5 palette foto disimpan sebagai `brand.paletteOptions` dan dikirim ke `/api/sites/generate` sebagai `paletteOptions`.
- Logo yang dipilih dikirim sebagai `selectedLogoImageUrl`.
- Photo reference dan source dikirim sebagai `selectedLogoReference` dan `selectedLogoSource`.
- Attribution foto yang dipilih dikirim sebagai `selectedLogoAttributions` dan disimpan di JSON sebagai `brand.photoAttributions`.
- Admin harus menjalankan `Gather data` / Place Details sebelum `Generate Site`; tombol generate baru muncul setelah detail bisnis, foto, review, phone, dan direct Google Maps URL dicoba diambil.
- Setelah `Gather data`, item tetap dipertahankan di list lokal dan tombol berubah menjadi `Generate Site`; hasil detail tidak langsung mem-filter ulang list walaupun Places menemukan website/metadata baru.
- Badge website sebelum Place Details adalah `Website unknown`, bukan `No website`, karena Google Places Text Search tidak selalu menyertakan website. Setelah `Gather data`, badge baru berubah menjadi `Has website` atau `No website` dari Place Details.
- Search dapat mengaktifkan `websitePrecheck=1`, yaitu Place Details minimal untuk hasil teratas agar status website diketahui sebelum admin melakukan gather data penuh. Ini memakai kuota Details, tetapi mencegah buang waktu/generate untuk bisnis yang sudah punya website.
- Filter `No website first` berarti `website_check_status=no_website`, bukan sekadar kolom website kosong. Prospek yang belum dicek masuk kategori `Website unknown`.
- List prospek otomatis diurutkan dengan conversion score: no website verified, rating 4.5+, review count 10-100, phone exists, US market, belum generated, dan details gathered menaikkan skor; bisnis yang sudah punya website diberi penalti besar.
- Badge `Score` bisa diklik untuk membuka popover breakdown poin per faktor, berguna untuk tuning formula scoring.
- Bobot scoring default berasal dari `src/lib/prospectScoring.ts`, lalu bisa dioverride dari `/admin/settings`.
- Header list prospek menampilkan badge preset scoring aktif agar admin tahu ranking visible list sedang memakai preset apa.
- Nama bisnis di list link ke Google Business/Maps listing. Jika exact `url` dari Place Details belum tersedia, fallback memakai `/maps/place/?q=place_id:{placeId}` agar tidak membuka search query generik.
- Search result diberi `searchQuery` agar generator tidak memakai tipe Places generik seperti `establishment` sebagai niche ketika Google tidak memberi kategori spesifik.
- Untuk situs gratis, foto Google Places tetap hotlink/proxy runtime dan tidak di-upload ke R2.
- JSON mock fallback memakai palette tersebut untuk `primary`, `accent`, dan `secondary`.
- Jika admin lupa memilih foto/palette, generator memakai foto pertama dari hasil Places sebagai fallback visual dan palette default aman; jika `paletteOptions` sudah ada, opsi pertama dipakai sebagai palette default.
- Palette hasil ekstraksi digelapkan bila terlalu terang untuk teks putih; Function juga menormalisasi `primary` dan `accent` sebelum menyimpan JSON.
- JSON mock fallback menentukan `meta.language` dari alamat/region Places: US default English, Indonesia default Indonesian.
- JSON mock fallback menentukan `design.stylePreset`, `design.stylePresetConfig`, `design.visualStyle`, dan `design.visualStyleConfig` via `src/lib/siteStylePresets.ts`.
- JSON mock fallback menentukan `design.fontPairing`, `design.fontPairingConfig`, dan `themeVariables.typography` via `src/lib/fontPairings.ts`.
- Prompt AI generator juga diinstruksikan memakai bahasa sesuai region bisnis.
- Prompt AI generator dan Function post-process menjaga parity dengan `/demo`: jika ada minimal dua foto bisnis yang usable, JSON final harus punya page `gallery`, nav item `#gallery`, dan section `imageGallery`.
- Prompt AI generator mengidentifikasi apakah bisnis menjual `products`, `services`, atau `both`, lalu membuat `productServiceStrategy`, arrays `products`/`services`, submenu navbar children, dan satu halaman detail non-thin untuk setiap produk/layanan.
- Prompt AI generator diminta memilih icon/inline `iconSvg` sesuai teks/intent CTA dan feature item; product/service detail page harus punya features section berikon.
- Mock fallback di `AdminLeads` juga membuat product/service detail pages memakai section `hero`, `offeringDetail`, `features`, `reviews`, `faq`, dan `hoursLocation`.
- Place Details mengambil field `reviews`; detail page bisa memakai review Google yang relevan via keyword best-effort.
- Search Google Places menampilkan feedback sukses/kosong/error melalui `searchMessage`, supaya response kosong tidak terlihat seperti tombol tidak bekerja.
- Search default membaca cache D1 `places_search_cache`; tombol `Refresh` memaksa request baru ke Google Places.
- Setiap result Google Places di-upsert ke `places_prospects` sebagai prospect draft agar pencarian lama tidak hilang.
- Panel `Search history` membaca search term lama dari `places_search_cache`, lalu menghydrate setiap business card dari `places_prospects` berdasarkan Google `place_id`. Progress bisnis tetap current walaupun listing yang sama muncul di beberapa search term.
- Klik search term history memuat prospect list dari cache tanpa panggil Google Places baru, tetap memakai action/status workflow yang sama seperti search aktif.
- Filter prospect tersimpan memakai status, website/no website, minimum rating, minimum review count, city, state, dan niche. UI filter dibuat compact: toolbar `Filters`, chips aktif, tombol reset, dan panel advanced collapsible agar tidak memakan banyak ruang.
- Filter prospect juga punya minimum conversion score (`Any`, `50+`, `70+`, `85+`) untuk menyembunyikan prospek kualitas rendah dari list.
- Default minimum conversion score dan bobot scoring dibaca dari `/admin/settings` (`SCORING_MIN_SCORE_DEFAULT`, `SCORING_WEIGHTS_JSON`) dengan fallback ke `src/lib/prospectScoring.ts`; `SCORING_PRESET` disimpan untuk UI Settings.
- Penjelasan panjang di toolbar/filter CRM dipindahkan ke tooltip hover agar UI admin tetap ringkas.
- Hasil pencarian tidak dikosongkan setelah generate, termasuk saat `/api/sites/generate` gagal.
- Generate status ditampilkan per bisnis, dengan link preview jika sukses.
- Tombol `Load more photos/details` memanggil Place Details agar admin bisa memilih lebih banyak foto sebelum generate dan menyimpan `details_json`.
- Tombol `Details` membuka drawer berisi website, phone, rating, status prospect, Google Maps link, error generate terakhir, dan grid foto/palette.
- Tombol `Trim cache 30d` memanggil `POST /api/places/cache/trim` untuk membersihkan cache Places lama/expired.
- Tombol `Skip` mengubah status prospect ke `skipped`; status lain bisa diubah dari drawer.
- Checkbox prospect + `Generate selected` menjalankan batch generate queue secara sequential dari browser agar tidak menembak semua AI request paralel.
- Tombol `Select score 70+` memilih hanya prospek visible dengan conversion score minimal 70 untuk batch generate.
- Tombol `Jobs` membaca `GET /api/generation-jobs` dan menampilkan quick drawer 100 job terakhir.
- Quick drawer Jobs punya filter lokal `All`, `Failed`, `Fallback`, dan `Patch`, counter per filter, sort lokal `Newest`, `Failed first`, `Fallback first`, dan `Patch applied first`, serta link ke halaman penuh `/admin/jobs`.
- Foto/palette yang dipilih admin disimpan via `PUT /api/prospects/:placeId/selection`, lalu dihydrate kembali saat prospect draft dibuka.
- `PUT /api/prospects/:placeId/selection` juga dapat menyimpan `paletteOptions` tanpa menimpa selected photo/palette.

Risiko debug:
- Jika foto Google tidak muncul, cek Places API key dan apakah Text Search mengembalikan `photos`.
- Jika hanya satu foto muncul, klik `Load more photos/details`; Text Search memang sering mengembalikan foto terbatas.
- Jika pencarian tidak menampilkan hasil, cek pesan di UI dan response `/api/places/search`; Function menormalisasi status Google seperti `ZERO_RESULTS`, `REQUEST_DENIED`, dan fetch failure ke JSON.
- Error `API keys with referer restrictions cannot be used with this API` berarti key Google Places masih dibatasi HTTP referrer. Untuk Pages Functions/server-side, pakai server key tanpa application restriction dan batasi hanya API-nya di Google Cloud.
- Canvas palette butuh image same-origin/CORS; karena itu foto harus lewat proxy `/api/places/photo`, bukan langsung URL Google.
- Audit dan roadmap admin disimpan di `docs/ADMIN_WORKFLOW_AUDIT.md`.

### `src/pages/admin/AdminJobs.tsx`

Fungsi:
- Halaman khusus untuk audit `generation_jobs` agar `/admin/leads` tetap fokus pada prospecting/search.
- Membungkus shared `GenerationJobsTable` dalam mode full page.

Logic penting:
- Provider/model fallback untuk retry dibaca dari localStorage pilihan terakhir `/admin/leads`.
- Semua logic table, filter, sort, hash, refresh, dan retry hidup di `src/components/GenerationJobsTable.tsx`.
- Full page memakai `serverBackedFilters` agar filter jobs mencari dari server/D1, bukan hanya dari 200 row yang sedang loaded.
- Full page juga memakai `serverBackedSearch` untuk mencari job lama berdasarkan nama bisnis, `businessId`, `placeId`, job ID, atau metadata JSON.

Risiko debug:
- Retry butuh row `json_sites` untuk `businessId` tersebut; job lama tanpa site JSON tidak bisa diulang dari halaman ini.
- Jika hash berubah, itu berarti gathered/site data sudah berubah sejak attempt lama, bukan error UI.

### `src/pages/admin/AdminSites.tsx`

Fungsi:
- Menampilkan daftar situs yang sudah berhasil dibuat dan tersimpan di D1 `json_sites`.
- Menampilkan section `Ready to Generate` untuk prospect `details_loaded` yang sudah punya gathered Google Places data tetapi belum punya `generatedBusinessId`.
- Memberi link preview/open ke `/:businessId` supaya hasil generate tidak hilang dari workflow admin.
- Memberi link Google Maps/Google Business listing dari `sourceData.googleMapsUri` atau `businessProfile.contact.directionsUrl` untuk membandingkan hasil generate dengan listing asli.
- Tombol `Data` membuka snapshot gathered data yang tersimpan di JSON: `sourceData`, `businessProfile`, `location`, `hours`, `trust`, `brand`, dan product/service metadata.
- Tombol `Brief` membuka `GET /api/sites/:businessId/copy-brief`, yaitu `copyTargetBrief` stored-site yang dipakai untuk debugging bahan copy-only yang dikirim ke AI. Saat regenerate, fresh Google Places details masih bisa menambah fakta baru sebelum AI call.
- Untuk prospect yang belum generated, tombol action adalah `Generate`, bukan `Regen`; flow ini refresh Place Details, membangun fallback JSON lengkap dari gathered data, lalu memanggil `/api/sites/generate` dengan provider/model pilihan. Jika AI provider gagal, fallback JSON tetap disimpan agar generate tidak berhenti di 502.
- Fallback JSON dari `/admin/sites` mengisi `meta.generatedWithAi=false`, `meta.generationMode=google_places_fallback`, `meta.sourcePhotoCount`, title-cased service names, generalized niche copy profiles, service-area copy inferred from address, detail pages, dan gallery section jika Places mengembalikan lebih dari satu foto.
- Fallback JSON dari `/admin/sites` juga memilih `design.fontPairing` dan `fontPairingConfig` dari registry industri sehingga site tetap punya typography yang sesuai walaupun AI gagal.
- Tombol `Regen` memakai dropdown:
  - `AI regenerate with selected model` mengambil JSON site saat ini, mencoba refresh Place Details lagi jika `sourceData.placeId` tersedia, lalu memanggil `/api/sites/generate` dengan provider/model pilihan untuk membuat copy patch AI yang di-merge ke JSON deterministik.
  - `Re-gather Google data + resave` wajib punya `sourceData.placeId`, mengambil Place Details lagi, lalu mengirim `provider`/`model` kosong agar data Google Places, termasuk Maps URL exact, disimpan ulang tanpa memaksa AI call.

API yang dipakai:
- `GET /api/sites`
- `GET /api/prospects?status=details_loaded`
- `GET /api/places/details?placeId=...`
- `POST /api/sites/generate`
- `GET /api/sites/:businessId/copy-brief`

Logic penting:
- Search lokal bisa mencari nama bisnis, slug, niche, bahasa, dan region.
- Metadata tampilan diambil dari `meta`, `businessProfile`, dan `trust` di JSON site.
- List Generated Sites menampilkan badge storage mode: `R2 JSON` jika D1 hanya manifest dan full JSON ada di R2, atau `Legacy D1 JSON` jika row lama masih menyimpan full JSON di D1.
- List Generated Sites menampilkan badge generation mode: `AI Copy Patch` jika `meta.generationMode=ai_copy_patch`/`generatedWithAi=true`, atau `Fallback Only` jika site dibuat dari gathered-data/scaffold tanpa copy patch AI.
- Pilihan provider/model regenerate disimpan ke localStorage agar refresh halaman tetap memakai model terakhir yang dipilih admin.
- Pilihan provider/model yang sama dipakai untuk `Generate` prospect gathered di section `Ready to Generate`.
- Tombol Refresh membaca ulang list dari API setelah batch generate.

Risiko debug:
- Jika situs tidak muncul, cek apakah `/api/sites/generate` berhasil menyimpan manifest row ke `json_sites` dan full JSON ke R2.
- Jika preview 404, cek `json_sites.business_id` sama dengan slug di URL public.
- Jika preview 502, kemungkinan D1 hanya punya manifest tetapi R2 JSON tidak bisa dibaca; cek binding `R2`, `r2_json_key`, dan object `sites/{businessId}/{businessId}.json`.

### `src/pages/admin/AdminSchema.tsx`

Fungsi:
- Menampilkan baseline JSON schema yang dipakai AI generator.

API yang dipakai:
- `GET /api/schema`
- `POST /api/schema/repair`
- `POST /api/sites/migrate-r2`

Logic penting:
- Jika API error, halaman menampilkan pesan error sebagai text di area schema.
- Tombol `Repair DB now` memanggil `/api/schema/repair`, menjalankan self-heal tabel/kolom D1, lalu menampilkan ringkasan jumlah kolom per tabel.
- Gunakan tombol ini setelah deploy ketika halaman admin berat mulai error karena kolom D1 production belum termigrasi.
- Setelah repair sukses, halaman menyimpan timestamp ke localStorage agar badge `DB repaired ... ago` muncul di admin sidebar.
- Tombol `Migrate old site JSON to R2` memanggil `POST /api/sites/migrate-r2` batch 25 row, memindahkan row lama `json_sites.json_content` yang masih full JSON ke R2, lalu mengganti D1 dengan manifest kecil.

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
- Section `Prospect Scoring` menyimpan preset, default threshold, dan bobot scoring ke D1 settings agar prioritas prospek bisa ditune dari UI tanpa edit kode.
- Bobot scoring memakai angka positif/negatif. Reset weights mengembalikan default dari `src/lib/prospectScoring.ts`.

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
- Inspector bisa diminimize dan di-drag agar tidak menutup navbar/preview.
- Inspector punya toggle `QA` untuk visual boundary check: `[data-wv-site-canvas]` diberi outline hijau, WebView tool UI `[data-wv-tool-ui]` diberi outline biru, dan tool yang bocor ke canvas akan terlihat merah.
- QA checklist memastikan generated site canvas ada, tool UI terdeteksi, download/setup panel berada di luar CSS website, dan demo inspector berada di luar CSS website.
- QA checklist juga memverifikasi boundary `data-wv-site-header`, boundary `data-wv-site-footer`, submenu overlay berada di luar header, tinggi/shadow navbar sesuai state top/scrolled, dan icon marker `data-wv-qa-icon` untuk `features`, `trustBar`, dan `hoursLocation`.
- Saat QA aktif, navbar diberi outline amber, footer diberi outline purple, dan icon yang diukur diberi outline biru agar style/shader preset bisa dicek visual sebelum produksi.
- Menggunakan `SiteRenderer` dengan `showProspectPanel={false}` agar demo fokus ke hasil render website.

Risiko debug:
- Jika `/demo` blank, cek apakah `resolveJsonModule` aktif di `tsconfig.json`.
- Jika section baru tidak muncul sesuai harapan, update `SiteRenderer`.
- Tombol floating demo:
  - Download Free membuat zip owner berisi `index.html` saja via `downloadOwnerSiteZip`.
  - Paket `$197 Domain + Hosting` memanggil `POST /api/payments/checkout`.
  - Jika Lemon Squeezy belum dikonfigurasi, endpoint mencatat mock checkout dan membuka link WhatsApp admin.
- Demo memiliki selector style preset dan shader preset dari `src/lib/siteStylePresets.ts` agar visual layer bisa diuji tanpa edit JSON.
- Checkout demo memakai flow domain shared dari `WebsiteActionPanel`: domain baru atau domain milik sendiri, inline check, dan email hanya setelah domain lolos pre-check.
- Download/setup action panel memakai `WebsiteActionPanel` dengan `variant="demo"`, shared dengan public preview.
- `WebsiteActionPanel` dan inline edit panel diberi `data-wv-tool-ui` agar QA boundary bisa mendeteksi apakah tool UI tidak sengaja masuk ke canvas website.

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

### `src/lib/prospectScoring.ts`

Fungsi:
- Registry default scoring prospek untuk `/admin/leads`.
- Sumber label/hint field scoring untuk `/admin/settings`.

Logic penting:
- `defaultProspectScoreWeights` berisi bobot default seperti no website verified, rating, review range, phone, US market, generated status, dan details gathered.
- `prospectScoringPresets` menyediakan preset `Balanced`, `No Website Hunter`, `US High Value`, dan `Ready to Generate`; memilih preset di Settings mengisi threshold dan weights sekaligus.
- `parseProspectScoreWeights()` membaca override JSON dari D1 settings dan fallback per-field jika ada nilai rusak/hilang.
- `scoreThresholdOptions` dipakai bersama oleh Settings dan Leads agar opsi filter tetap konsisten.

### `src/lib/siteStylePresets.ts`

Fungsi:
- Registry style preset niche untuk site builder.
- Menyediakan metadata label, industri, mood, recommended colors, dan keyword matching.
- Mengekspor CSS modifier yang diinjeksi oleh `SiteRenderer`.
- Menyediakan `siteVisualStyles`, `normalizeVisualStyle()`, dan `inferVisualStyleFromText()` untuk shape language seperti `soft-rounded`, `boxy-editorial`, `industrial-diagonal`, `clean-minimal`, dan `bold-sport`.

Logic penting:
- `inferStylePresetFromText()` dipakai CRM generate untuk memilih preset dari nama bisnis, alamat, dan Places types.
- `normalizeStylePreset()` memastikan nilai JSON yang tidak dikenal fallback ke `local-clean`.
- `inferVisualStyleFromText()` memilih visual treatment dari niche; `industrial-diagonal` memberi boxy/diagonal image edge untuk contractor/auto/security.
- `siteShaderPresets`, `normalizeShaderPreset()`, `getShaderPreset()`, dan `inferShaderPresetFromText()` mengatur shader procedural seperti `local-aurora`, `industrial-grid`, `aqua-caustics`, `organic-dapple`, `cafe-heat`, `salon-silk`, `fitness-pulse`, `legal-vellum`, dan `property-depth`.
- `siteStylePresetCss` berisi generated-site experience layer yang discoped ke `[data-wv-site-canvas]`: responsive `clamp()` spacing/type tokens, `svh`/`dvh` hero sizing, palette-derived `color-mix()` surfaces, focus rings, hover lift, image polish, animated border enhancement, scroll-view reveal, reduced-motion fallback, dan `content-visibility` untuk section offscreen.
- Shader CSS juga hidup di `siteStylePresetCss`, sepenuhnya CSS procedural dengan fallback non-`color-mix()`; export HTML memakai inline JS kecil untuk pointer variables.
- Advanced border animation membutuhkan support `conic-gradient`, `mask`, dan `@property`; tanpa support, kartu tetap memakai border/shadow biasa.
- Scroll reveal hanya aktif jika browser mendukung `animation-timeline: view()` dan user tidak memilih reduced motion.
- Shader motion tetap menghormati reduced motion karena selector global generated-site memendekkan animasi saat `prefers-reduced-motion: reduce`.

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
- `GET /api/places/history`
- `GET /api/places/photo`
- `POST /api/sites/generate`
- `POST /api/sites/migrate-r2`
- `GET /api/sites`
- `GET /api/sites/:business_id`
- `POST /api/payments/checkout`
- `GET /api/domains/check`

Logic D1:
- Binding wajib: `DB`.
- `setupTables()` membuat tabel jika belum ada.
- `addColumnIfMissing()` menjalankan migrasi ringan berbasis `PRAGMA table_info`.
- `addColumnIfMissing()` menangani duplicate-column race dan retry tanpa `DEFAULT` jika D1 menolak alter tertentu.
- Write path penting tetap defensif terhadap schema production lama: `/api/sites/generate`, `/api/payments/checkout`, `/api/places/details`, dan `/api/prospects/:placeId/selection` menjalankan self-heal kolom penting terlebih dahulu, lalu menulis dengan kolom lengkap.
- Kolom penting tidak boleh diam-diam dilewati. Jika `ALTER TABLE` gagal atau kolom masih hilang setelah self-heal, Function mengembalikan error eksplisit agar schema D1 diperbaiki, bukan menyimpan data setengah lengkap.
- `/api/stats`, `/api/activities`, dan `/api/settings` punya fallback JSON agar admin tidak blank saat DB belum sempurna.

Logic AI:
- OpenRouter/OpenAI/Opencode memakai format Chat Completions.
- Gemini memakai endpoint Google Generative Language.
- KIE.ai mendukung:
  - `kie/gpt-5-5` via `https://api.kie.ai/codex/v1/responses`
  - `kie/gpt-5-2` via `https://api.kie.ai/gpt-5-2/v1/chat/completions`
  - `kie/gemini-3.1-pro` via `https://api.kie.ai/gemini-3.1-pro/v1/chat/completions`
  - `kie/gemini-3-flash` via `https://api.kie.ai/gemini-3-flash/v1/chat/completions`
- Jika request `/api/sites/generate` membawa `requireAi: true`, Function gagal eksplisit saat AI key hilang, provider/model tidak valid, provider mengembalikan HTTP error, response kosong, atau JSON invalid. Flow `/admin/sites` untuk prospect gathered sekarang mengirim fallback `jsonContent`, sehingga tidak memakai `requireAi: true` dan tetap bisa menyimpan situs saat AI provider gagal.
- Saat `jsonContent` scaffold dikirim ke `/api/sites/generate`, AI tidak lagi diminta mengembalikan full website JSON. Function membuat `copyTargetBrief` yang hanya berisi fakta bisnis dan target teks yang bisa diperbaiki, lalu meminta AI mengembalikan copy patch kecil berisi `metaCopy`, `hero`, `sections`, `offers`, `offerings`, `faq`, `conversion`, dan `footer`.
- Full scaffold JSON tidak dikirim ke AI. AI tidak melihat image URL, maps URL, navigation href, sourceData mentah, palette, font, visual style, favicon, CSS, storage, atau field protected lain.
- Copy patch AI di-merge deterministik oleh Function lewat `applyAiCopyPatch()`. AI tidak boleh mengubah `pageId`, `detailPageId`, navigation href, sourceData, photo URL, contact/maps fields, palette, font, visual style, storage, atau favicon.
- Jika submitted JSON lama belum punya `design.shaderPreset`, Function mengisi shader procedural dari niche/context via `shaderPresetForBusiness()` sebelum menyimpan site.
- Function membuat audit granular dari target copy sebelum patch dan copy final setelah patch. Audit ini disimpan di `generation_jobs.metadata_json.copyAuditSummary` dan `copyAuditItems`, dengan status `ai_rewritten`, `ai_filled_blank`, `source_kept`, `fallback_source`, atau `missing_after`.
- Jika copy patch AI sukses, `meta.generatedWithAi=true` dan `meta.generationMode=ai_copy_patch`; jika gagal dan `requireAi` false, scaffold/fallback JSON tetap disimpan dengan `submitted_json_ai_fallback`.
- Setelah AI/fallback selesai, Function menjalankan `ensureGalleryPage()` agar generated sites otomatis mendapat gallery page dari foto Places/brand/offers bila minimal dua gambar tersedia, meskipun model AI lupa membuatnya.

Logic Google Places/logo:
- `/api/places/search` memakai Google Places Text Search.
- `/api/places/photo` mem-proxy Google Places Photo agar frontend bisa membaca pixel untuk palette.
- `brandPalette` dan `selectedLogoImageUrl` dikirim dari `AdminLeads` ke generator.
- `selectedLogoReference`, `selectedLogoSource`, `selectedLogoAttributions`, dan `selectedLogoPriority` ikut dikirim agar JSON final menyimpan provenance foto.
- Function memaksa `businessId` masuk ke `meta.businessId` dan menjaga `logoImageUrl` jika dipilih admin.
- Function menganggap `https://www.google.com/maps/search/?api=1&query=...` sebagai URL fallback lemah. Saat Place Details memberi `url` exact, Function menimpa `sourceData.googleMapsUri`, `businessProfile.contact.directionsUrl`, dan `location.directionsUrl`.
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
- D1 `json_sites` tidak lagi menyimpan full JSON untuk situs baru jika R2 tersedia. D1 hanya menyimpan manifest/summary kecil di `json_content`, plus `r2_json_key`, `r2_json_url`, dan `json_summary`.
- `GET /api/sites/:businessId` membaca full JSON dari R2 jika row D1 punya `r2_json_key`; row lama yang masih menyimpan full JSON di D1 tetap dibaca sebagai fallback.
- `GET /api/sites` memakai `json_summary`/manifest dari D1 untuk list admin, sehingga tidak perlu membaca full JSON R2 untuk setiap row.
- `POST /api/sites/migrate-r2` adalah maintenance action untuk row lama: upload full JSON D1 ke R2, update `storage.r2JsonKey`, lalu replace `json_content` dengan compact manifest. Jika R2 belum binding, endpoint gagal eksplisit.

Risiko debug:
- Jika asset tidak bisa dibuka, cek custom domain R2 `assets.webview.click`, bucket public/custom domain setting, dan env `R2_PUBLIC_BASE_URL`.
- Asset yang hanya berupa filename lokal tidak bisa di-upload karena tidak ada binary sumber; Function hanya memastikan namanya mengandung slug.
- Jika R2 sync gagal saat generate, Function menyimpan `storage.r2SyncError` dan tetap lanjut menyimpan JSON ke D1.

Logic Places Cache:
- `places_search_cache` menyimpan response `GET /api/places/search` selama 30 hari.
- `GET /api/places/search?query=...` membaca cache jika masih valid.
- `GET /api/places/search?query=...&refresh=1` melewati cache dan menyimpan response terbaru.
- `GET /api/places/search?query=...&websitePrecheck=1&precheckLimit=10` menjalankan Place Details minimal untuk hasil teratas supaya `website_check_status` diketahui sejak list/search.
- `GET /api/places/history?limit=30` mengembalikan daftar search term cache, summary progress, dan daftar prospects yang dihydrate dari `places_prospects` berdasarkan `place_id`.
- `POST /api/places/cache/trim` menghapus cache lama/expired; body: `{ "olderThanDays": 30 }`.

Logic Prospect Drafts:
- `places_prospects` menyimpan result Places per `place_id`.
- Search dan mock search memanggil upsert prospect draft.
- Place Details memperbarui `details_json`, phone, website, maps URL, `website_check_status`, `website_checked_at`, dan `details_loaded_at`.
- Website pre-check memperbarui `phone`, `website_url`, `maps_url`, `website_check_status`, dan `website_checked_at` tanpa menandai `details_loaded_at`, sehingga admin tetap perlu `Gather data` sebelum generate.
- `GET /api/prospects` menerima filter `status`, `website=none|unknown|has|all`, `minRating`, `minReviews`, `city`, `state`, dan `niche`.
- `PUT /api/prospects/:placeId/status` mengubah status workflow (`new`, `details_loaded`, `site_generated`, `contacted`, `skipped`).
- `PUT /api/prospects/:placeId/selection` menyimpan selected Google Places photo metadata, selected palette, dan `paletteOptions`.

Logic Generation Jobs:
- `generation_jobs` mencatat setiap request `/api/sites/generate` dengan status `running`, `success`, atau `failed`.
- `generation_jobs.metadata_json` menyimpan audit generate: `copyBriefHash`, `copyPatchHash`, `copyPatchApplied`, ringkasan/item audit copy AI (`copyAuditSummary`, `copyAuditItems`), provider/model, dan failure metadata bila generate gagal.
- Jika generate sukses, prospect draft diupdate ke `site_generated` dan `generated_business_id` diisi.
- Jika generate gagal, `generation_jobs.error` dan `places_prospects.last_error` diisi agar admin bisa melihat error di UI.
- `GET /api/generation-jobs` mendukung query `limit` (1-500, default 100), `offset` (default 0), `q`, `status=running|success|failed`, `patch=applied|fallback`, `aiRewrite=zero`, dan `counts=1`.
- Quick panel Jobs di `/admin/leads` memakai `limit=100`; halaman penuh `/admin/jobs` memakai `limit=200`.
- Jika `counts=1`, endpoint mengembalikan `{ jobs, counts }` supaya badge filter tetap global walaupun rows sedang difilter server-side.
- Jika `q` dikirim bersama `counts=1`, counts dihitung dalam scope search query tersebut.
- `/admin/jobs` memakai `offset` untuk tombol `Load more`; quick drawer `/admin/leads` tetap tanpa pagination agar ringan.
- Panel Jobs menampilkan fingerprint pendek `brief:{8 chars}` dan `patch:{8 chars}` dari `copyBriefHash`/`copyPatchHash`, plus badge `patch applied` atau `fallback only`.
- Panel Jobs punya action `Retry current brief` dari row dan drawer detail: UI menghitung hash `GET /api/sites/:businessId/copy-brief` saat ini, membandingkannya dengan `generation_jobs.metadata.copyBriefHash`, lalu memberi warning inline jika brief berubah. Klik kedua (`Retry anyway`) membuat job baru memakai brief/current site JSON terbaru.
- Drawer detail menampilkan `AI copy audit` untuk job baru: jumlah source sentence yang dikirim, jumlah yang diubah/diisi AI, jumlah fallback/kept, dan daftar per field dengan source copy versus final copy.
- Panel Jobs punya filter `All`, `Failed`, `Fallback`, `Patch`, dan `No rewrite`; di halaman penuh filter memakai server/D1, sedangkan quick drawer menyaring row yang sudah loaded.
- Panel Jobs dirender sebagai compact table dengan kolom Job, Status, Model, Brief hash, Patch hash, dan Action agar status/retry lebih mudah discan saat job history panjang.
- `/admin/jobs` menambahkan sort lokal `Newest`, `Failed first`, `Fallback first`, `Patch applied first`, dan `No AI rewrite first`; quick drawer `/admin/leads` memakai sort yang sama.

Logic Owner HTML Export:
- `src/lib/exportSiteHtml.ts` membuat zip owner berisi hanya `index.html`.
- Export menghapus `<script>` internal, `.hide-in-export`, dan `[data-export-remove="true"]`.
- Export tidak menyertakan `site-data.json` karena JSON internal hanya untuk generator WebView.click.
- Export menyertakan inline script owner untuk tab navigation, fixed overlay submenu hover/positioning, compact-on-scroll header, contact `mailto:`, dan shader pointer CSS variables (`--wv-pointer-x`, `--wv-pointer-y`) agar shader procedural tetap responsif di file HTML statis.
- Export mengambil gambar yang sedang tampil di DOM, menyimpannya ke folder `/img` di dalam zip, lalu mengubah `<img src>` menjadi path relatif seperti `img/{businessId}-hero.jpg`. Ini termasuk foto Google Business Profile yang sedang diproxy via WebView.click saat tombol download diklik, sehingga HTML owner tidak perlu hotlink ke Google atau Function WebView.click untuk gambar.
- Export menambahkan `README-FIRST.txt` sebagai ringkasan done-for-you `$197/year`, lalu `SETUP-GUIDE.txt` sebagai panduan teknis self-hosting domain/hosting/DNS/upload/SSL/maintenance.
- Kedua file `.txt` tersebut menyertakan URL preview/download asli (`window.location.href`) supaya owner bisa kembali ke halaman tempat zip dibuat.
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
- `design` berisi `stylePreset`, `stylePresetConfig`, `visualStyle`, `visualStyleConfig`, dan `styleSystem.allowedPresets` agar AI memilih nuansa niche serta shape/image treatment yang valid.
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
