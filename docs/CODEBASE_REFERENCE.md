# WebView.click Codebase Reference

Terakhir diperbarui: 31 Mei 2026.

Dokumen ini menjelaskan isi, fungsi, dan logic utama tiap laman/komponen agar debugging berikutnya tidak mulai dari nol.

## Routing

File: `src/App.tsx`

Routes utama:
- `/` -> `HubPage`
- `/demo` -> `DemoSite`
- `/audit/:businessId` -> `MarketingAuditViewer`
- `/admin` -> `AdminLayout` + `AdminDashboard`
- `/admin/leads` -> `AdminLeads`
- `/admin/jobs` -> `AdminJobs`
- `/admin/sites` -> `AdminSites`
- `/admin/orders` -> `AdminOrders`
- `/admin/schema` -> `AdminSchema`
- `/admin/settings` -> `AdminSettings`
- `/:businessId` -> `PublicViewer`

Cloudflare Pages SPA fallback:
- `public/_redirects` berisi `/* /index.html 200` agar direct open/refresh untuk `/demo`, `/audit/*`, `/admin/*`, dan `/:businessId` tetap masuk ke React app, bukan Pages static 404.
- `public/_routes.json` tetap membatasi Pages Functions ke `/api` dan `/api/*`, sehingga fallback SPA tidak membuat semua route menjadi Function invocation.

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
- Navbar dan CTA memakai icon lucide. Desktop menu labels are compact uppercase text; if `locationServed` / `servedAreas` data exists, renderer adds an `Areas Served` nav/footer link and a crawlable homepage section listing the service areas.
- Navbar product/service submenu memakai hover persistence agar dropdown tidak langsung hilang saat cursor bergerak ke child menu.
- Desktop submenu dirender sebagai fixed overlay sibling setelah header, bukan child layout di dalam header, agar navbar tidak membesar saat submenu terbuka.
- Header default lebih lega di posisi top, lalu berubah compact dengan `data-wv-header-compact` setelah scroll; export owner HTML mengaktifkan behavior yang sama via inline JS.
- Header memakai grid 3 kolom `brand | centered nav | CTA` di desktop supaya menu tetap center terhadap seluruh navbar. Nama bisnis panjang ditruncate di rail kiri, bukan mendorong menu ke kanan.
- Header/submenu memakai preset layer berbasis CSS variables di boundary `data-wv-site-header` / `data-wv-site-submenu`: `soft-glass`, `authority-bar`, `industrial-rail`, `warm-translucent`, atau `energy-band`, sehingga navbar cocok dengan niche style tanpa mewarisi efek body/card generated site.
- Pergantian tab menjalankan scroll-to-top.
- Anchor menu lama seperti `#contact` diprioritaskan ke page `contact` jika ada. Jika JSON belum punya contact page/form, renderer otomatis menambahkan page `contact` berisi `contactForm` dari data phone/email/address/hours; fallback terakhir baru mencari section semantik `contactForm`/`hoursLocation`, id yang berakhir `-contact`, atau marker `data-wv-contact-section`.
- Hero buttons dari JSON lama yang punya `href` kosong atau `#` diberi fallback di renderer: label call/phone memakai `tel:` bila nomor tersedia, sedangkan estimate/request/schedule/contact diarahkan ke section/page contact. Renderer juga merapikan orphan lowercase letter di akhir hero subheadline lama yang sudah pernah terpotong.
- Section renderer mendukung `hero`, `trustBar`, `features`, `offers`, `reviews`, `hoursLocation`, `faq`, `textImageBlock`, `teamGrid`, `gridCards`, `imageGallery`, dan `contactForm`. Hero sections now use the available business photo as a soft background layer behind a readable text panel while keeping the main image frame visible/editable.
- Hero section memberi marker `data-wv-hero-section` dan `data-wv-hero-heading`; renderer memakai ResizeObserver + font-ready check untuk mencari ukuran H1 terbesar yang tetap maksimal sekitar tiga baris. Logic ini mengukur line rectangles dari rendered text supaya heading bisa membesar sampai line terlebar memakai cukup ruang (`~84%` desktop, `~78%` mobile) saat memungkinkan, dengan cap `~162%` desktop / `~136%` mobile, dan mengecilkan hanya saat perlu.
- Hero H1 pada halaman detail produk/layanan yang memiliki `offeringDetail` diformat title case dengan stop words tetap lowercase, sehingga individual service page tidak menampilkan heading lower-case dari type/query Google.
- `hoursLocation` memakai `content.hoursTitle` / `content.openingHoursTitle` atau fallback label `Business Hours` / `Jam Operasional` untuk card jam, bukan `content.title`, agar tidak dobel dengan card `Location & Contact`. Jam Google Places juga diringkas per kelompok jam yang sama dan menonjolkan jam hari ini.
- Heading pair pada `hoursLocation` memakai marker `data-wv-hours-location-heading` dan CSS variable panjang teks agar dua card tetap simetris, satu baris, dan menyesuaikan ukuran saat font pairing display terlalu lebar.
- Renderer otomatis menambahkan aggregate page `services` jika JSON punya `products`, `services`, atau `offers` tetapi belum punya `pageId: "services"`. Page ini menampilkan daftar semua produk/layanan dan tiap card tetap link ke detail page masing-masing.
- Post-process generated site otomatis menambahkan page `about` jika belum ada. Page ini masuk navbar setelah Home dan menerima AI copy patch lewat section IDs `about-hero`, `about-values`, dan `about-approach` saat AI regenerate/copy retry berjalan.
- Renderer otomatis menambahkan page `contact` dengan form mailto jika JSON lama hanya punya contact section di homepage/detail page, supaya header/footer/hero `#contact` membuka page kontak sendiri terlebih dulu.
- Renderer otomatis menambahkan page `feedback` jika JSON belum punya, tetapi tidak memasukkannya ke navbar. Footer menampilkan link Feedback supaya visitor tetap bisa membuka page ini tanpa memenuhi navbar. Page ini meminta rating 1-5; rating 4-5 membuka Google Review exact place jika `sourceData.placeId` tersedia, sedangkan rating 1-3 membuka form feedback yang dikirim via `mailto:` ke email bisnis.
- Hash awal seperti `#feedback` dibaca saat renderer mount, termasuk page feedback yang ditambahkan otomatis.
- Feature grid cards dirender center-aligned: icon, title, dan body berada di tengah card agar tampilan lebih rapi seperti demo.
- Trust bar dan feature icons dirender sebagai SVG langsung tanpa wrapper background agar icon tidak terlihat mengecil; icon subheading `hoursLocation` memakai ukuran relatif heading.
- Grid marketing 3 kolom seperti offers, reviews, dan generic grid cards memakai content text-center agar komposisi tiap card lebih seimbang.
- Offer/service cards di homepage memakai `offer.href` atau `offer.detailPageId` sebagai full-card link menuju halaman detail; `offer.cta.href` hanya menjadi fallback jika tidak ada detail link. CTA button hanya dirender jika tidak duplikatif dengan full-card link, dan price/action text seperti `Contact for estimate` diarahkan ke contact action. Card headings dan individual offering detail headings dirapikan dengan title case sambil mempertahankan stop words dan kata uppercase.
- Review cards memakai quotation marks dekoratif sebagai `wv-heading` spans kiri/kanan, sehingga mengikuti font heading aktif tanpa memakai heading tag.
- Renderer membaca schema baru: `brand`, `businessProfile`, `trust`, `offers`, `capabilities`, `location`, `hours`, dan `conversion`.
- Renderer mendukung `conversion.pagePattern`, `conversion.primaryAction`, `conversion.primaryActionReason`, `conversion.proofBadges`, dan `conversion.conversionAudit` yang diisi oleh post-process generation. Hero menampilkan proof badges source-safe di area above-the-fold saat tersedia.
- Renderer membaca deterministic design intent dari `design.designIntent` / top-level `design.compositionPattern`, `design.heroLayout`, `design.mediaStrategy`, `design.proofTreatment`, `design.cardDensity`, `design.ctaTreatment`, `design.sectionRhythm`, `design.detailLayout`, dan `design.motionLevel`. Nilai ini menjadi `data-wv-*` attributes/class di `[data-wv-site-canvas]`, mengubah hero layout, proof strip, media frame, offer card density, and final CTA treatment tanpa AI tambahan.
- Renderer membaca `design.stylePreset` untuk niche style modifier dan `design.visualStyle` / `design.shapeStyle` untuk shape/image treatment. Registry dan CSS preset ada di `src/lib/siteStylePresets.ts`.
- Renderer membaca `design.shaderPreset` dan `design.shaderConfig`; registry shader procedural ada di `src/lib/siteStylePresets.ts` dan guide teknis di `docs/SHADERS_GUIDE.md`.
- Renderer membaca `design.fontPairing` dan `design.fontPairingConfig`; registry Google Font pairing ada di `src/lib/fontPairings.ts` dan ringkasannya di `docs/FONT_PAIRING_GUIDE.md`.
- Root `#rendered-site` hanya menyimpan CSS variables palette aktif; website client dirender di child `[data-wv-site-canvas]` dengan class `wv-preset-*` dan `wv-visual-*`.
- Tool UI seperti floating `Edit`, `WebsiteActionPanel`, demo inspector, download/domain/setup controls berada di luar `[data-wv-site-canvas]` agar tidak terkena CSS website. Replace-image overlay berada di image frame saat edit mode dan dibuang dari export dengan `data-export-remove`.
- Font pairing aktif hanya diterapkan ke `[data-wv-site-canvas]`; panel/tools tetap memakai style app.
- Shader layer dirender sebagai inert `<div data-wv-site-shader>` di dalam `[data-wv-site-canvas]`; pointer JS hanya mengubah CSS variables `--wv-pointer-x`/`--wv-pointer-y`.
- Header website diberi `data-wv-site-header` dan CSS kompaktornya sendiri agar style/shader experience layer tidak membuat navbar ikut melebar/meninggi. Variabel seperti `--wv-header-bg`, `--wv-header-shadow`, `--wv-header-submenu-bg`, dan `--wv-header-treatment` didefinisikan di `src/lib/siteStylePresets.ts`.
- `data-wv-tool-ui` punya reset typography di renderer; inline toolbar B/I/U memakai marker khusus `data-wv-format-toolbar` karena posisinya menempel di editable text dalam canvas website.
- Gambar dirender sebagai `<img>` jika URL usable (`http`, `/`, atau `data:`); filename placeholder tetap ditampilkan sebagai fallback supaya preview tidak blank.
- Untuk gambar Google Places, renderer menampilkan attribution overlay dari `brand.photoCaption` dan `brand.photoAttributions`.
- `conversion.stickyMobileCta` menampilkan CTA sticky di mobile.
- Section `finalCta` dirender sebagai high-ticket CTA band bersama untuk `/demo`, `/:businessId`, dan export DOM. Band ini memakai `content.primaryCta`, `content.secondaryCta`, `content.proofLine`, dan `content.proofBadges` untuk mengulang primary action tanpa membuat klaim palsu.
- Footer dirender lebih lengkap: brand/about, sosial, halaman, highlights/offers, kontak, alamat, dan jam operasional jika tersedia.
- Footer diberi boundary `data-wv-site-footer` agar tetap memakai palette/font site tetapi terlindung dari efek card/body/image hover yang tidak cocok untuk konteks footer.
- Footer column labels seperti Pages/Highlights/Contact memakai class `wv-heading` dengan ukuran sedikit lebih besar dari body text agar display/heading font terbaca intentional tanpa mengubah struktur semantik.
- Footer highlights memprioritaskan `products + services` daripada `offers`, supaya link footer menuju halaman detail `detailPageId` masing-masing. Jika tidak ada produk/layanan, footer fallback ke offers/capabilities.
- Footer contact column merangkum jam operasional dari `hours.regular` memakai grouping yang sama dengan card homepage, misalnya `Mon-Sat: Open 24 hours` dan `Sun: Closed`, bukan menampilkan weekday mentah dari Google satu per satu.
- Product/service labels in navbar submenu use `navLabel`/`shortLabel` when available, with a deterministic short fallback from title so dropdowns do not reuse long detail-page headings. Footer highlights still title-case the full offering title while preserving the underlying `detailPageId` target.
- Nomor telepon dirender sebagai `tel:` link dan email sebagai `mailto:` link.
- Contact form membuat `mailto:` URL berisi nama, email, pesan, dan semua field form yang diisi.
- Visitor action panel untuk download/setup dirender lewat shared component `WebsiteActionPanel`, bukan logic lokal di renderer.
- Fallback section unknown tampil sebagai label `[Section: type]`, supaya schema baru tidak membuat halaman blank.
- Text utama di renderer dibungkus dengan shared `EditableText`, tetapi edit mode default off supaya teks normal bisa di-select/copy. Tombol floating `Edit` di `/demo` dan `/:businessId` memakai capsule styling yang sama dengan `Download / Setup`, mengaktifkan contentEditable, membuat CTA/button labels editable, membuat semua site icons clickable untuk memilih icon dari searchable picker, dan juga membuat image frame bisa diklik untuk replace gambar lokal atau restore ke original. Text edits tersimpan di localStorage per business/page/text key; icon overrides tersimpan di localStorage per business/icon key; replaced images tersimpan di localStorage per business/image key dan ikut masuk ke download HTML/zip setelah refresh browser.

Risiko debug:
- Jika UI demo/public berbeda dari ekspektasi, cek mapping section di file ini dulu sebelum mengubah `PublicViewer`.
- Jika menambah `section.type` baru di JSON, tambahkan renderer di file ini dan update dokumen ini.
- Jika hero H1 masih menjadi empat baris pada font/viewport tertentu, cek selector `data-wv-hero-heading` dan CSS variable `--wv-hero-heading-size` di `SiteRenderer`.
- Jika tool UI berubah mengikuti website, pastikan elemen tool tidak masuk ke `[data-wv-site-canvas]`.

### `src/components/EditableText.tsx`

Fungsi:
- Inline light text editor untuk preview owner di `/demo` dan `/:businessId`.
- Memakai native `contentEditable`, bukan dependency editor tambahan.

Logic penting:
- Setiap teks punya key `webview.inlineText.{businessId}.{page}.{field}` di localStorage.
- Site icon overrides disimpan sebagai JSON map di `webview.inlineIcons.{businessId}`. Renderer masih membaca legacy `webview.inlineButtonIcons.{businessId}` sebagai fallback supaya pilihan CTA lama tidak hilang. Picker berisi icon praktis untuk site seperti home, info, image/gallery, call, email, map, message, schedule, quote, service, review, social, customer/team, delivery, repair, trust, website, dan check; opsi `Auto` menghapus override agar icon kembali mengikuti label/href/konteks.
- Image replacements disimpan sebagai JSON map di `webview.inlineImages.{businessId}`. File lokal owner dikecilkan client-side ke JPEG max-side 1600px sebelum disimpan sebagai `data:` URL, supaya lebih mungkin muat di localStorage, persist setelah refresh, dan tetap dibundel ulang ke `img/` saat export zip. Restore original menghapus key image tersebut dari map dan menghapus seluruh storage key jika tidak ada replacement tersisa.
- `enabled=false` merender teks biasa yang selectable/copyable; `enabled=true` baru mengaktifkan `contentEditable`, ring edit, dan toolbar.
- Toolbar kecil mendukung bold, italic, dan underline via browser command.
- Toolbar diberi `data-wv-format-toolbar` dan `data-wv-format-command` per tombol supaya typography/action button tidak mewarisi font/style website client.
- Paste dipaksa plain text agar HTML asing tidak ikut masuk.
- Export HTML membersihkan atribut `contenteditable`, toolbar, temporary icon edit affordance, dan replace-image overlay lewat `src/lib/exportSiteHtml.ts`, tetapi isi teks hasil edit dan SVG icon pilihan tetap ikut karena sudah ada di DOM. Exporter juga mengambil `data:` image hasil replacement owner, menyimpannya ke folder `img/` dalam zip, lalu mengganti `src` HTML ke path file lokal; inline CSS `url(...)` yang cocok dengan gambar terpaket ikut diarahkan ke path lokal supaya hero background layer tidak bergantung pada URL preview.

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
- Tooltip bubble dirender via `createPortal(document.body)` sebagai fixed layer `z-[100001]`, sehingga tetap berada di foreground walau parent card/modal punya `overflow-hidden` atau stacking context.
- Posisi tooltip dihitung dari anchor dan ikut update saat scroll/resize; jika ruang atas sempit, tooltip muncul di bawah anchor. Center position clamps against tooltip width so sidebar/edge icons do not push the bubble off-screen.
- Admin pages memakai `HelpTooltip` untuk menjelaskan kontrol yang efeknya tidak langsung terlihat, seperti API keys, scoring, generation jobs, schema repair, R2 migration, search filters, batch generate, dan regenerate.

### `src/components/HoverTooltip.tsx`

Fungsi:
- Shared wrapper tooltip untuk elemen yang sudah punya bentuk sendiri, seperti badge, button, swatch warna, hash, dan link.

Logic penting:
- Dipakai untuk mengganti atribut browser `title=` pada UI React agar tooltip konsisten dengan desain admin/public app.
- Jika `text` kosong, wrapper merender children langsung tanpa tooltip; ini menjaga conditional tooltip seperti disabled placeholder buttons tetap sederhana.
- Tooltip bubble juga dirender via portal body-level fixed layer `z-[100001]`, supaya tidak tertutup parent, modal, drawer, table overflow, atau card `overflow-hidden`.
- Center position clamps against measured tooltip width, so icon-only actions near the left or right browser edge stay readable.
- Untuk tooltip berbentuk icon/help text gunakan `HelpTooltip`; untuk tooltip pada elemen existing gunakan `HoverTooltip`.

### `src/components/AdminSidebarFlyout.tsx`

Fungsi:
- Shared flyout label untuk sidebar `/admin`, bukan tooltip generik.
- Meniru pola lama sidebar: panel muncul fixed relative ke icon di sisi kanan sidebar, tidak memakai portal, dan tidak menutup icon lain seperti tooltip floating.

Logic penting:
- Dipakai oleh `AdminLayout` untuk route icons, DB repair badge, docs/book icon, dan sign-out.
- Menerima `label`, optional `description`, dan `widthClass`.
- Menggunakan `group-hover`/`group-focus-within` agar behavior konsisten dengan old nav flyout tetapi tidak copy-paste span tooltip di setiap icon.

### `src/components/AdminCollapsibleSectionHeader.tsx`

Fungsi:
- Shared header untuk card/section admin yang bisa expand/collapse.
- Menjaga pola visual konsisten: icon kiri sebelum heading, `HelpTooltip` dekat heading, action icons hanya tampil saat section expanded, dan chevron tetap di sisi kanan header.

Logic penting:
- Dipakai oleh `/admin/settings` untuk semua section collapsible seperti AI Provider, Google Places, Offer & Conversion, Payment Setup, Domain Registrar, Prospect Scoring, dan Estimator Biaya AI.
- `actions` dirender hanya saat `open=true`, sehingga docs/book/reset controls tidak memenuhi header collapsed.
- Klik area title dan chevron sama-sama memanggil `onToggle`; chevron punya `aria-expanded` dan label collapse/expand.

### `src/components/GenerationJobsTable.tsx`

Fungsi:
- Shared table untuk generation jobs, dipakai oleh quick drawer `/admin/leads` dan halaman penuh `/admin/jobs`.
- Menghindari duplikasi logic filter/sort/retry agar kedua UI tidak drift.

Logic penting:
- Komponen sendiri yang mengambil `GET /api/generation-jobs?limit=...`, menghitung counter filter, menyimpan filter/sort ke localStorage berdasarkan `storageKeyPrefix`, dan menjalankan retry job.
- Dalam `serverBackedFilters` mode, perubahan filter `Failed`, `Preflight blocked`, `Fallback`, `Patch`, `No rewrite`, atau `Low service copy` memanggil endpoint dengan `status=failed`, `preflight=blocked`, `patch=fallback`, `patch=applied`, `aiRewrite=zero`, atau `offeringCoverage=low`, bukan hanya menyaring rows yang sudah loaded.
- Dalam `serverBackedSearch` mode, search box mengirim `q` ke server untuk mencari `business_id`, `place_id`, job `id`, nama prospect, dan metadata JSON.
- `initialSearchQuery` dan `openJobId` dipakai oleh `/admin/jobs?job=...&q=...` untuk membuka drawer job tertentu dari deep link, sambil mereset filter ke `All` supaya row sukses/gagal tidak tersembunyi oleh filter lama.
- Full page mode menampilkan `Load more` jika rows loaded masih lebih sedikit dari count server; tombol ini memanggil endpoint dengan `offset={loadedRows}` lalu append ke tabel.
- Kolom Job menyediakan tombol copy kecil untuk Job ID dan Business ID; saat sukses icon berubah menjadi check sementara.
- Kolom Action punya tombol `Details` yang membuka drawer kanan berisi status, provider/model, business/place IDs, timestamps, raw error, provider failure diagnostics, retry dari drawer, audit copy AI, dan raw `metadata` JSON dengan tombol copy.
- Drawer details punya icon-only docs quick link yang membuka admin workflow/generation job QA docs langsung di `AdminDocsReader`.
- Row action naming separates `Provider details` from `Job details`: provider details opens the readiness popover, while job details opens the right-side generation job drawer with chunked retry controls.
- Untuk job `metadata.chunked=true`, drawer menampilkan progress `Outline`, `Site copy`, `Service copy`, dan `Finalize` plus tombol `Retry/Run` per step yang memanggil `POST /api/generation-jobs/:jobId/run-step`, supaya admin bisa melanjutkan step gagal tanpa membuat generation job baru.
- Stale/running chunked rows can show direct `Resume Outline/Site copy/Service copy/Finalize`; failed chunked rows show `Retry ...`, so partial retry is available from the table without finding the control inside the drawer.
- Manual retry step otomatis mencoba ulang satu kali setelah 60 detik untuk error transient seperti HTTP 502/503/504/524, Cloudflare HTML response, temporary provider failure, upstream network failure, or empty response. Non-transient provider/model/key errors tetap gagal eksplisit.
- Step `Service copy` sekarang micro-batched: UI tetap memanggil visible step `offeringCopy`, tetapi hook retry terus memanggil request berikutnya selama response masih `nextStep: "offeringCopy"`. Row/drawer menampilkan progress `service copy cursor/total` dari metadata supaya slow-provider progress terlihat.
- Chunked step derivation lives in `src/lib/generationJobState.ts`, with targeted tests in `tests/generationJobState.test.ts`; run `npm run test:generation-job-state` when local dependencies are installed.
- Drawer details UI now lives in `src/components/generation-jobs/GenerationJobDetailsDrawer.tsx`, retry orchestration lives in `src/components/generation-jobs/useGenerationJobRetry.ts`, and reusable job badges/filter/sort/copy-audit helpers live in `src/components/generation-jobs/jobUtils.ts`. `GenerationJobsTable` keeps data loading, search/filter state, visible table rendering, and selected-job state.
- Drawer details menampilkan `AI returned work` untuk parsed `offeringOutline`, combined `copyPatch`, `siteCopyPatch`, dan `offeringCopyPatch` dari job metadata, dengan tombol copy. Ini adalah surface utama untuk melihat output model sebelum patch diaplikasikan ke JSON final.
- Drawer details menampilkan panel `About/nav timing` jika `metadata.aboutNavTiming` ada. Panel ini merangkum durasi `start`, `siteCopy`, `offeringCopy`, dan `finalize`, status, attempt count, current running step, error ringkas, serta collapsible recent nav-label call history agar bottleneck About/nav repair bisa dibaca tanpa membuka raw metadata.
- Job rows dan drawer menampilkan badge `services changed/total` dari `metadata.offeringCopyCoverage`, dengan tooltip breakdown summary, description, highlights, dan FAQ supaya thin service pages cepat terlihat tanpa membaca full audit.
- Job rows menampilkan badge `conversion ready` atau `conversion N flags` dari `metadata.conversionAudit`, dengan tooltip berisi page pattern, primary action, dan QA flags seperti generic CTA, missing proof, missing FAQ, thin service pages, competing CTAs, atau missing final CTA. Rows juga menampilkan badge `design ready` atau `design N flags` dari `metadata.designAudit`.
- Retry mengambil current copy brief dari `GET /api/sites/:businessId/copy-brief`, menghitung hash browser-side, lalu memperingatkan jika hash berbeda dari job lama sebelum membuat job baru.
- Retry mengirim `requireAi: true`, sehingga error provider/model/API key terlihat sebagai failed job dan pesan UI, bukan diam-diam menyimpan fallback copy.
- Rows dengan low service coverage punya action `Improve services` yang menjalankan ulang hanya chunk `offeringCopy` lalu `finalize`; action ini juga meminta `navLabel` pendek untuk submenu layanan. Rows `No rewrite` punya action `Fill missing copy` yang menjalankan ulang `siteCopy`, `offeringCopy`, lalu `finalize`; ini mengisi About page copy dan short service submenu labels tanpa rerun outline/full offering discovery. Rows chunked yang berhenti di tengah menampilkan `Resume ...` atau `Retry ...` sesuai step aktif/gagal. Jika row adalah child final save job, UI resolve `metadata.parentGenerationJobId` sebelum memanggil `run-step`. Setelah copy-only retry selesai, UI mengambil `result.generationJobId` dari finalize save response, otomatis membuka final save job baru di drawer, dan membaca before/after coverage delta dari `metadata.copyOnlyRetryCoverageDelta` agar comparison tetap ada setelah refresh.
- The job drawer has a visible right-edge drawer treatment, `Generation job drawer` header, a top `Next action` panel, visible chunk cards, collapsed `AI returned work`, and collapsed `Raw metadata` so normal retry workflow is above debug JSON.
- Tombol retry menampilkan readiness badge; provider/model berasal dari job lama jika ada, atau fallback localStorage parent, dan key status dikirim parent dari `/api/settings`.
- Retry memanggil `/api/ai/readiness` sebelum mengambil copy brief/site JSON agar model/provider/key yang salah berhenti sebelum job baru dibuat.
- `variant="compact"` dipakai di `/admin/leads`; `variant="full"` dipakai di `/admin/jobs`.
- `onJobsLoaded` dipakai parent `/admin/leads` untuk memperbarui angka pada tombol `Jobs`.
- Header, filter group, dan drawer audit copy punya tooltip ringkas yang menjelaskan arti `Fallback`, `Patch`, dan `No rewrite` supaya admin tidak perlu menebak status job.
- Compact drawer/table actions seperti search submit, export, clear search, refresh jobs, load more, close drawer, copy error/audit/metadata, retry job, details, dan retry chunk step memakai icon-only controls plus `HoverTooltip` supaya QA production tidak bergantung pada label panjang.

### `src/components/AdminAiReadinessBadge.tsx`

Fungsi:
- Shared visible readiness badge untuk tombol generate/regenerate/retry di admin.
- Menampilkan apakah klik berikutnya `AI required` atau `Data resave`, apakah key provider tersedia, dan provider/model yang akan dipakai.

Logic penting:
- Untuk action `requiresAi=false`, badge menampilkan `No AI key needed` agar admin tahu klik tersebut hanya refresh/resave data.
- Untuk action AI, status key bisa `Key present`, `Key missing`, atau `Key unknown` saat settings belum selesai dimuat.
- Untuk action AI, badge juga memanggil `/api/ai/readiness` dan menampilkan `Preflight ok`, `Model invalid`, `Provider invalid`, atau `Preflight failed`.
- Untuk action AI, badge juga memanggil `/api/ai/provider-failure` dan menampilkan chip kecil `Last fail` bila provider/model itu punya failure 14 hari terakhir, termasuk kind, HTTP status, umur failure, dan tooltip action hint.
- Badge tidak memakai browser `title` untuk pesan readiness/failure penting. Tombol `Details` membuka popover in-app dengan readiness message, remote validation, last failure, action hint, dan tombol copy agar error provider bisa dikirim ke support/debug tanpa mengetik ulang.
- Dipakai oleh `/admin/leads`, `/admin/sites`, dan `GenerationJobsTable` supaya tombol generate tidak drift dalam cara menjelaskan kesiapan AI.

### `src/components/AdminAiReadinessRefreshButton.tsx`

Fungsi:
- Tombol kecil shared untuk membersihkan cache AI readiness 30 detik dan memaksa badge readiness recheck.
- Dipakai dekat selector provider/model di `/admin/leads`, `/admin/sites`, dan estimator `/admin/settings`.

Logic penting:
- Memanggil `clearAiReadinessCache()` dari `src/lib/aiReadiness.ts`.
- Juga membersihkan cache `src/lib/providerFailure.ts` supaya chip `Last fail` ikut refresh setelah provider/model diperbaiki.
- Helper cache mengirim browser event `webview:ai-readiness-refresh`; badge yang sedang mount mendengar event ini dan langsung memanggil ulang `/api/ai/readiness`.
- Tombol default icon-only dan memakai `HoverTooltip` untuk menjelaskan bahwa cache readiness, last-failure, dan provider health akan dibersihkan tanpa menjalankan generate.

### `src/components/AdminToast.tsx`

Fungsi:
- Shared toast overlay untuk halaman admin, dipasang di `AdminLayout` agar `/admin/leads`, `/admin/sites`, dan `GenerationJobsTable` bisa menampilkan error penting tanpa browser `alert()`.

Logic penting:
- `AdminToastProvider` menyimpan maksimal 4 toast dan merender overlay fixed kanan atas dengan z-index tinggi.
- `useAdminToast().showApiError()` memakai `src/lib/apiErrorInsights.ts` untuk mengubah error provider menjadi judul, arti error, action items, dan raw message.
- `showApiError()` juga menyimpan 5 diagnostic browser-side terakhir lewat `src/lib/adminDiagnostics.ts` (`localStorage` key `webview.admin.latestApiDiagnostic`) berisi source, request path, HTTP status, provider/model, dan raw error. Reader tetap backward-compatible dengan nilai single-object lama. History ini dipakai oleh tombol copy diagnostic bundle di Dashboard.
- Error generate/regenerate/retry dari `/api/sites/generate` muncul sebagai toast, sehingga pesan seperti Gemini 429 quota tidak tersembunyi di panel/card yang harus discroll.
- Success/info action notices on `/admin/sites`, including AI copy patch regenerated, Google data resaved, first site generated, and AI readiness refreshed, also use the floating toast stack instead of an inline fixed-position page notice.
- Toast `actions` bisa berupa string guidance atau link object `{ label, href }`. String actions tetap dirender sebagai bullet, sedangkan link actions dirender sebagai tombol kecil untuk quick-open seperti `Open site` / `Open audit` setelah copy outreach.
- `src/lib/apiResponse.ts` dipakai oleh API fetch penting supaya body error non-JSON/HTML dari provider atau Cloudflare edge tetap muncul sebagai pesan actionable, bukan hanya fallback `HTTP 502` atau dump HTML. Jika response HTML Cloudflare 524, pesan eksplisit bahwa Cloudflare timeout menunggu Pages Function/provider call terlalu lama dan job bisa dilanjutkan dari chunk yang tersimpan; HTML 5xx lain tetap mengarahkan admin cek Pages deployment logs, Functions logs, dan Cloudflare Status.
- Toast raw error punya tombol `Copy warning` agar provider error lengkap, action items, dan raw message bisa disalin dari UI.
- 429/quota toast juga menulis cooldown provider ke `src/lib/providerCooldown.ts`; batch generate di `/admin/leads`, first generate/regenerate di `/admin/sites`, dan retry job membaca cooldown ini agar tidak langsung menghantam provider yang sedang exhausted.
- Browser default `alert()` tidak dipakai di admin; dev bypass sign-out memakai toast info.

### `src/components/AdminProviderCooldownBadge.tsx`

Fungsi:
- Badge kecil untuk menampilkan status cooldown provider AI di dekat selector provider/model admin.

Logic penting:
- Membaca `src/lib/providerCooldown.ts`, refresh ringan ke `/api/provider-cooldowns`, dan mendengar event `webview:provider-cooldown`, `storage`, dan `focus` agar status berubah saat error 429/quota terjadi atau tab kembali aktif.
- Saat cooldown aktif, badge menampilkan sisa waktu setiap detik dan tooltip menjelaskan bahwa batch/generate ditahan untuk menghindari repeated 429.
- Saat cooldown aktif, badge menampilkan aksi clear icon-only dengan tooltip dan konfirmasi inline. Ini menghapus cooldown localStorage dan D1 via `DELETE /api/provider-cooldowns`; tidak otomatis terjadi saat switch provider karena cooldown lama tetap melindungi session/admin lain yang masih memakai provider tersebut.
- Dipakai di `/admin/leads`, `/admin/sites`, dan `/admin/settings` supaya admin melihat cooldown sebelum klik generate/regenerate atau mengecek model.

### `src/components/AdminProviderHealthBadge.tsx`

Fungsi:
- Badge kecil untuk `/admin/settings` yang menampilkan failure rate provider/model 24 jam terakhir sebelum dipakai batch generation.

Logic penting:
- Memanggil `src/lib/providerHealth.ts` dan endpoint `/api/ai/provider-health?provider=...&model=...`.
- Menampilkan `No 24h attempts` bila belum ada job, atau `{percent}% fail · failed/total 24h` dengan warna hijau/kuning/merah berdasarkan rasio gagal.
- Tooltip menjelaskan bahwa badge hanya memakai riwayat job lokal, bukan provider metadata call baru.

### `src/components/AdminWorkspaceTabs.tsx`

Fungsi:
- Segmented tab control shared untuk workspace admin yang perlu memisahkan beberapa mode kerja dalam satu route.
- Dipakai di `/admin/leads` agar tab `Find Leads`, `Search History`, dan `CRM Pipeline` konsisten secara visual.

### `src/components/AdminDocsReader.tsx`

Fungsi:
- Popup markdown reader untuk membaca dokumentasi proyek langsung dari `/admin`.
- Dipasang sebagai icon `BookOpen` di sidebar `AdminLayout` supaya admin tidak perlu membuka GitHub/local folder saat production testing.

Logic penting:
- Daftar dokumen dan mapping route hidup di `src/lib/adminDocs.ts`.
- Markdown docs di-load dengan lazy Vite raw imports dari folder `docs/`; `src/vite-env.d.ts` menyediakan type Vite client untuk `?raw`.
- Reader menampilkan bagian `Relevant here` berdasarkan route admin aktif: dashboard, leads, jobs, sites, schema, atau settings.
- Dense admin surfaces can pass `defaultDocId` to preselect a workflow doc, such as PayPal reconciliation or generation job QA.
- `/admin/jobs` includes `docs/ADMIN_JOBS_USER_GUIDE.md` in the docs reader, and the generation job drawer opens that guide by default.
- `/admin/leads` and `/admin/sites` include `docs/GOOGLE_BUSINESS_PROFILE_MARKETING_AUDIT_PLAN.md` for the planned deterministic GBP audit, competitor comparison, PDF export, and service workflow.
- Semua docs tetap bisa dicari dari modal yang sama.
- Renderer markdown dibuat lokal dan merender teks sebagai React nodes; HTML dari dokumen tidak dieksekusi.

Risiko debug:
- Jika menambah dokumen `.md` yang perlu muncul di admin, tambahkan import dan entry di `src/lib/adminDocs.ts`.
- Jika build gagal pada import markdown, cek `src/vite-env.d.ts` dan path relatif dari `src/lib/adminDocs.ts` ke `docs/`.

### `src/components/AdminLayout.tsx`

Fungsi:
- Shell admin dengan sidebar icon navigation.
- Mengamankan halaman admin via Clerk.
- Menyediakan dev bypass jika publishable key tidak tersedia atau live key dipakai di host dev.

Logic penting:
- `NavContent` menampilkan link Dashboard, CRM Leads, Generation Jobs, Generated Sites, JSON Schema Info, dan Settings.
- Sidebar nav flyout menampilkan label dan deskripsi singkat setiap admin area lewat shared `AdminSidebarFlyout`, bukan generic `HoverTooltip`, karena menu flyout adalah bagian dari sidebar navigation dan harus muncul di kanan icon tanpa menutup icon lain.
- Saat pindah route admin, container konten dan window otomatis scroll ke atas agar tab baru tidak mulai dari posisi scroll tab sebelumnya.
- Sidebar menampilkan badge kecil `DB` setelah `/admin/schema` berhasil menjalankan `Repair DB now`; timestamp disimpan di localStorage key `webview.admin.lastDbRepairAt`.
- Sidebar menampilkan icon docs yang membuka `AdminDocsReader` dengan dokumen relevan untuk route admin aktif; di sidebar, `AdminDocsReader` mematikan generic tooltip dan dibungkus `AdminSidebarFlyout` agar visual menu konsisten dengan icon nav lain.
- `ClerkSecureLayout` hanya mengizinkan user dengan `publicMetadata.role === "admin"`.
- Jika role belum admin, halaman menampilkan instruksi update metadata Clerk.

Risiko debug:
- Jika admin terkunci, cek `VITE_CLERK_PUBLISHABLE_KEY` dan metadata user di Clerk.
- `isDevBypass` hanya fallback untuk dev/AI Studio, bukan mode auth production ideal.

### `src/components/WebsiteActionPanel.tsx`

Fungsi:
- Shared visitor action panel untuk `/demo` dan public preview `/:businessId`.
- Menangani download free, domain selection, domain availability/ownership pre-check, dan checkout setup `$180/year` hosting plus optional `$17/year` registered-domain fee.
- Floating trigger text is `Download / Setup` for both demo and public preview; pricing is shown inside the opened panel/checkout flow, not on the collapsed button.
- Checkout offer shows the value stack as infrastructure: free generated site, `$180/year` managed hosting, `$17/year` domain fee only when WebView.click registers a new domain, SSL/DNS/upload, and setup handled at no extra setup fee. Buyer-facing copy does not mention the underlying hosting provider.
- Buyer can choose 1-10 year terms before domain/payment. Prepaid terms apply package discounts of 5% at 2 years, +5% per additional year through 9 years, and 50% at 10 years, but the discount applies only to the `$180/year` hosting portion. The `$17/year` domain fee is never discounted and is removed entirely when the buyer chooses an owned domain. `annual_recurring` uses PayPal Subscriptions when PayPal API credentials are active; otherwise non-PayPal/manual rails still record the selected billing preference.
- Optional add-ons are now a separate branch before domain/payment: buyer first chooses whether they want page add/edit work, then selects counts, then fills exact page names to add and existing pages/notes to edit. `$50` per action applies, with 10% discount for 5-9 actions and 20% for 10+ actions.
- Free download card in the compact panel uses owner-benefit copy `Download your site for FREE`. It no longer immediately saves the export from the compact panel; it first opens a shared modal explaining the `$997` starter value, `$0` portfolio-sample credit, included features, generated page URLs/purposes, optional hosting/custom-page CTAs, and then shows the real buyer-facing `Download my $0 website package` button. The modal copy uses centered, larger subheadings/descriptions, and a floating `Keep scrolling to download` notice appears while the modal is not yet near the download CTA.

Props penting:
- `siteData`: dipakai untuk business name/business ID default.
- `businessId`: fallback ID checkout.
- `variant`: `demo` atau `public` untuk positioning/label kecil.
- `onDownloadZip`: callback download zip, tersedia di demo dan public preview.
- `fontPairings`, `selectedFontPairing`, `onFontPairingChange`: opsi font pairing yang cocok dengan industri agar owner bisa memilih style font sebelum download/setup.
- `paletteOptions`, `selectedPaletteOption`, `onPaletteOptionChange`: opsi palette hasil ekstraksi foto bisnis agar owner bisa memilih warna sebelum download/setup.
- Panel menampilkan kontrol font/palette dengan label dan select inline agar modal `Get this website` tetap ringkas. Kontrol `Color palette` hanya muncul jika ada lebih dari satu saved palette yang benar-benar bisa dipilih; site lama dengan satu palette tetap memakai warna tersimpan tanpa select kosong.

Logic penting:
- Domain extension list berasal dari `src/lib/domainExtensions.ts`.
- New-domain label normalizer menghapus spasi/punctuation dari nama bisnis tanpa menyisipkan hyphen, sehingga suggestion default seperti `Supreme Ready Mix` menjadi `supremereadymix.com`; hyphen yang diketik manual tetap dipertahankan.
- Domain availability memakai `GET /api/domains/check?domain=...`.
- Untuk domain baru yang lolos pre-check, panel mencoba `POST /api/domains/quote` untuk menangkap real registrar quote ke state `domainQuote`; jika credential registrar kosong/gagal, checkout tetap bisa lanjut dengan manual confirmation. Buyer-facing UI tetap menampilkan included `$17/year` domain fee, bukan wholesale registrar price.
- Checkout memakai `POST /api/payments/checkout`.
- If PayPal is active and API credentials are configured, checkout returns PayPal JS SDK data (`paypalInline`, `paypalClientId`, `paypalOrderId`), renders PayPal's button in-place, and approval calls `POST /api/payments/paypal-capture-order`.
- Payment payload mengirim `businessId`, `businessName`, `domain`, `domainMode`, domain pre-check result, optional `domainQuote`, email, add-on counts `{ newPages, editedPages }`, dan `setupRequest` detail page add/edit. Server recomputes pricing and stores sanitized setup notes/domain quote in `lead_payments.raw_json`. Pricing server-side treats `PAYMENT_USD_AMOUNT` as new-domain annual total, subtracts `PAYMENT_DOMAIN_FEE_USD` to derive hosting, removes the domain fee for owned domains, and applies term discounts to hosting only.
- Checkout modal memakai flow bertahap dengan tracker `Step X of N`: offer justification with one CTA -> term/billing -> choose either direct domain or optional page work -> add/edit details only if page actions > 0 -> domain mode/check -> email/payment. Page add/edit is optional; direct domain clears page add-ons and avoids disabled/skip-button ambiguity.
- Local checkout `InfoTooltip` uses a fixed body portal and prefers above-anchor placement so help text is not clipped by the small scrollable done-for-you setup modal.
- The shared action panel injects a scoped cursor rule for its exported-tool UI wrappers (`website-action-panel`, `website-download-modal`, `website-checkout-modal`, and owner archived overlay) so enabled buttons, links, selects, and summaries consistently show pointer cursors while disabled buttons show not-allowed.
- Domain baru memakai compact inline input: label domain, extension selector berkategori, dan tombol check dalam satu baris. Filter extension berada di panel collapsible supaya form tidak terlalu tinggi.
- Domain milik sendiri memakai input domain penuh, lalu endpoint menampilkan sinyal registrar/nameserver dari RDAP jika tersedia.
- Input domain milik sendiri memakai sanitizer terpisah dari normalizer final agar titik (`.`) tidak hilang saat user mengetik `example.com`; normalisasi final tetap menghapus trailing dot sebelum API check.
- Domain milik sendiri membutuhkan checkbox konfirmasi bahwa user memang memiliki domain dan bisa update DNS/nameserver atau memberi delegated access sebelum lanjut ke payment.
- Untuk domain milik sendiri, user diarahkan memakai managed nameservers kita atau menambah DNS record yang kita berikan jika ingin tetap memakai nameserver lama.
- Indikator hijau pada domain baru berarti `available` dari pre-check; indikator hijau pada domain sendiri berarti domain terdeteksi registered/usable untuk setup DNS, bukan tersedia untuk dibeli.
- Domain sendiri hanya bisa lanjut jika RDAP/DNS memberi sinyal registered/aktif; hasil inconclusive tetap ditahan sebagai warning.
- Checkout only writes CRM `checkout_pending` / pending `lead_payments` when the shared panel is opened from a real owner review URL (`?owner=1`, `?review=owner`, or `?claim=1`), not from normal admin preview or safe `ownerPreview=1` links. Mock checkout outside a real owner session still prepares the checkout UI but does not change CRM status/payment counts.
- Jika font pairing selector muncul, perubahan langsung diterapkan ke renderer dan export HTML mengikuti pilihan yang aktif saat download.
- Jika palette selector muncul, perubahan langsung diterapkan ke renderer dan export HTML mengikuti warna yang aktif saat download.
- `onDownloadZip(siteData)` menerima site data aktif dari panel; ini menjaga public preview `/:businessId` mengekspor palette/font yang sedang dipilih di renderer, bukan JSON awal dari fetch.
- Free download modal derives buyer-facing feature/page summaries from current `siteData`: About page, review flow, Google Maps, hours, FAQ/service details, individual service pages, gallery, contact form, SEO starter files, and page links using `/:businessId#pageId` anchors. It also adds virtual standard pages like about/services/gallery/contact/feedback when the renderer can provide them from available business data.
- The buyer-facing `Download my $0 website package` action only fires the non-blocking `POST /api/sites/:businessId/downloaded` owner ping during a real owner review session, then runs `onDownloadZip(siteData)`. The ping updates lead `download_count`/`last_downloaded_at` and inserts a `site_downloaded` CRM activity when a lead exists; admin preview downloads and safe countdown previews do not mark owner download activity.
- While `onDownloadZip(siteData)` runs, the modal button changes to `Preparing PDF guide...`, disables repeat clicks/close, and shows a small `download-progress-toast` explaining that the branded PDF guide and website files are being packaged. This matters because owner PDF rendering can take a few seconds on slower devices. Download modal overlays including the scroll notice are marked `data-export-remove`, `data-wv-tool-ui`, and/or `hide-in-export`, so they are excluded from owner HTML exports.
- Owner review links can use `?owner=1`, `?review=owner`, or `?claim=1` on `/:businessId`. On public previews only, that starts/reads a 7-day review window from `localStorage` key `webview.ownerReviewStartedAt.{businessId}` and shows a compact countdown beside `Download / Setup`; optional URL params `reviewStart`, `reviewStartedAt`, or `claimStart` can seed a fixed timestamp. If no timestamp is present, the owner-param URL is updated in-place with `reviewStart={timestamp}` so the active review link is self-describing. Admin-safe preview links use `?ownerPreview=1&reviewStart={timestamp}`; they show the same countdown UI with a `Preview mode` badge, but do not write localStorage or convert the URL into a real owner review session. After the window, the owner-param view is covered by an archived-preview overlay with a prefilled `mailto:email@codev.id` restore link containing business name, ID, preview URL, started timestamp, ended timestamp, listed phone, and listed address. Normal preview URLs without owner params stay unaffected for admin/internal use.

Risiko debug:
- Jika ada perubahan pada flow download/setup, ubah komponen ini agar `/demo` dan `/:businessId` tetap sinkron.
- Jangan menggandakan flow domain di `DemoSite` atau `PublicViewer`; keduanya harus lewat `WebsiteActionPanel`.
- Owner review countdown/archive UI is marked `data-export-remove`, `data-wv-tool-ui`, and `hide-in-export`, so it must not appear inside owner zip exports. If an admin previously opened an owner-param URL in the same browser, remove the param or clear that site-specific localStorage key to view the normal preview.

## Admin Pages

### `src/pages/admin/AdminDashboard.tsx`

Fungsi:
- Menampilkan overview CRM: total leads, conversion rate, total revenue, dan aktivitas terbaru.
- Menampilkan setup readiness ringkas untuk Google Places, AI generation, dan payment setup sebelum admin masuk workflow detail.
- Menampilkan daily usage guardrails untuk Places search, Places details, remote AI readiness, dan site generation agar admin melihat aktivitas quota-sensitive sebelum terlalu dekat batas operasional harian.
- Menampilkan panel kecil `Latest deployment logs` dari Cloudflare Pages deployment history saat Cloudflare observability credentials sudah dikonfigurasi.

API yang dipakai:
- `GET /api/stats`
- `GET /api/activities`
- `GET /api/settings`
- `GET /api/cloudflare/pages-logs?limit=80`

Logic penting:
- Response API divalidasi. Jika endpoint 500 atau return shape salah, halaman tidak crash.
- `toNumber()` memastikan `toFixed()` hanya dipanggil pada angka valid.
- Jika API bermasalah, dashboard menampilkan banner fallback dan angka kosong.
- Setup readiness membaca settings D1: Places ready jika `GOOGLE_PLACES_API_KEY` ada, AI ready jika minimal satu provider key ada, Payment ready jika Lemon Squeezy lengkap dan partial jika payment link/WhatsApp fallback ada.
- Setup readiness cards deep-link ke Settings anchors: `#settings-google-places`, `#settings-ai-provider`, dan `#settings-payment`.
- Daily usage guardrails membaca `stats.dailyUsage` dari `/api/stats`, memakai reset hari UTC, dan memberi badge `OK`, `Watch`, atau `High` berdasarkan threshold konservatif di Pages Function.
- Usage history menampilkan bar kecil 7 hari atau 30 hari dari `stats.dailyUsage.history`, sehingga spike setelah deploy, batch generation, atau perubahan workflow bisa dibandingkan langsung dari dashboard.
- Metric cards dan aktivitas terbaru punya tooltip untuk membedakan angka dashboard dari source-of-truth workflow per prospek.
- Readiness card memakai `HelpTooltip` pada heading dan setiap item agar admin tahu setup mana yang memblokir search, generation, atau checkout.
- Utility links in dense dashboard controls, such as generation-job review, use icon-only buttons with hover tooltips to reduce admin panel text noise.
- Dashboard includes docs quick links for admin workflow, setup readiness, and free-tier usage guardrails.
- `Latest deployment logs` membaca latest production deployment via Cloudflare Pages API, lalu menampilkan status/branch/commit/fetched time dan log lines. Jika credentials belum lengkap, panel menampilkan missing keys dan link ke `/admin/settings#settings-cloudflare-observability`; ini adalah deployment history logs, bukan live `wrangler pages deployment tail`.
- Panel `Latest deployment logs` memiliki tombol copy diagnostic bundle. Payload menggabungkan latest API warning dan history 5 warning terakhir dari `src/lib/adminDiagnostics.ts`/Dashboard fallback state, request path/status, deployment metadata, error/missing-credentials state, dan log lines yang sedang tampil supaya debugging edge/function failure bisa langsung ditempel ke issue/chat.

### `src/pages/admin/AdminLeads.tsx`

Fungsi:
- Mencari prospek bisnis dari Google Places.
- Memilih provider/model AI.
- Menghasilkan JSON website untuk lead.
- Mengelola status lead.
- Find Leads search is visually prominent for the US local prospecting workflow, with placeholder examples focused on niche + city + state queries such as concrete contractors, pool repair, and tree service. The route builder uses curated JSON from `src/data/usLocalProspectingMarkets.json` and `src/data/usLocalProspectingNiches.json`, fills the search box/filters, and stores per-route checklist progress in localStorage through `src/pages/admin/leads/useProspectingRoute.ts`.
- Manual Google Maps import is collapsed as a fallback path so automated search/gather/generate stays primary. Its form state, import action, and Places cache trim status/action live in `src/pages/admin/leads/useManualImport.ts`.
- CRM Pipeline punya Payment Reconciliation panel untuk recent `lead_payments`, export CSV `checkout_pending`, dan action per-lead `Verify payment`. It also has a capped phone backfill action that fills missing CRM phone numbers from saved generated site/source JSON, including R2-backed sites. Email/SMS actions use saved lead email/phone only; they no longer fall back to fake placeholders like `hello@example.com` or `+10000000000`. If contact data is missing or placeholder-like, the row shows the same compact email/SMS icon with amber unavailable styling and a diagonal slash; clicking it opens a strict inline form to save the real contact for that business.
- Payment verification modal and prospect details drawer close actions use shared hover tooltips for compact QA controls.
- Payment verification modal includes an icon-only docs quick link that opens PayPal/payment reconciliation docs directly inside admin.
- Prospect details drawer includes docs quick links for Google Places data inventory and photo strategy where those details are reviewed.
- Repeated admin utility actions are intentionally icon-only with hover tooltips and `aria-label`, including cache trim, capture helper, manual import, search-history refresh, duplicate refresh, filter reset/reload, Google refresh search, bulk select/generate/jobs, payment export/refresh, row details/skip/gather/generate, and drawer refresh/maps actions.
- AdminLeads UI/state is split under `src/pages/admin/leads/`: `ProspectingRoutePanel`, `ProspectSearchPanel`, `ManualImportPanel`, `SearchHistoryPanel`, `ManualDuplicateReviewPanel`, `ProspectFiltersPanel`, `BatchGenerateToolbar`, `ProspectCard`, `CrmPipelineTable`, `PaymentReconciliationPanel`, `PaymentVerificationModal`, `ProspectDetailsDrawer`, shared `prospectingData`, `useProspectingRoute`, `useProspectSearch`, `useManualImport`, `useProspectFiltersAndScoring`, `useManualDuplicateReview`, `useLeadCrm`, `useProspectDetails`, and `useSiteGenerationQueue`. `AdminLeads.tsx` still owns settings/provider loading, active tab selection, and high-level component wiring.

API yang dipakai:
- `GET /api/leads`
- `GET /api/prospects`
- `PUT /api/prospects/:placeId/status`
- `GET /api/settings`
- `GET /api/places/search?query=...`
- `GET /api/places/search?query=...&refresh=1`
- `GET /api/places/history`
- `GET /api/places/manual-duplicates`
- `POST /api/places/manual-duplicates/merge`
- `POST /api/places/manual-import`
- `GET /api/places/details?placeId=...`
- `GET /api/places/photo?reference=...`
- `GET /api/ai/readiness?provider=...&model=...`
- `GET /api/ai/provider-failure?provider=...&model=...`
- `GET /api/ai/provider-health?provider=...&model=...`
- `POST /api/sites/generate`
- `PUT /api/leads/:id/status`
- `GET /api/leads/payments`
- `POST /api/leads/:id/payment-verified`

Logic penting:
- Provider AI tersedia: OpenRouter, OpenAI, Gemini, KIE.ai, dan Opencode.
- Pilihan AI provider/model disimpan ke localStorage agar refresh tetap memakai pilihan terakhir.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- Jika hasil Google Places punya `photos`, admin bisa memilih salah satu sebagai logo/brand source.
- Gambar logo diambil melalui proxy same-origin `/api/places/photo`, lalu canvas browser mengekstrak palette warna dominan.
- Foto Places diurutkan best-effort: attribution yang mirip nama bisnis, lalu tanpa attribution, lalu UGC/attributed. Places API tidak menyediakan flag owner photo yang reliable.
- Palette dikirim ke `/api/sites/generate` sebagai `brandPalette`.
- Hingga 5 palette foto disimpan sebagai `brand.paletteOptions` dan dikirim ke `/api/sites/generate` sebagai `paletteOptions`.
- Saat generate, `/admin/leads` menunggu extraction `paletteOptions` dari foto Places sebelum mengirim `/api/sites/generate`, sehingga site baru lebih konsisten menyimpan pilihan warna untuk action panel/download.
- Logo yang dipilih dikirim sebagai `selectedLogoImageUrl`.
- Photo reference dan source dikirim sebagai `selectedLogoReference` dan `selectedLogoSource`.
- Attribution foto yang dipilih dikirim sebagai `selectedLogoAttributions` dan disimpan di JSON sebagai `brand.photoAttributions`.
- Admin harus menjalankan `Gather data` / Place Details sebelum `Generate Site`; tombol generate baru muncul setelah detail bisnis, foto, review, phone, dan direct Google Maps URL dicoba diambil.
- Setelah `Gather data`, item tetap dipertahankan di list lokal dan tombol berubah menjadi `Generate Site`; hasil detail tidak langsung mem-filter ulang list walaupun Places menemukan website/metadata baru.
- Badge website sebelum Place Details adalah `Website unknown`, bukan `No website`, karena Google Places Text Search tidak selalu menyertakan website. Setelah `Gather data`, badge baru berubah menjadi `Has website` atau `No website` dari Place Details.
- Search dapat mengaktifkan `websitePrecheck=1`, yaitu Place Details minimal untuk hasil teratas agar status website diketahui sebelum admin melakukan gather data penuh. Ini memakai kuota Details, tetapi mencegah buang waktu/generate untuk bisnis yang sudah punya website.
- Filter `No website first` berarti `website_check_status=no_website`, bukan sekadar kolom website kosong. Prospek yang belum dicek masuk kategori `Website unknown`.
- List prospek otomatis diurutkan dengan conversion score dari `src/pages/admin/leads/useProspectFiltersAndScoring.ts`: no website verified, rating 4.5+, review count 10-100, phone exists, US market, belum generated, dan details gathered menaikkan skor; bisnis yang sudah punya website diberi penalti besar.
- Badge `Score` bisa diklik untuk membuka popover breakdown poin per faktor, berguna untuk tuning formula scoring.
- Bobot scoring default berasal dari `src/lib/prospectScoring.ts`, lalu bisa dioverride dari `/admin/settings`.
- Header list prospek menampilkan badge preset scoring aktif agar admin tahu ranking visible list sedang memakai preset apa.
- Nama bisnis di list link ke Google Business/Maps listing. Jika exact `url` dari Place Details belum tersedia, fallback memakai `/maps/place/?q=place_id:{placeId}` agar tidak membuka search query generik.
- Search result diberi `searchQuery` agar generator tidak memakai tipe Places generik seperti `establishment` sebagai niche ketika Google tidak memberi kategori spesifik.
- Untuk situs gratis, foto Google Places tetap hotlink/proxy runtime dan tidak di-upload ke R2.
- JSON scaffold fallback memakai palette tersebut untuk `primary`, `accent`, dan `secondary`.
- Jika admin lupa memilih foto/palette, generator memakai foto pertama dari hasil Places sebagai fallback visual dan palette default aman; jika `paletteOptions` sudah ada, opsi pertama dipakai sebagai palette default.
- Palette hasil ekstraksi digelapkan bila terlalu terang untuk teks putih; Function juga menormalisasi `primary` dan `accent` sebelum menyimpan JSON.
- JSON scaffold fallback dibuat oleh `src/lib/generatedSiteScaffold.ts` melalui helper orchestration `src/lib/adminSiteGeneration.ts`, sehingga `/admin/leads` dan `/admin/sites` memakai shape fallback yang sama.
- JSON scaffold fallback menentukan `meta.language` dari alamat/region Places: US default English, Indonesia default Indonesian.
- JSON scaffold fallback menentukan `design.stylePreset`, `design.stylePresetConfig`, `design.visualStyle`, dan `design.visualStyleConfig` via `src/lib/siteStylePresets.ts`.
- JSON scaffold fallback menentukan `design.fontPairing`, `fontPairingConfig`, dan `themeVariables.typography` via `src/lib/fontPairings.ts`; pilihan awal divariasikan dengan stable business seed supaya bisnis dalam industri sama tidak selalu memakai font pairing pertama.
- Prompt AI generator juga diinstruksikan memakai bahasa sesuai region bisnis.
- Prompt AI generator dan Function post-process menjaga parity dengan `/demo`: jika ada minimal dua foto bisnis yang usable, JSON final harus punya page `gallery`, nav item `#gallery`, dan section `imageGallery`.
- Prompt AI generator mengidentifikasi apakah bisnis menjual `products`, `services`, atau `both`, lalu membuat `productServiceStrategy`, arrays `products`/`services`, submenu navbar children, dan satu halaman detail non-thin untuk setiap produk/layanan.
- Prompt AI copy patch ditulis sebagai suara bisnis yang berbicara ke calon pelanggan, bukan sebagai admin/demo/report; prompt meminta first-person owner voice seperti `we`, `our team`, `our customers`, dan `call us`, serta melarang frasa meta seperti `the listed address`, `this page`, `owner can replace this copy`, `website-ready`, dan `no website detected` pada copy visitor-facing.
- Prompt AI copy patch juga diminta memperluas copy dari niche/business name ke masalah dan outcome industri yang realistis, bukan hanya merangkum Google Places. Ia boleh memakai conservative industry knowledge untuk menjelaskan kebutuhan pelanggan dan service lines yang masuk akal, tetapi tidak boleh menciptakan sertifikasi, years in business, warranty, brand partnership, harga, ukuran tim, atau proyek spesifik yang tidak ada di data.
- Renderer memilih icon `features` dan `trustBar` dari teks final title/description saat render, menjaga icon tidak duplikat dalam satu grid, dan tidak terkunci ke `iconSvg` scaffold lama; product/service detail page tetap punya features section berikon.
- Shared scaffold fallback juga membuat product/service detail pages memakai section `hero`, `offeringDetail`, `features`, `reviews`, `faq`, dan `hoursLocation`.
- Place Details mengambil field `reviews`; detail page bisa memakai review Google yang relevan via keyword best-effort.
- Search Google Places menampilkan feedback sukses/kosong/error melalui `searchMessage`, supaya response kosong tidak terlihat seperti tombol tidak bekerja.
- Search default membaca cache D1 `places_search_cache`; tombol `Refresh` memaksa request baru ke Google Places.
- Setiap result Google Places di-upsert ke `places_prospects` sebagai prospect draft agar pencarian lama tidak hilang.
- Panel `Manual Google Maps import` menerima URL listing/search Google Maps dan optional captured JSON. Listing URL tanpa captured JSON membuat satu draft manual; search URL tanpa captured JSON memberi pesan agar admin memakai browser capture helper karena kartu bisnis ada di DOM Google Maps, bukan di URL.
- Captured JSON dari helper Chrome/Opera dinormalisasi ke prospect fields (`name`, `address`, `phone`, `website`, `mapsUrl`, rating/reviews, website status), lalu di-upsert ke `places_prospects` dan dicatat di `places_search_cache` dengan status `MANUAL_CAPTURE`.
- Workspace `/admin/leads` dipisah menjadi tab `Find Leads`, `Search History`, dan `CRM Pipeline` supaya pencarian Google Maps/manual import tidak tercampur dengan CRM follow-up.
- Manual listing URL satuan tidak lagi dicatat sebagai search history; hanya manual search/captured multi-listing yang masuk cache history.
- Tab `CRM Pipeline` menampilkan queue `Manual duplicate review` untuk kemungkinan duplikat saat URL-only import dan Maps DOM capture membuat prospect berbeda untuk bisnis yang sama. State/actions queue ini hidup di `src/pages/admin/leads/useManualDuplicateReview.ts`; panel menerima props dari hook. Queue dihitung dari nama bisnis, alamat, URL Maps, dan Google Maps CID bila tersedia; setiap duplicate menampilkan preview field yang akan dicopy sebelum tombol `Merge + skip` menyalin field kosong ke prospect yang disarankan untuk disimpan lalu mengubah duplicate ke status `skipped`.
- Panel `Search history` membaca search term lama dari `places_search_cache`, lalu menghydrate setiap business card dari `places_prospects` berdasarkan Google `place_id`. Progress bisnis tetap current walaupun listing yang sama muncul di beberapa search term.
- Klik search term history memuat prospect list dari cache tanpa panggil Google Places baru, tetap memakai action/status workflow yang sama seperti search aktif.
- Filter prospect state/actions hidup di `src/pages/admin/leads/useProspectFiltersAndScoring.ts` dan tersimpan memakai status, website/no website, minimum rating, minimum review count, city, state, dan niche. UI filter dibuat compact: toolbar `Filters`, chips aktif, tombol reset, dan panel advanced collapsible agar tidak memakan banyak ruang.
- Filter prospect juga punya minimum conversion score (`Any`, `50+`, `70+`, `85+`) untuk menyembunyikan prospek kualitas rendah dari list; visible/selected prospect derivation juga berasal dari `useProspectFiltersAndScoring`.
- Default minimum conversion score dan bobot scoring dibaca oleh `useProspectFiltersAndScoring` dari `/admin/settings` (`SCORING_MIN_SCORE_DEFAULT`, `SCORING_WEIGHTS_JSON`) dengan fallback ke `src/lib/prospectScoring.ts`; `SCORING_PRESET` disimpan untuk UI Settings.
- Penjelasan panjang di toolbar/filter CRM dipindahkan ke tooltip hover agar UI admin tetap ringkas.
- Tooltip juga dipasang pada heading search, AI Web Builder, status/rating/reviews/city/state/niche filters, bulk action area, drawer status, dan photo/palette source agar workflow gather/generate lebih jelas.
- Hasil pencarian tidak dikosongkan setelah generate, termasuk saat `/api/sites/generate` gagal.
- Generate status ditampilkan per bisnis, dengan link preview jika sukses. Generate dari `/admin/leads` mengirim `requireAi: true`; jika provider/model/API key/JSON patch bermasalah, admin melihat error dan job failed, bukan fallback-only site yang terlihat seperti sukses.
- Generate AI dari `/admin/leads` memakai D1-backed chunked flow: browser memanggil `chunked-start`, lalu step `outline`, `siteCopy`, `offeringCopy`, dan `finalize` sebagai request terpisah supaya provider latency tidak menahan satu Pages Function invocation terlalu lama. Step `offeringCopy` dipanggil berulang per service/product item sampai API mengembalikan `nextStep: "finalize"`. Jika step menerima error transient 502/503/504/524/Cloudflare HTML/provider temporary, browser menunggu 60 detik dan retry step itu satu kali, bukan mengulang seluruh job.
- Tombol `Generate selected`, setiap `Generate Site`, dan quick drawer retry jobs menampilkan AI readiness badge berisi status key provider, selected model, dan bahwa klik tersebut membutuhkan AI.
- Sebelum full generate, handler memakai `src/lib/adminSiteGeneration.ts` untuk cek provider cooldown dan `/api/ai/readiness`; jika key provider hilang, model tidak ada di daftar model yang didukung, atau provider sedang cooldown, generate berhenti dengan pesan UI tanpa membuat request `/api/sites/generate`.
- Selector AI Web Builder punya tombol `Refresh AI readiness` untuk clear cache readiness setelah key/model berubah.
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
- Photo selection normalization untuk `/admin/leads` hidup di `src/lib/adminSiteGeneration.ts`: photo reference/attribution, owner-like priority, sorted photos, palette option payloads, saved selection payloads, dan generate-time selected photo/palette resolution memakai helper yang sama dengan generate payload.

Risiko debug:
- Jika foto Google tidak muncul, cek Places API key dan apakah Text Search mengembalikan `photos`.
- Jika hanya satu foto muncul, klik `Load more photos/details`; Text Search memang sering mengembalikan foto terbatas.
- Jika pencarian tidak menampilkan hasil, cek pesan di UI dan response `/api/places/search`; Function menormalisasi status Google seperti `ZERO_RESULTS`, `REQUEST_DENIED`, dan fetch failure ke JSON.
- Jika manual import search URL menampilkan `browser capture required`, buka Google Maps di browser, pakai helper di `public/tools/google-maps-capture-extension`, lalu paste JSON hasil capture ke panel manual import.
- Jika manual listing URL menghasilkan `MANUAL_CAPTURE_REQUIRED` saat `Gather data`, record tersebut hanya berisi data dari URL. Gunakan extension helper pada listing Google Maps yang sedang terbuka agar phone/rating/reviews/website ikut tersimpan tanpa Places API.
- Jika duplicate queue terlalu agresif atau kurang agresif, cek normalisasi di `/api/places/manual-duplicates`; endpoint ini tidak membuat tabel baru, hanya menghitung kandidat dari `places_prospects`.
- Error `API keys with referer restrictions cannot be used with this API` berarti key Google Places masih dibatasi HTTP referrer. Untuk Pages Functions/server-side, pakai server key tanpa application restriction dan batasi hanya API-nya di Google Cloud.
- Canvas palette butuh image same-origin/CORS; karena itu foto harus lewat proxy `/api/places/photo`, bukan langsung URL Google.
- Audit dan roadmap admin disimpan di `docs/ADMIN_WORKFLOW_AUDIT.md`.

### `src/pages/admin/AdminOrders.tsx`

Fungsi:
- Halaman admin khusus untuk melihat order done-for-you setup dari checkout/payment ledger.
- Memakai endpoint existing `GET /api/leads/payments`, bukan tabel baru, supaya payment reconciliation dan fulfillment note tetap satu sumber data.

Logic penting:
- Membaca `lead_payments.raw_json` dan menampilkan `setupRequest.setupNote`, jumlah page add/edit, business ID, payment status, processor, amount, transaction/reference, payer email, dan link preview.
- Menampilkan ringkasan billing term, hosting/domain price split, PayPal plan/subscription ID when present, cached-plan marker, dan registrar quote (`domainQuote`) supaya fulfillment bisa melihat provider/internal cost tanpa membuka raw JSON.
- Tombol `Copy fulfillment note` menyalin business, preview URL, payment status/reference, requested domain/domain mode, customer email, dan setup note supaya admin bisa paste ke work queue atau pesan client.
- Filter status `all/pending/paid` dan search lokal membantu fulfillment mencari business, email, reference, transaction ID, atau isi setup note.
- Page add/edit notes berasal dari checkout `WebsiteActionPanel`; jika order lama tidak punya `raw_json.setupRequest`, halaman menampilkan fallback `No setup note recorded`.
- Domain registrar automation plan lives in `docs/DOMAIN_REGISTRATION_AUTOMATION_PLAN.md` and is available from the admin docs reader on `/admin/orders` and `/admin/settings`.

Risiko debug:
- Jika order baru tidak menampilkan page notes, cek payload `setupRequest` dari `WebsiteActionPanel` dan raw JSON insert di `/api/payments/checkout`.
- Jika payment status tidak berubah setelah PayPal capture/manual verify, cek `lead_payments` row yang sama di `/admin/leads` Payment Reconciliation.

### `public/tools/google-maps-capture-extension`

Fungsi:
- Chrome/Opera unpacked extension helper untuk mengambil data visible Google Maps saat Places API quota habis.
- `content.js` membaca link/detail yang sedang visible di DOM Google Maps dan mengirim array `items`.
- `popup.js` menyalin JSON hasil capture ke clipboard agar bisa dipaste ke panel manual import di `/admin/leads`, atau mengirimnya langsung ke `/api/places/manual-import` lewat tombol `Post to admin`.
- Jika popup menerima Chrome error `Could not establish connection. Receiving end does not exist`, popup menginject `content.js` ke tab Maps aktif dan retry sekali sebelum menampilkan error. Ini membantu setelah extension baru direload atau tab Maps sudah terbuka sebelum content script aktif.

Risiko debug:
- DOM Google Maps berubah-ubah; helper ini best-effort dan hanya menangkap listing yang visible atau detail panel yang sedang terbuka.
- Search list panjang perlu discroll dan dicapture ulang jika admin ingin mengambil lebih banyak prospek.

### `src/pages/admin/AdminJobs.tsx`

Fungsi:
- Halaman khusus untuk audit `generation_jobs` agar `/admin/leads` tetap fokus pada prospecting/search.
- Membungkus shared `GenerationJobsTable` dalam mode full page.

Logic penting:
- Provider/model fallback untuk retry dibaca dari localStorage pilihan terakhir `/admin/leads`.
- Page juga membaca `/api/settings` untuk mengirim status key provider ke `GenerationJobsTable`, sehingga tombol retry bisa menampilkan `Key present`, `Key missing`, atau `Key unknown`.
- Semua logic table, filter, sort, hash, refresh, dan retry hidup di `src/components/GenerationJobsTable.tsx`.
- Full page memakai `serverBackedFilters` agar filter jobs mencari dari server/D1, bukan hanya dari 200 row yang sedang loaded.
- Full page juga memakai `serverBackedSearch` untuk mencari job lama berdasarkan nama bisnis, `businessId`, `placeId`, job ID, atau metadata JSON.
- Page heading memakai tooltip untuk menjelaskan bahwa halaman ini adalah audit trail job generation, termasuk retry/fallback/copy patch status.
- Page header includes an icon-only docs quick link that opens generation job QA/admin workflow docs.

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
- Tombol `Repair service images` memanggil `POST /api/sites/:businessId/repair-service-images` untuk memperbaiki hanya image field di homepage/services offer cards dari saved gallery images, saved detail-page images, brand images, dan Google Places photos. Action ini hanya muncul untuk row yang punya missing/duplicate service card image, tidak memanggil AI, dan tidak regenerate full site.
- Row dengan mode `summary_error` menampilkan action icon-only `Repair/re-save JSON summary`, yang memanggil `POST /api/sites/:businessId/resave-json-summary` untuk membaca full saved JSON dari R2/D1, menjalankan deterministic page inserts, rebuild `json_summary`, dan re-save manifest tanpa AI atau full regeneration. Jika row hanya punya compact manifest tetapi full R2 JSON tidak bisa dibaca, endpoint gagal eksplisit karena data lengkap tidak bisa direkonstruksi dari summary. Row yang sama juga menampilkan action icon-only `Restore from latest generation job`, yang memanggil `POST /api/sites/:businessId/restore-from-latest-job` untuk mencoba rebuild site JSON dari payload/copy patch metadata pada successful chunked generation job terbaru. Restore action juga tersedia di menu `Regen` untuk kasus ketika admin list summary masih normal tetapi preview full JSON gagal karena R2 object hilang.
- Search bar punya filter `Image issues` yang menampilkan site dengan missing atau duplicate service-card images dari saved summary, sehingga admin bisa menemukan homepage/services cards yang kosong atau memakai image berulang sebelum membuka preview.
- Search bar punya filter `Recovery` yang menampilkan row `summary_error` dan site R2 yang pernah gagal membaca full JSON saat preview/API `GET /api/sites/:businessId`. Preview read failure disimpan ringan di `json_sites.last_preview_error` dan `last_preview_error_at`, lalu dibersihkan otomatis saat site berhasil disimpan ulang atau preview read berikutnya sukses.
- Tombol maintenance `Scan R2` memanggil `POST /api/sites/scan-r2-health` dalam chunk kecil dari browser, maksimal 50 site per klik. Scan ini membaca full JSON R2 tanpa membuka preview satu per satu, menandai failure ke marker Recovery, dan membersihkan marker lama jika object sudah sehat. Jika masih ada row tersisa setelah cap, klik berikutnya lanjut dari offset berikutnya. Label kecil di bawah tombol menyimpan offset/time scan terakhir di localStorage supaya admin tahu apakah klik berikutnya lanjut atau mulai ulang.
- Tombol `Repair filtered` menjalankan repair service images untuk maksimal 10 site dari hasil search/filter saat ini, satu per satu, supaya admin bisa membersihkan missing image ringan tanpa membuka tiap preview dan tanpa membuat request paralel berat.
- Setelah repair image berjalan, row menampilkan badge `Repaired {date}` dari summary `lastImageRepairAt` supaya QA bisa melihat site mana yang sudah dibersihkan dalam production pass.
- Tombol `Refresh visual variation` memanggil `POST /api/sites/:businessId/refresh-visual-variation` untuk mengubah saved font pairing/typography ke stable seeded variant dan mengirim palette tambahan yang diekstrak client-side dari gallery images jika jumlah saved palette lebih sedikit daripada jumlah foto gallery. Action ini tidak memanggil AI, tidak mengubah copy, dan tidak mengubah image.
- Tombol profile audit di row Generated Sites mengecek `GET /api/audits/:businessId/snapshots` terlebih dulu. Jika belum ada saved snapshot, UI memanggil `POST /api/audits/:businessId/snapshots` untuk membuat audit pertama lalu membuka snapshot tersebut; jika snapshot sudah ada, tombol hanya membuka `/audit/:businessId` tanpa membuat snapshot baru.
- Tombol `Upgrade existing site` icon-only memakai sparkle icon dan memanggil `POST /api/sites/:businessId/upgrade-design`. Endpoint membaca full saved JSON dari R2/D1, menghitung before audit, menjalankan deterministic post-process/design intent, memilih seeded visual/font variant, menulis `meta.designSystemVersion`, `meta.lastDesignUpgradeAt`, `meta.lastUpgradeMode`, menyimpan ulang JSON ke R2/D1, lalu mengembalikan after audit, changed fields, `needsAi`, dan `aiFlags`. Untuk row yang belum fully upgraded, UI selalu lanjut ke existing chunked AI flow (`siteCopy -> offeringCopy -> finalize`) dengan `upgradeMode=premium_design_copy_upgrade`, progress bar per row, provider cooldown/readiness preflight, dan final save R2/D1 yang sama dengan regenerate. JSON baru dianggap fully upgraded hanya setelah child save job AI sukses menulis `meta.premiumUpgradeComplete=true` dan `meta.lastPremiumCopyUpgradeAt`; row seperti ini menampilkan badge `Premium upgraded` dan tombol sparkle disembunyikan.
- Maintenance/debug actions are hidden once they have served their purpose to keep rows scannable. `Data` is hidden for healthy fully-upgraded rows, `Brief` is hidden after premium upgrade completes, `Visual` is hidden after a visual pass or premium upgrade, empty/disabled `Jobs` is no longer shown, and `Regen` is hidden for healthy fully-upgraded rows. Add `?actions=all` or `?debug=sites` to `/admin/sites` to temporarily show hidden maintenance/debug actions for QA.
- Tombol `Visual filtered` menjalankan refresh visual variation plus palette backfill untuk maksimal 10 site dari hasil search/filter saat ini, satu per satu, supaya situs lama bisa dibuat lebih bervariasi tanpa regenerate full site atau tombol terpisah.
- Untuk prospect yang belum generated, tombol action adalah `Generate`, bukan `Regen`; flow ini memakai `src/lib/adminSiteGeneration.ts` untuk provider cooldown, AI readiness, refresh Place Details, shared scaffold payload, photo/palette resolution, dan chunked generation steps yang sama dengan `/admin/leads`. Jika AI provider gagal, error ditampilkan dan job ditandai failed agar fallback tidak menyamar sebagai hasil AI.
- First generate dari `Ready to Generate` juga memakai chunked AI flow untuk step outline/siteCopy/offeringCopy/finalize; mode `Re-gather Google data + resave` tetap memakai save langsung tanpa AI.
- Fallback JSON dari `/admin/sites` dibuat oleh `src/lib/generatedSiteScaffold.ts`, sama seperti `/admin/leads`, lalu di-post-process untuk page services/about/contact/feedback/gallery.
- Fallback JSON mengisi `meta.generatedWithAi=false`, `meta.generationMode=google_places_fallback`, `meta.sourcePhotoCount`, title-cased service names, generalized niche copy profiles, service-area copy inferred from address, detail pages, dan gallery section/page jika Places mengembalikan cukup foto.
- Fallback JSON juga memilih `design.fontPairing` dan `fontPairingConfig` dari registry industri sehingga site tetap punya typography yang sesuai walaupun AI gagal.
- Tombol `Regen` memakai dropdown:
  - `AI fill missing/copy with selected model` mengambil JSON site saat ini, mencoba refresh Place Details lagi jika `sourceData.placeId` tersedia dan bukan placeholder `maps:*`, lalu menjalankan chunked generation dengan provider/model pilihan, `requireAi: true`, dan `skipAiOfferingOutline: true` agar tidak merombak daftar layanan. Step siteCopy/offeringCopy/finalize mengisi About page copy, copy umum, service detail copy, dan `navLabel` pendek untuk submenu layanan.
  - `Re-gather Google data + resave` wajib punya `sourceData.placeId`, mengambil Place Details lagi, lalu mengirim `provider`/`model` kosong agar data Google Places, termasuk Maps URL exact, disimpan ulang tanpa memaksa AI call.
  - Kedua action menampilkan AI readiness badge; AI regenerate menunjukkan key/model AI, sedangkan re-gather menunjukkan `Data resave` dan `No AI key needed`.

API yang dipakai:
- `GET /api/sites`
- `GET /api/prospects?status=details_loaded`
- `GET /api/places/details?placeId=...`
- `GET /api/ai/readiness?provider=...&model=...`
- `POST /api/sites/generate`
- `GET /api/sites/:businessId/copy-brief`
- `POST /api/sites/:businessId/repair-service-images`
- `POST /api/sites/:businessId/resave-json-summary`
- `POST /api/sites/:businessId/upgrade-design`
- `POST /api/sites/:businessId/restore-from-latest-job`
- `POST /api/sites/scan-r2-health`
- `POST /api/sites/:businessId/refresh-visual-variation`
- `GET /api/audits/:businessId/snapshots`
- `POST /api/audits/:businessId/snapshots`

Logic penting:
- Search lokal bisa mencari nama bisnis, slug, niche, bahasa, dan region.
- Metadata tampilan diambil dari `meta`, `businessProfile`, dan `trust` di JSON site.
- List Generated Sites menampilkan badge storage mode: `R2 JSON` jika D1 hanya manifest dan full JSON ada di R2, atau `Legacy D1 JSON` jika row lama masih menyimpan full JSON di D1.
- List Generated Sites menampilkan badge generation mode: `AI Copy Patch` jika `meta.generationMode=ai_copy_patch`/`generatedWithAi=true`, atau `Fallback Only` jika site dibuat dari gathered-data/scaffold tanpa copy patch AI.
- List Generated Sites menampilkan badge `Audit saved N` jika `/api/sites` menemukan saved Google Business Profile audit snapshot di `marketing_audits`; tooltip menampilkan timestamp snapshot terbaru agar admin tahu audit outreach sudah punya point-in-time record.
- Search bar punya filter `Audit saved` dan `Needs audit` berdasarkan `auditSnapshotCount`, sehingga admin bisa memisahkan outreach-ready rows yang sudah punya audit snapshot dari rows yang perlu dibuatkan audit dulu.
- Tombol `Create audits` membuat saved GBP audit snapshot untuk maksimal 10 row visible/filter yang belum punya snapshot. Batch berjalan sequential dari browser, memakai `POST /api/audits/:businessId/snapshots`, memperbarui badge row langsung, lalu refresh list setelah selesai.
- Search bar punya filter gabungan `Outreach ready`, yaitu row dengan `auditSnapshotCount > 0` dan belum marked contacted, supaya queue owner outreach berikutnya bisa dibuka satu klik.
- Tombol `Copy next` menyalin owner outreach template untuk row pertama di visible `Outreach ready` queue dan memanggil marker contacted yang sama seperti row outreach menu, sehingga row langsung keluar dari queue setelah diproses. Toast sukses copy outreach menampilkan action kecil `Open site` dan `Open audit` supaya admin bisa verify cepat sebelum mengirim pesan.
- Tombol `Email next` menscan visible `Outreach ready` queue sampai menemukan row dengan saved usable email, menyalin template ke clipboard, memanggil marker contacted channel email, lalu membuka draft `mailto:` prefilled. Row tanpa email dilewati dan pesan warning muncul jika tidak ada email usable di queue visible.
- List Generated Sites menampilkan badge `Fix N img` jika saved summary mendeteksi homepage/services offer cards tanpa image atau memakai image yang sama berulang. Badge ini memakai field summary `serviceCardImageTotal`, `missingServiceCardImageCount`, `duplicateServiceCardImageCount`, `hasMissingServiceCardImages`, `hasDuplicateServiceCardImages`, dan `needsServiceCardImageRepair`; row R2 lama yang belum pernah resave/repair sejak field ini ada mungkin belum punya audit count.
- List Generated Sites punya filter `About/nav` untuk row yang belum punya saved About page, belum punya `navLabel`/`shortLabel` pada services/products, atau summary lama yang belum punya audit About/nav. Row yang cocok menampilkan badge `About/nav`; gunakan menu Regen -> `AI fill missing/copy with selected model` untuk mengisi About copy dan short submenu labels tanpa full service-outline regeneration.
- Tombol `AI fill filtered` menjalankan About/nav fill untuk maksimal 5 row dari hasil filter/search saat ini. Saat berjalan, label tombol berubah mengikuti sub-step aktif seperti `About copy`, `Nav 3/8`, atau `Finalize`. Batch berjalan sequential satu site per waktu lewat `POST /api/sites/:businessId/ai-fill-about-nav-start`, jadi browser tidak perlu download/upload full site JSON lebih dulu. Setiap site membuat chunked generation job terpisah yang menjalankan AI About-only `siteCopy`, AI `navLabels` satu service per `offeringCopy` request, lalu `finalize`.
- About/nav `finalize` memakai endpoint ringan `POST /api/sites/:businessId/ai-fill-about-nav-finalize`, bukan full `/api/sites/generate`, supaya repair lama hanya membaca saved JSON, menerapkan copy patch, menyimpan R2/D1 summary, dan menghindari asset sync/generation bookkeeping yang tidak perlu.
- About/nav jobs menulis timing ringan ke `metadata.aboutNavTiming`: `start`, `siteCopy`, aggregate/history `offeringCopy`, dan `finalize` menyimpan started/completed timestamp, last/total/average duration ms, status, error jika gagal, serta `aboutNavCurrentStep` sebelum chunk berjalan. Ini dipakai untuk melihat apakah bottleneck ada di deterministic start/save, About copy, nav-label item, atau finalize.
- Row yang punya badge `About/nav` juga menampilkan tombol `Generate About/nav` supaya admin bisa memperbaiki satu generated site tanpa membuka menu Regen. Tombol ini memakai flow chunked server-side yang sama dengan batch. Setelah repair pass jarang dibutuhkan, tombol tetap tersembunyi untuk row sehat kecuali admin membuka `/admin/sites?repair=about-nav` sebagai override QA/repair manual.
- Saved site summary now stores `hasAboutPage`, `serviceNavLabelTotal`, `missingServiceNavLabelCount`, `needsAboutNavRepair`, and list API exposes `aboutNavAuditKnown`; old R2 summary rows without these fields are treated as About/nav audit targets until resaved.
- Batch `Repair filtered` memakai endpoint single-site `POST /api/sites/:businessId/repair-service-images` secara sequential dan dibatasi 10 row per klik; response toast merangkum jumlah site repaired, image field changed, dan failure count.
- Field summary `lastImageRepairAt` diisi setiap kali endpoint repair service images berhasil menyimpan JSON, termasuk jika jumlah changed = 0, karena timestamp menandai audit/cleanup pass sudah dijalankan.
- List Generated Sites menampilkan badge `Visual {date}` dari `lastVisualVariationAt` setelah font pairing variation disimpan. Summary juga menyimpan `fontPairing` dan `fontPairingLabel` untuk tooltip/debug.
- Batch `Visual filtered` memakai endpoint single-site `POST /api/sites/:businessId/refresh-visual-variation` secara sequential dan dibatasi 10 row per klik; sebelum POST, client mengambil full site JSON dan mencoba mengekstrak palette dari gallery image yang belum punya `brand.paletteOptions`. Jika browser canvas diblokir oleh CORS, client memakai seeded fallback palette per image supaya site lama tetap mendapat pilihan warna tambahan. Response toast merangkum jumlah site refreshed, font pairing yang berubah, dan palette set yang bertambah.
- Pilihan provider/model regenerate disimpan ke localStorage agar refresh halaman tetap memakai model terakhir yang dipilih admin.
- Pilihan provider/model yang sama dipakai untuk `Generate` prospect gathered di section `Ready to Generate`.
- First generate dari `Ready to Generate` memakai selected photo/palette yang tersimpan di prospect jika ada; jika tidak ada, flow memilih foto Places fallback dengan prioritas owner-like yang sama seperti `/admin/leads` dan memakai URL proxy `maxwidth=960` untuk visual generated site.
- Tombol `Generate` di section `Ready to Generate` menampilkan AI readiness badge agar admin tahu key provider/model sebelum membuat site pertama.
- First generate dan `AI regenerate` memakai `src/lib/adminSiteGeneration.ts` untuk shared cooldown/readiness preflight sebelum gather/generate berat; mode `Re-gather Google data + resave` tidak membutuhkan preflight AI. Shared chunked helper reports step progress and one-time transient auto-retry countdowns back to `/admin/leads` and `/admin/sites`, and starts from the `nextStep` returned by `chunked-start`. First generate memakai sequence `outline -> siteCopy -> offeringCopy -> finalize`; existing-site AI fill skips outline and starts at `siteCopy` so missing About/menu-label copy can be filled without rediscovering services.
- First generate and existing-site premium upgrade both apply stable business-seeded visual variation. New scaffolded sites infer the industry preset, then `/api/sites/generate` sets `design.visualStyleConfig.selectionMode=stable_seeded_business_variant` and chooses a visual-style variant from the allowed industry family. Existing-site upgrade can refresh the visual variant while preserving `businessId`, saved source data, preview URL, and R2 JSON key semantics.
- `AI regenerate` dan `Re-gather Google data + resave` mengirim ulang `brand.paletteOptions` dari site JSON agar pilihan warna yang sudah ada tidak bergantung pada shape lama atau fallback renderer.
- Selector provider/model di Ready to Generate dan dropdown Regen punya tombol `Refresh AI readiness` untuk memaksa badge/preflight recheck setelah key baru disimpan.
- JSON/data modal close action uses shared hover tooltip so the compact X control is named during production QA.
- Repeated site list actions are intentionally icon-only with hover tooltips and `aria-label`, including page refresh, ready-prospect Maps/Data/Generate, generated-site Preview/Maps/Data/Brief/Repair service images/Refresh visual variation/Regen, and modal close.
- Generated-site rows include a compact `Jobs` action only when `latestGenerationJobId` exists. It links to `/admin/jobs?job={latestGenerationJobId}&q={latestGenerationJobId}` and opens the latest generation audit drawer for that site. The action color reflects latest job status: green success, red failed, amber running/unknown.
- Ready-to-generate and per-site regenerate controls include docs quick links for `Design Guide`, `Niche Style Presets`, and `Font Pairing Guide`.
- Generate/regenerate/readiness action notices memakai `AdminToast`, sehingga pesan sukses seperti `AI copy patch regenerated ...` tetap floating di kanan atas meski admin sedang melihat bagian bawah list.
- `/admin/sites` shows per-business inline progress while first generate/regenerate is running, including the active `outline`, `siteCopy`, `offeringCopy`, or `finalize` step, a compact progress bar, and transient auto-retry countdowns, so one business failure/status is visible without opening `/admin/jobs`.
- Tombol Refresh membaca ulang list dari API setelah batch generate.
- Initial load `/admin/sites` memakai `readApiJson` untuk `/api/sites` dan `/api/prospects`, sehingga Cloudflare HTML 503 ditampilkan sebagai masalah Pages Functions/edge, bukan pesan mentah `Response bukan JSON`. Jika `/api/prospects?status=details_loaded` gagal, warning ditampilkan lewat floating `AdminToast` dan generated sites tetap dirender dari `/api/sites`; tidak ada banner error di atas halaman yang mengharuskan scroll.
- `/admin/sites` memisahkan `Ready to Generate` dan `Generated Sites` memakai `AdminCollapsibleSectionHeader`. State `webview.adminSites.openSection` menjaga hanya satu section berat terbuka pada satu waktu (`ready`, `generated`, atau kosong), sehingga admin bisa fokus pada queue yang sedang dikerjakan.
- `/api/sites` list isolates per-row summary failures and returns a minimal `summary_error` row instead of failing the entire Generated Sites list when one saved JSON/summary row is malformed or from an interrupted save.
- Tooltip dipasang pada heading Generated Sites, Ready to Generate, table actions, dan Regen dropdown untuk menjelaskan perbedaan Preview/Data/Brief/Regen, first generate, AI regenerate, dan re-gather.
- Generated Sites row action includes an icon-only `Owner outreach` menu beside Preview. It shows a compact read-only template preview before copy/open actions, can copy the full owner-ready DM/email template, copy only the public preview URL with `?owner=1`, open a safe `ownerPreview=1` countdown preview without starting localStorage, open a prefilled `mailto:` draft when the generated site data contains an email, or open a prefilled `sms:` Messages/iMessage draft when the generated site data contains a usable phone number. The real owner link and safe countdown preview actions both include help tooltips: the real link explains that the countdown starts when the owner opens it, while the safe preview explains that it does not start the real owner timer. First outreach subject/body aligns with the preview CTA copy `Download your site for FREE`; downloaded-without-setup rows automatically use a warmer setup/domain/hosting follow-up template and subject instead of the first free-preview message. These outreach actions call `POST /api/sites/:businessId/outreach-contacted` to set `leads.last_contacted`, keep paid/viewed lead statuses from being downgraded, insert a CRM activity, and mark non-generated/non-skipped matching prospects as contacted. Setup upsell template/email/SMS actions also set `leads.setup_followup_contacted_at`, returned as `setupFollowUpContactedAt`, and `/admin/sites` shows a separate `Setup follow-up` badge/timestamp so first outreach and downloaded-owner upsell are not confused. The copied review link removes any `reviewStart`/`reviewStartedAt`/`claimStart` params so outreach links start the 7-day owner countdown when the business owner opens them.
- Generated Sites has `Contacted`, `Follow-up`, `Downloaded`, `No setup sent`, and `Setup sent` filters and row badges based on `/api/sites` lead/prospect metadata. `Follow-up` shows sites contacted at least 3 days ago with no preview view, free-package download, checkout, or paid status recorded. `Downloaded` shows warm owners who claimed the free package but have not reached checkout/paid setup status. `No setup sent` narrows that warm list to rows without `setupFollowUpContactedAt`, which is the exact queue for the setup/domain/hosting upsell. `Setup sent` shows rows with `setupFollowUpContactedAt` so admin can separate downloaded owners who already received the upsell. Downloaded rows use `lastDownloadedAt`/`downloadCount` returned by `/api/sites`.

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
- Tombol schema repair icon-only memanggil `/api/schema/repair`, menjalankan self-heal tabel/kolom D1, lalu menampilkan ringkasan jumlah kolom per tabel.
- Gunakan tombol ini setelah deploy ketika halaman admin berat mulai error karena kolom D1 production belum termigrasi.
- Setelah repair sukses, halaman menyimpan timestamp ke localStorage agar badge `DB repaired ... ago` muncul di admin sidebar.
- Tombol D1-to-R2 migration icon-only memanggil `POST /api/sites/migrate-r2` batch 25 row, memindahkan row lama `json_sites.json_content` yang masih full JSON ke R2, lalu mengganti D1 dengan manifest kecil.
- Schema heading dan maintenance buttons punya tooltip dan `aria-label` karena kedua actions memengaruhi production D1/R2 compatibility.
- Schema maintenance header includes an icon-only docs quick link to the site builder/schema upgrade plan.

### `src/pages/admin/AdminSettings.tsx`

Fungsi:
- Mengelola API keys dan payment links yang disimpan di D1.
- Menghitung estimasi biaya AI sebelum generate.
- Menampilkan provider cooldown history dari D1 supaya event cooldown set, blocked generate/retry, dan manual clear bisa diaudit lebih lama dari active cooldown row.

API yang dipakai:
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/provider-cooldowns/history?limit=8`

Logic penting:
- Provider selector hanya menampilkan field API key untuk provider aktif.
- Settings punya anchor sections `settings-ai-provider`, `settings-google-places`, `settings-offer-conversion`, `settings-payment`, dan `settings-domain-registrar` untuk direct navigation/readiness deep-links.
- Dense settings sections use collapsed-by-default panels remembered in `localStorage` (`webview.adminSettings.openSections`) so production QA can expand only the area being edited.
- `settings-ai-provider` and `settings-payment` headers include icon-only docs quick links. AI opens model/provider docs; Payment opens PayPal Checkout docs when PayPal is active, otherwise payment processor research.
- When `PAYMENT_PROCESSOR=paypal`, Settings uses a Sandbox/Live segmented toggle, shows only the active mode's API key / Client ID and secret fields, and displays an amber warning if the selected mode is missing either credential.
- Provider tab dan estimator provider/model disimpan ke localStorage agar pilihan terakhir tetap dipakai setelah refresh.
- Setelah settings berhasil tersimpan, cache AI readiness otomatis dibersihkan agar key baru langsung terbaca oleh badge/preflight.
- Estimator provider/model punya tombol refresh AI readiness icon-only dengan hover tooltip untuk clear cache manual tanpa menunggu TTL 30 detik.
- Estimator juga menampilkan inline `AI readiness` badge untuk provider/model yang sedang dipilih, sehingga key baru bisa diverifikasi dari `/admin/settings` tanpa pindah ke Leads/Sites.
- Estimator punya `Service copy speed mode` per provider/model. Setting disimpan sebagai JSON D1 key `AI_SERVICE_COPY_PROVIDER_MODES_JSON`; default `offeringCopy` konservatif adalah 1 service/product per Pages Function request untuk menghindari Cloudflare/HTML 502/timeout pada premium upgrade. Mode `Standard` tetap bisa dikonfigurasi 1-4 service/product per request untuk model yang terbukti cukup cepat, tetapi chunked job akan memaksa batch size 1 untuk job itu setelah transient Cloudflare/HTML 502/503/504/524, timeout, atau provider temporary failure.
- Provider cooldown history refresh saat window focus atau event `webview:provider-cooldown`, dan menampilkan event `set`, `blocked`, serta `clear` dengan provider, action, reason, dan expiry.
- Tombol cooldown history export/refresh dibuat icon-only dengan hover tooltip; export menyalin JSON ringkas event cooldown yang sedang terlihat untuk support/debug tanpa endpoint export baru.
- Settings utility actions such as prospect scoring reset are icon-only with hover tooltip; primary manual save keeps a visible label because it is the page-level commit action.
- Auto-save berjalan 1,2 detik setelah perubahan terakhir.
- Floating auto-save status custom menggantikan `alert()` browser dan tetap terlihat saat admin scroll jauh ke bawah halaman Settings.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- KIE.ai ditampilkan sebagai estimasi diskon karena pricing live berada di dashboard/pricing KIE.
- Offer & Conversion settings are separate from Payment Setup and cover the base USD amount, page/edit add-on USD fee, USD->IDR rate, package name, and package description.
- Google Places / Offer & Conversion and Payment Setup / Domain Registrar are paired desktop accordion rows. Only one card per row can be expanded; the expanded card gets about 3/4 of the row while the other collapses to a compact header rail. The row uses `items-start` so a collapsed card does not stretch to the expanded card height. Payment settings sekarang fokus ke active processor (`mock`, `xendit`, `midtrans`, `doku`, `paypal`, `wise`, `payoneer`, `lemon_squeezy_legacy`), Xendit key, Midtrans keys/mode, DOKU keys/mode, PayPal sandbox/live keys/mode, PayPal/Wise/Payoneer/manual fields, legacy Lemon fields, dan nomor WhatsApp admin. Payment Setup dan Domain Registrar tampil dalam satu row desktop supaya checkout rail dan domain quote automation diedit berdekatan. The UI shows only the active processor form; PayPal risk guardrails appear only when PayPal is active or already configured. Jika PayPal aktif, Settings juga menampilkan PayPal live readiness check dari `/api/settings/payment-smoke`, aggregate `Ready for traffic` badge yang hijau hanya jika semua rows pass, stored controlled-live test reference `PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE`, dan PayPal plan cache viewer dari `/api/settings/paypal-plan-cache`, supaya admin bisa melihat live key/webhook readiness, last paid PayPal evidence, exact pre-traffic test match, dan cached subscription plan combinations tanpa membuka D1. Check ini read-only evidence, bukan payment runner; pembayaran controlled sandbox/live tetap dilakukan manual lalu referensinya dicocokkan.
- Section `Prospect Scoring` menyimpan preset, default threshold, dan bobot scoring ke D1 settings agar prioritas prospek bisa ditune dari UI tanpa edit kode.
- Settings UI normalizes old saved `PAYMENT_ADDON_PAGE_USD` values below `$50` back to `$50` on load; checkout API also enforces the same minimum so old production D1 values cannot undercharge page work.
- Bobot scoring memakai angka positif/negatif. Reset weights mengembalikan default dari `src/lib/prospectScoring.ts`.
- Tooltip dipasang pada Settings heading, manual save, provider tabs, Google Places, Payment Links, AI cost estimator, AI readiness refresh/result, and scoring controls to clarify which settings affect generation, search, checkout, and estimates.

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
- Import JSON sample langsung dari repo, lalu membuat beberapa sample industri in-memory dari template yang sama: cafe, contractor, professional/tax, salon/spa, emergency plumbing, dan cleaning. Selector `Industry demo` mengubah business/profile/source/services context; tombol shuffle memilih style/shader/font/palette variant yang masih sesuai industri.
- Menampilkan floating inspector kecil berisi nama bisnis dan daftar `pageId:sectionType` yang sedang tersedia.
- Inspector menampilkan field JSON yang hilang jika renderer sedang memakai fallback.
- Inspector bisa diminimize dan di-drag agar tidak menutup navbar/preview.
- Inspector punya toggle `QA` untuk visual boundary check: `[data-wv-site-canvas]` diberi outline hijau, WebView tool UI `[data-wv-tool-ui]` diberi outline biru, dan tool yang bocor ke canvas akan terlihat merah.
- QA checklist memastikan generated site canvas ada, tool UI terdeteksi, download/setup panel berada di luar CSS website, dan demo inspector berada di luar CSS website.
- QA checklist juga memverifikasi boundary `data-wv-site-header`, boundary `data-wv-site-footer`, submenu overlay berada di luar header, preset layer navbar aktif, submenu memakai variable header, tinggi/shadow navbar sesuai state top/scrolled, dan icon marker `data-wv-qa-icon` untuk `features`, `trustBar`, dan `hoursLocation`. Saat QA aktif, panel remeasure on scroll/resize supaya compact navbar bisa dicek langsung.
- Saat QA aktif, navbar diberi outline amber, submenu outline orange, footer outline purple, dan icon yang diukur diberi outline biru agar style/shader preset bisa dicek visual sebelum produksi.
- Menggunakan `SiteRenderer` dengan `showProspectPanel={false}` agar demo fokus ke hasil render website.

Risiko debug:
- Jika `/demo` blank, cek apakah `resolveJsonModule` aktif di `tsconfig.json`.
- Jika section baru tidak muncul sesuai harapan, update `SiteRenderer`.
- Tombol floating demo:
  - Download Free membuat zip owner via `downloadOwnerSiteZip`; zip sekarang berisi `index.html`, `sitemap.xml`, `robots.txt`, branded PDF owner guide, dan folder `img/`.
  - Paket `$197 Domain + Hosting` memanggil `POST /api/payments/checkout`.
  - Jika payment processor aktif belum dikonfigurasi, endpoint mencatat mock checkout dan membuka link WhatsApp admin.
- Demo memiliki selector style preset dan shader preset dari `src/lib/siteStylePresets.ts` agar visual layer bisa diuji tanpa edit JSON.
- Checkout demo memakai flow domain shared dari `WebsiteActionPanel`: domain baru atau domain milik sendiri, inline check, dan email hanya setelah domain lolos pre-check.
- Download/setup action panel memakai `WebsiteActionPanel` dengan `variant="demo"`, shared dengan public preview.
- `WebsiteActionPanel` dan inline edit panel diberi `data-wv-tool-ui` agar QA boundary bisa mendeteksi apakah tool UI tidak sengaja masuk ke canvas website.

### `src/pages/public/PublicViewer.tsx`

Fungsi:
- Render website preview berdasarkan JSON site.
- Tracking view lead.
- Menampilkan CTA download HTML dan payment link.
- `/terms-refund` menampilkan terms/refund policy untuk generated digital packages dan managed launch support; checkout modal menautkan halaman ini sebelum payment.

API yang dipakai:
- `POST /api/leads/:businessId/ping?owner=1`
- `GET /api/public-settings`
- `GET /api/sites/:businessId`

Logic penting:
- Jika JSON site ditemukan, halaman meneruskan data ke `SiteRenderer`.
- Public preview view tracking only fires from real owner review params (`?owner=1`, `?review=owner`, or `?claim=1`) and explicitly excludes `ownerPreview=1` / `reviewPreview=1`. CRM displays owner-only view counters from `owner_view_count` / `owner_last_viewed_at`, so older admin/internal preview opens do not appear as owner views.
- Fetch `GET /api/sites/:businessId` memakai retry singkat dengan cache-busting query dan `cache: "no-store"` sebelum menampilkan error. Ini mengurangi kasus preview public terlihat 404 sesaat setelah generate/regenerate ketika D1/R2/edge masih sync.
- Error public tidak lagi memakai copy `404 - Not Found`; UI menampilkan pesan "preview is still preparing" plus tombol `Try again`, supaya owner tidak melihat halaman yang terasa rusak saat kondisi sementara.
- `handleDownloadZip(siteData?)` membuat zip HTML statis dari DOM preview aktif plus site data aktif yang dikirim `WebsiteActionPanel`, sehingga palette pilihan, inline text edits, dan image replacements di public renderer ikut masuk export.
- Panel prospek dari `SiteRenderer` memakai `WebsiteActionPanel` dengan `variant="public"`, sehingga flow download/setup sama dengan `/demo`.
- Jika site lama tidak punya `brand.paletteOptions`, `SiteRenderer` membuat fallback option dari `brand.palette`, `meta.brandPalette`, atau `design.themeVariables.colors`.
- Payment checkout memakai `POST /api/payments/checkout`; payment link basic/premium lama masih bisa dibaca tapi bukan flow utama.

Risiko debug:
- Jika halaman tetap menampilkan preview loading issue setelah retry, cek row `json_sites.business_id`; jika row ada tetapi API mengembalikan 502, cek R2 binding/object `sites/{businessId}/{businessId}.json`.
- Jika warna/typography rusak, cek shape `design.themeVariables` di JSON.

### `src/pages/public/MarketingAuditViewer.tsx`

Fungsi:
- Route `/audit/:businessId` untuk laporan Google Business Profile marketing audit yang owner-facing.
- Mengubah audit deterministic dari API menjadi score overview, owner problem copy, evidence panels, competitor table, WebView.click service recommendations, dan tombol PDF.

API yang dipakai:
- `GET /api/audits/:businessId`
- `POST /api/audits/:businessId/snapshots`
- `GET /api/audits/:businessId/snapshots`

Logic penting:
- Route ini didefinisikan sebelum `/:businessId` di `src/App.tsx` agar URL audit tidak tertangkap oleh public website preview.
- Jika `:businessId` adalah generated site ID, audit memakai site JSON plus prospect/lead fallback; jika ID adalah `places_prospects.place_id`, audit tetap bisa jalan untuk gathered prospect yang belum digenerate.
- Owner-facing copy berasal dari deterministic `src/lib/marketingAuditCopy.ts`, bukan AI. Copy memilih industry profile seperti dental/medical, contractor, restaurant/cafe, salon/spa, fitness, automotive, professional service, retail, atau generic local service.
- Evidence panels adalah generated report sections dari audit JSON, bukan screenshot eksternal Google/competitor page.
- `Download audit PDF` memakai `src/lib/exportMarketingAuditPdf.ts` untuk PDF selectable yang berisi score, problem framing, evidence panels, score breakdown, recommended action plan, dan source notes.
- Admin-opened URLs use `?admin=1` and show `Save audit snapshot`. Saving calls `POST /api/audits/:businessId/snapshots`, stores JSON in R2, updates URL to `?admin=1&snapshot={auditId}`, and shows a stale warning when saved source hash differs from the current live audit source hash.
- Public/owner audit URLs omit `admin=1`, so they show the report and PDF download without snapshot controls.

Risiko debug:
- Jika audit low-confidence, cek apakah `places_prospects.query` punya cached `places_search_cache` result set.
- Jika website false-positive masih lolos sebagai real website, update classifier domain list di `src/lib/marketingAudit.ts`.
- Jika snapshot save gagal, cek R2 binding dan table `marketing_audits`; PDF tetap bisa dibuat on-demand dari live audit tanpa snapshot.

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

### `src/lib/marketingAudit.ts`

Fungsi:
- Deterministic scorer untuk `/audit/:businessId`.
- Normalizes target business from generated site JSON, `places_prospects`, and `leads`.
- Normalizes cached competitor rows and computes a 100-point audit score.

Logic penting:
- Website URL classifier distinguishes `owned_website`, `social_profile`, `link_hub`, `directory_or_marketplace`, `booking_only`, `unknown_or_unreachable`, and `missing`; only `owned_website` counts as a full website.
- Score categories: website/customer research path, reviews/social proof, photos/visual proof, profile completeness, local competitor position, and conversion readiness.
- Owner review replies and photo recency are intentionally missing-data notes, not scored, because current third-party Places data is not reliable for those claims.
- Generates screenshot-friendly evidence cards from audit data for the UI/PDF proof layer.
- Targeted tests live in `tests/marketingAudit.test.ts`.

### `src/lib/marketingAuditCopy.ts`

Fungsi:
- Deterministic owner-facing copy registry for GBP audits.
- Makes audits feel customized without AI by matching industry/niche and issue flags.

Logic penting:
- Industry profiles include dental/medical, home services, restaurant/cafe, salon/spa/beauty, fitness/wellness, automotive, professional services, retail/local shop, and generic local service fallback.
- Copy slots cover owner pressure, customer decision moment, website gap, partial social/directory website gap, review/rating/photo problems, operational overhead pressure, seasonality where relevant, and recommendation tone.
- Copy assembly only emits problem framing when the triggering audit evidence exists.

### `src/lib/exportMarketingAuditPdf.ts`

Fungsi:
- Browser-side selectable PDF exporter for `MarketingAuditViewer`.

Logic penting:
- Uses a small internal PDF text writer and `file-saver`; no new PDF dependency.
- Includes score, owner problem copy, generated evidence panels, category breakdown, WebView.click services, and source notes.

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

### `src/lib/generatedSitePostProcess.ts`

Fungsi:
- Pure generated-site post-processing helpers shared by Cloudflare generation and renderer normalization.

Logic penting:
- `ensureContactPage(site, originData)` menambahkan page `contact` dengan section `contactForm` dari section contact-like lama, `businessProfile`, `location`, `hours`, `sourceData`, footer, dan origin Google Places.
- Contact page hours are language-aware and compacted; repeated daily hours become lines like `Daily: 6:00 AM - 11:00 PM`, and Indonesian pages use labels such as `Setiap hari`, `Sen-Sab`, and `Tutup`.
- `ensureServicesPage(site)` menambahkan aggregate page `services` dari `products`, `services`, atau `offers`, termasuk children nav menuju detail pages jika header navigation sudah tersedia.
- `repairServiceCardImages(site, originData)` menyinkronkan image field untuk products/services/offers dan setiap offers-section card dari saved gallery images, saved detail-page hero/detail images, brand images, dan Google Places photos. Helper ini merotasi gambar gallery/Places ketika card/detail images duplikat supaya service grid tidak memakai gambar yang sama berulang, dan membuat preview homepage/services grid bisa diperbaiki tanpa AI regenerate.
- `ensureFeedbackPage(site)` menambahkan page `feedback` tanpa memasukkannya ke header navigation.
- `ensureGalleryPage(site, originData)` menambahkan page `gallery` jika minimal dua gambar usable tersedia dari brand, products/services/offers, atau Google Places photos.
- `applyGeneratedSitePageInserts(site, originData)` menjalankan urutan shared `repair service card images -> services -> contact -> feedback -> gallery`, dan dipakai oleh Function generation serta `SiteRenderer` runtime normalization.
- Gallery nav disisipkan sebelum `#contact` jika contact nav sudah ada.
- Modul ini DOM-free dan dependency-free supaya aman dipakai dari `functions/api/[[path]].ts`, React renderer, dan fixture tests.
- Fixture tests ada di `tests/generatedSitePostProcess.test.ts`; jalankan `npm run test:postprocess` saat local dependencies tersedia.

### `src/lib/generatedSiteScaffold.ts`

Fungsi:
- Shared deterministic generated-site scaffold builder used before AI copy enrichment.

Logic penting:
- `buildGeneratedSiteScaffold(place, options)` creates the fallback JSON shape from Google Places data, selected image, palette, and business id.
- Font pairing selection uses `fontPairingVariantForText()` from `src/lib/fontPairings.ts`: first build the industry-matched allowed set, then choose a stable variant from business name, business id, Place ID, and address. This gives same-industry generated sites different typography without random reshuffling on refresh.
- The scaffold includes `meta`, `sourceData`, `design`, `brand`, `businessProfile`, `trust`, `productServiceStrategy`, products/services/offers, capabilities, `location`, root `locationServed`, hours, conversion, SEO, navigation, homepage sections, and offering detail pages. `locationServed` is taken from explicit Places/service-area fields when present, otherwise conservatively derived from locality/address components.
- The scaffold seeds multiple plausible service/product offerings from business name, category, and search query for common niches such as concrete, roofing, plumbing, HVAC, cleaning, landscaping, medical, restaurants, florists, furniture, and retail. AI copy patch then rewrites those slots with richer industry-specific copy.
- The builder calls `applyGeneratedSitePageInserts()` so services/contact/feedback/gallery pages are centralized with post-processing.
- `/admin/leads` and `/admin/sites` both use this builder before calling `/api/sites/generate`, so first generate and regenerate-from-gathered flows no longer maintain separate fallback JSON shapes.
- Utility helpers include `businessSlug`, `placeDisplayName`, `placePhone`, `placeMapsUrl`, `photoReference`, and `photoAttributions`.
- Fixture tests live in `tests/generatedSiteScaffold.test.ts`; run `npm run test:scaffold` when local dependencies are installed.

### `src/lib/adminSiteGeneration.ts`

Fungsi:
- Shared admin orchestration for generate/regenerate flows.

Logic penting:
- `ensureAiGenerationReady()` centralizes provider cooldown checks, remote AI readiness checks, and blocked job audit logging before any AI-required `/api/sites/generate` call.
- `ensureNoProviderCooldown()` is reused by the batch queue so batch generation pauses from the same server-side cooldown logic as one-off generate/regenerate.
- `fetchGooglePlaceDetails()` centralizes Place Details fetch/parsing and non-JSON error handling.
- `buildScaffoldGeneratePayload()` and `buildSelectedPhotoGeneratePayload()` centralize fallback scaffold creation plus `/api/sites/generate` payload fields (`jsonContent`, `originData`, brand palette, selected logo/photo metadata, provider/model, and phone).
- Photo helpers in this module centralize Google photo URL creation, attribution cleanup, owner-like/UGC priority scoring, sorted photo lists, prospect selection persistence payloads, palette option payloads, and generate-time selected photo/palette resolution.
- `postGenerateSite()` is the shared POST wrapper for `/api/sites/generate`, using `readApiJson()` so Cloudflare/provider HTML errors stay actionable. `readApiJson()` accepts an explicit request path fallback and includes request path plus HTTP status in thrown raw messages, so admin toasts show which Pages Function endpoint returned HTML/non-JSON or failed JSON even when `response.url` is empty.
- `/admin/leads` and `/admin/sites` should call this helper for new generate/regenerate flows instead of hand-writing readiness, cooldown, scaffold, or generate POST logic.
- Fixture tests live in `tests/adminSiteGeneration.test.ts`; run `npm run test:admin-generation` when local dependencies are installed.

### `src/lib/domainExtensions.ts`

Fungsi:
- Daftar extension domain yang ditawarkan di checkout demo.
- Kategori extension untuk selector searchable/filterable.
- Helper `normalizeDomainLabel()` dan `buildDomain()`.

### `src/lib/providerFailure.ts`

Fungsi:
- Browser helper untuk membaca last AI provider failure dari `/api/ai/provider-failure`.

Logic penting:
- Cache 30 detik per provider/model agar banyak readiness badge dengan pilihan yang sama tidak membuat D1 read berulang.
- Dipakai oleh `AdminAiReadinessBadge` untuk chip `Last fail` setelah generate/regenerate/retry pernah gagal.

### `src/lib/providerHealth.ts`

Fungsi:
- Browser helper untuk membaca ringkasan failure rate 24 jam dari `/api/ai/provider-health`.

Logic penting:
- Cache 30 detik per provider/model.
- Cache ikut dibersihkan oleh `AdminAiReadinessRefreshButton` supaya Settings bisa refresh readiness, last failure, dan health sekaligus.

## Cloudflare Pages Functions

### `src/lib/apiErrorInsights.ts`

Fungsi:
- Interpreter error API untuk toast admin.

Logic penting:
- Mengklasifikasi 429/rate limit/quota, IP whitelist/allowlist rejection, 401/402/403 key-permission-billing-credit, 400 payload/model invalid, Cloudflare/HTML/non-JSON API responses, dan 455/5xx/provider temporary failure.
- Untuk Gemini 429 `RESOURCE_EXHAUSTED`, message menjelaskan bahwa quota/rate limit diterapkan per project, lalu menyarankan wait/retry, hentikan batch retry, switch model/provider, atau naikkan quota/billing.
- Provider cooldown memakai strategi konservatif: Gemini/OpenAI/custom default 90 detik untuk rate limit per menit, OpenRouter 75 detik kecuali ada retry hint, KIE.ai 30 detik karena KIE mendokumentasikan burst limit pendek, dan quota/billing/daily cases lebih lama.
- Dipakai oleh `AdminToast.showApiError()` supaya UI menampilkan meaning/action items, bukan hanya raw provider string.

### `functions/api/[[path]].ts`

Fungsi:
- Catch-all API production untuk `/api/*` di Cloudflare Pages.
- Menggantikan Express API saat deploy di Cloudflare Pages.
- Route handler ini sekarang terutama menyiapkan dependency wiring, menjalankan DB bootstrap, lalu dispatch ke focused modules seperti `functions/api/settings/handler.ts`, `functions/api/stats/handler.ts`, `functions/api/leads/handler.ts`, `functions/api/prospects/handler.ts`, `functions/api/sites/handler.ts`, `functions/api/places/handler.ts`, `functions/api/payments/handler.ts`, `functions/api/domains/handler.ts`, dan `functions/api/cloudflare/handler.ts`.
- Cloudflare Pages deployment history logs can be brought into admin via the official Cloudflare API `GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs`, but it requires explicit env/settings credentials (`CLOUDFLARE_ACCOUNT_ID`, Pages project name, restricted API token). Live Functions tail logs are a separate dashboard/Wrangler streaming workflow and should not be presented as stored historical logs unless Cloudflare exposes a stored API source.

Endpoint:
- `GET/POST /api/settings`
- `GET /api/public-settings`
- `GET /api/schema`
- `GET /api/stats`
- `GET /api/activities`
- `GET /api/leads`
- `PUT /api/leads/:id/status`
- `PUT /api/leads/:id/contact`
- `GET /api/leads/payments`
- `POST /api/leads/:id/payment-verified`
- `POST /api/leads/:business_id/ping?owner=1` updates owner-only view fields and ignores normal preview/safe preview requests.
- `GET /api/prospects`
- `PUT /api/prospects/:placeId/status`
- `PUT /api/prospects/:placeId/selection`
- `GET /api/audits/:businessId`
- `GET /api/places/search`
- `GET /api/places/history`
- `GET /api/places/photo`
- `GET /api/places/details`
- `POST /api/places/manual-import`
- `POST /api/places/cache/trim`
- `GET/POST /api/ai/readiness`
- `POST /api/sites/generate`
- `POST /api/sites/backfill-lead-phones`
- `POST /api/sites/migrate-r2`
- `POST /api/sites/:businessId/repair-service-images`
- `POST /api/sites/:businessId/refresh-visual-variation`
- `GET /api/sites`
- `GET /api/sites/:business_id`
- `POST /api/payments/checkout`
- `POST /api/payments/paypal-webhook`
- `GET /api/domains/check`
- `GET /api/cloudflare/pages-logs`

Logic D1:
- Binding wajib: `DB`.
- Shared D1/response/schema helpers live in `functions/api/_shared/*`: `types.ts` untuk binding types, `response.ts` untuk JSON/body/parse/hash helpers, `db.ts` untuk common D1 helpers/settings/daily usage, dan `schema.ts` untuk table setup, repair report, serta required-column lists.
- `setupTables()` membuat tabel jika belum ada.
- `addColumnIfMissing()` menjalankan migrasi ringan berbasis `PRAGMA table_info`.
- `addColumnIfMissing()` menangani duplicate-column race dan retry tanpa `DEFAULT` jika D1 menolak alter tertentu.
- Write path penting tetap defensif terhadap schema production lama: `/api/sites/generate`, `/api/payments/checkout`, `/api/places/details`, dan `/api/prospects/:placeId/selection` menjalankan self-heal kolom penting terlebih dahulu, lalu menulis dengan kolom lengkap.
- Kolom penting tidak boleh diam-diam dilewati. Jika `ALTER TABLE` gagal atau kolom masih hilang setelah self-heal, Function mengembalikan error eksplisit agar schema D1 diperbaiki, bukan menyimpan data setengah lengkap.
- `/api/stats`, `/api/activities`, dan `/api/settings` punya fallback JSON agar admin tidak blank saat DB belum sempurna.
- `/api/stats` juga mengembalikan `dailyUsage` dari tabel `daily_usage_counters` untuk counter harian quota-sensitive, termasuk `history` 30 hari terakhir.

Logic router modules:
- Settings endpoints live in `functions/api/settings/handler.ts`: `GET/POST /api/settings` and `GET /api/public-settings`.
- Dashboard stats/activity endpoints live in `functions/api/stats/handler.ts`: `GET /api/stats` and `GET /api/activities`.
- Lead endpoints live in `functions/api/leads/handler.ts`: `GET /api/leads`, `PUT /api/leads/:id/status`, `GET /api/leads/payments`, `POST /api/leads/:id/payment-verified`, and `POST /api/leads/:business_id/ping`.
- Prospect endpoints live in `functions/api/prospects/handler.ts`: filtered `GET /api/prospects`, `PUT /api/prospects/:placeId/status`, and `PUT /api/prospects/:placeId/selection`.
- Audit endpoint lives in `functions/api/audits/handler.ts`: `GET /api/audits/:businessId` builds deterministic Google Business Profile marketing audit JSON from generated site/prospect/lead fallback sources plus cached competitor rows. It supports generated `business_id` and prospect `place_id`, does not call AI, does not refresh Google Places, and returns confidence/missing-data notes.
- Audit snapshots: `POST /api/audits/:businessId/snapshots` saves the current audit JSON to R2 under `audits/{businessId}/{auditId}.json` and writes metadata to `marketing_audits`; `GET /api/audits/:businessId/snapshots` lists recent metadata; `GET /api/audits/:businessId?snapshot={auditId}` reads saved JSON and marks it stale if the current live source hash differs.
- Endpoint-level fixtures for extracted API handlers live in `tests/apiHandlers.test.ts`; run `npm run test:api-handlers` when local dependencies are installed, or trigger the manual GitHub Actions workflow `API Handler Tests` to run `npm ci` and the fixture suite remotely without installing dependencies locally.

Logic AI:
- AI site generation helpers live in `functions/api/ai/siteGeneration.ts`. The router passes dependencies for settings, readiness, provider diagnostics, and KIE model config, while the module owns JSON object provider calls, one-shot JSON repair, offering outline normalization/apply, copy target brief creation, copy patch generation, deterministic merge, and copy audit helpers.
- AI readiness, remote model validation cache, provider failure diagnostics, and provider health endpoints live in `functions/api/ai/readiness.ts`.
- Provider cooldown API handling and cooldown event audit/pruning live in `functions/api/providerCooldowns/handler.ts`.
- Targeted tests for offering outline normalization and copy audit behavior live in `tests/siteGeneration.test.ts`; run `npm run test:site-generation` when local dependencies are installed.
- OpenRouter/OpenAI/Opencode memakai format Chat Completions.
- Gemini memakai endpoint Google Generative Language.
- KIE.ai mendukung:
  - `kie/gemini-2.5-flash` via `https://api.kie.ai/gemini-2.5-flash/v1/chat/completions`
  - `kie/gemini-3-flash` via `https://api.kie.ai/gemini-3-flash/v1/chat/completions`
  - `kie/gpt-5-4` via `https://api.kie.ai/codex/v1/responses`
  - `kie/gemini-3.1-pro` via `https://api.kie.ai/gemini-3.1-pro/v1/chat/completions`
  - `kie/gpt-5-5` via `https://api.kie.ai/codex/v1/responses`
  - `kie/gpt-5-2` via `https://api.kie.ai/gpt-5-2/v1/chat/completions`
- `/api/ai/readiness` adalah preflight ringan untuk provider/model AI: membaca key dari `system_settings` atau env binding, mengecek provider didukung, dan mengecek model ada di registry internal. Jika query/body membawa `remoteValidate=1`, endpoint juga menjalankan metadata/provider check sebelum generate: OpenRouter `GET /api/v1/models` plus `GET /api/v1/models/{author}/{slug}/endpoints`, OpenAI `GET /v1/models/{model}`, Gemini `GET /v1beta/models/{model}`, dan KIE `GET /api/v1/chat/credit` plus registry endpoint mapping. Opencode tetap memakai registry lokal karena custom endpoint ringan belum aman digeneralisasi.
- `/api/sites/generate` sekarang menjalankan readiness remote preflight juga saat `requireAi: true`, sehingga server-side generate tidak hanya mengandalkan badge browser. Jika preflight server memblokir, row `generation_jobs.metadata_json` menyimpan `preflightBlocked`, `aiReadiness`, dan `remoteValidation`. KIE generate memakai shared `kieModelConfigs`, tidak silent fallback ke model lain, dan error provider mencantumkan selected model plus endpoint.
- Provider generation failures untuk OpenRouter, OpenAI, Gemini, KIE.ai, dan Opencode sekarang disimpan sebagai `metadata_json.aiFailure`/`providerFailure` dengan `failureKind`, `stage`, `httpStatus`, provider code/status bila ada, endpoint, retryable flag, raw snippet, dan action hint. Kind mencakup `quota_or_rate_limit`, `credits_or_billing`, `auth_or_permission`, `bad_request_or_model`, `provider_temporary`, `network_error`, `empty_response`, `invalid_json`, `provider_cooldown`, dan `unknown_provider_error`.
- `/api/ai/provider-failure` membaca failed `generation_jobs` terbaru 14 hari terakhir untuk provider/model tertentu dan mengembalikan ringkasan last failure untuk readiness badge.
- `/api/ai/provider-health` membaca `generation_jobs` 24 jam terakhir untuk provider/model tertentu dan mengembalikan total/success/failed, preflight/cooldown blocked, failure rate, latest failure, dan top failure kind. Endpoint ini tidak memanggil provider eksternal.
- `/api/ai/provider-health` juga mengembalikan `serviceCopyRecommendation` bila recent failures mengandung HTTP 524, provider_temporary, network_error, empty_response, Cloudflare/HTML/timeout text, atau stage `offeringCopy`. UI memakai ini untuk badge `Recommended: Slow mode` di service-copy retry points.
- Remote readiness validation memakai cache D1 `ai_readiness_cache` dengan TTL pendek 2 menit per provider/model/key hash. Query/body `refresh=1` atau `bypassCache=1` melewati cache server dan menulis hasil baru; tombol `Refresh AI readiness` mengirim bypass ini untuk recheck setelah key/model diubah.
- Live remote readiness validation yang miss/bypass cache menambah counter harian `ai_readiness_remote`; hit cache server tidak dihitung sebagai provider metadata call baru.
- `/api/provider-cooldowns` menyimpan cooldown provider di D1 `provider_cooldowns`. Toast 429/quota menulis cooldown ke endpoint ini, badge admin membacanya, dan generate/regenerate/retry memanggil shared cooldown sebelum request mahal agar session admin lain ikut tertahan.
- `/api/provider-cooldowns/history` membaca D1 `provider_cooldown_events` untuk feed audit kecil di `/admin/settings`. Event ditulis saat cooldown di-set, cooldown di-clear manual, dan generate/regenerate/retry diblokir oleh cooldown.
- Setiap insert `provider_cooldown_events` menjalankan prune ringan: hapus event lebih lama dari 45 hari dan batasi tabel ke 500 row terbaru, supaya audit tidak tumbuh tanpa batas di D1.
- Jika request `/api/sites/generate` membawa `requireAi: true`, Function gagal eksplisit saat AI key hilang, provider/model tidak valid, provider mengembalikan HTTP error, response kosong, atau JSON invalid. Generate/regenerate AI dari `/admin/leads`, `/admin/sites`, dan job retry memakai `requireAi: true` agar masalah AI terlihat; mode `Re-gather Google data + resave` tetap tanpa AI.
- Admin generate/regenerate/retry calls memakai `checkAiReadiness(..., remoteValidate=true)` sebelum `/api/sites/generate`, sehingga model remote yang tidak dikenal bisa gagal di preflight tanpa menghabiskan klik generate penuh.
- Jika preflight AI memblokir generate/regenerate/retry di browser, UI memanggil `POST /api/generation-jobs/preflight-failure` untuk menyimpan row `generation_jobs` berstatus `failed`; `metadata_json.aiReadiness` dan `metadata_json.remoteValidation` menyimpan alasan key/registry/provider routing yang memblokir.
- Jika shared provider cooldown memblokir generate/regenerate/retry di browser, UI memanggil `POST /api/generation-jobs/cooldown-blocked` untuk menyimpan row `generation_jobs` berstatus `failed`; `metadata_json.cooldownBlocked`, `metadata_json.providerCooldown`, dan `failureStage: "provider_cooldown"` membuat attempt yang dipause tetap terlihat di Jobs.
- Saat `jsonContent` scaffold dikirim ke `/api/sites/generate`, AI tidak lagi diminta mengembalikan full website JSON. Function pertama meminta outline kecil `strategy + offerings` untuk menginfer service/product lines dari business name, niche, kategori, search query, alamat, dan review themes; hasilnya disanitasi lalu dipakai untuk rebuild deterministik `products`, `services`, `offers`, homepage offer cards, nav children, dan individual detail pages.
- Setelah outline service/product diterapkan, Function membuat `copyTargetBrief` yang hanya berisi fakta bisnis dan target teks yang bisa diperbaiki. Chunk `siteCopy` fokus pada meta/homepage/general site copy, lalu chunk `offeringCopy` fokus pada `offerings` dan halaman detail service/product agar copy detail tidak kalah oleh homepage copy dalam satu response besar. `offeringCopy` membaca `AI_SERVICE_COPY_PROVIDER_MODES_JSON` dari Settings untuk menentukan `copyPatchOfferingBatchSize`; default semua provider adalah 1 service/product per request, sedangkan model yang terbukti cepat bisa dinaikkan lewat Settings sampai 4. Jika `offeringCopy` terkena transient edge/provider failure, browser retry mengirim `forceOfferingCopyBatchSize: 1` dan Function juga menyimpan `metadata.offeringCopyForceBatchSizeOne` agar resume job berikutnya tetap single-item walaupun Settings batch lebih tinggi.
- Full scaffold JSON tidak dikirim ke AI. AI tidak melihat image URL, maps URL, navigation href, sourceData mentah, palette, font, visual style, favicon, CSS, storage, atau field protected lain.
- Output outline AI tidak dipercaya sebagai site JSON: Function clamp text, membatasi 12 offering, membuat `id`/`detailPageId` sendiri, membuang stale detail pages/services aggregate page, lalu menjalankan `applyGeneratedSitePageInserts()` untuk membuat ulang services/contact/feedback/gallery secara konsisten. Jika outline pertama invalid JSON, Function mengirim parse error dan snippet output rusak kembali ke AI sekali lagi untuk repair; jika tetap gagal, scaffold offerings tetap dipakai dan error dicatat di `generation_jobs.metadata_json.offeringOutlineError`.
- Sanitasi copy AI memakai clamp sentence/word-aware, bukan `.slice()` mentah, dan hero subheadline diberi batas lebih longgar agar copy first-person tidak putus di tengah kata/kalimat.
- Untuk OpenRouter, model value UI yang diawali `~` dikirim apa adanya ke API karena OpenRouter memakai prefix itu untuk latest-model resolution seperti `~anthropic/claude-sonnet-latest`.
- Copy patch AI di-merge deterministik oleh Function lewat `applyAiCopyPatch()`. AI tidak boleh mengubah `pageId`, `detailPageId`, navigation href, sourceData, photo URL, contact/maps fields, palette, font, visual style, storage, atau favicon.
- Jika submitted JSON lama belum punya `design.shaderPreset`, Function mengisi shader procedural dari niche/context via `shaderPresetForBusiness()` sebelum menyimpan site.
- Sebelum JSON disimpan ke D1/R2, Function menjalankan shared `applyGeneratedSitePageInserts()` dari `src/lib/generatedSitePostProcess.ts` agar semua generate/regenerate punya page services/contact/feedback/gallery, conversion metadata, source-safe proof badges, CTA cleanup, FAQ depth, service detail depth, dan `finalCta` yang konsisten. Ini membuat source/export JSON cocok dengan renderer runtime normalization.
- `applyGeneratedSitePageInserts()` sekarang mengisi `conversion.pagePattern`, `conversion.primaryAction`, `conversion.primaryActionReason`, `conversion.proofBadges`, `conversion.sourceSafeProofInputs`, dan `conversion.conversionAudit`. Audit mencatat `primaryCtaSpecific`, `proofAboveFold`, `objectionsCovered`, `finalCtaPresent`, `heroSpecific`, `competingPrimaryCtas`, `thinServicePages`, dan `flags`.
- Post-process juga mengisi `design.highTicketStyleDirection`, `design.designIntent`, `design.designAudit`, dan top-level intent fields seperti `compositionPattern`, `heroLayout`, `mediaStrategy`, `proofTreatment`, `cardDensity`, `ctaTreatment`, `motionLevel`, `sectionRhythm`, `detailLayout`, dan `antiPatterns`. Intent dipilih deterministik dari `conversion.pagePattern`, media availability, dan vertical text; style preset / visual style dilengkapi jika masih generic.
- AI copy brief dari `functions/api/ai/siteGeneration.ts` menyertakan `premiumConversionBrief` supaya outline dan copy patch mengikuti page pattern, primary action, proof badges, objection handling, scannability guardrails, serta larangan klaim palsu seperti sertifikasi, garansi, tahun berdiri, financing, named clients, atau exact price jika tidak bersumber.
- Function membuat audit granular dari target copy sebelum patch dan copy final setelah patch. Audit ini disimpan di `generation_jobs.metadata_json.copyAuditSummary` dan `copyAuditItems`, dengan status `ai_rewritten`, `ai_filled_blank`, `source_kept`, `fallback_source`, atau `missing_after`.
- Chunk `offeringCopy` juga menyimpan `offeringCopyCursor`, `offeringCopyTotal`, per-item brief/patch hashes, cumulative `offeringCopyPatch`, dan `offeringCopyCoverage` yang membandingkan offering JSON sebelum/sesudah patch untuk summary, description, highlights, dan detail-page FAQ per service/product. Badge `/admin/jobs` memakai nilai ini untuk menandai coverage tinggi, sedang, rendah, dan progress partial.
- Jika copy patch AI sukses, `meta.generatedWithAi=true` dan `meta.generationMode=ai_copy_patch`; jika gagal dan `requireAi` false, scaffold/fallback JSON tetap disimpan dengan `submitted_json_ai_fallback`.
- Gallery hanya dibuat jika minimal dua gambar tersedia dari foto Places/brand/offers, meskipun model AI lupa membuatnya.

Logic Google Places/logo:
- Places handlers live in `functions/api/places/handler.ts`; `functions/api/[[path]].ts` wires dependencies and dispatches routes. The Places module owns search/details/manual import/cache trim, prospect upsert, website precheck, photo proxy, search history hydration, shared prospect row normalization, and manual duplicate review/merge.
- `/api/places/search` memakai Google Places Text Search.
- Live Google Places Text Search menambah counter harian `places_search`; hasil dari `places_search_cache` tidak menambah counter search.
- `/api/places/photo` mem-proxy Google Places Photo agar frontend bisa membaca pixel untuk palette.
- `brandPalette` dan `selectedLogoImageUrl` dikirim dari `AdminLeads` ke generator.
- `selectedLogoReference`, `selectedLogoSource`, `selectedLogoAttributions`, dan `selectedLogoPriority` ikut dikirim agar JSON final menyimpan provenance foto.
- Function memaksa `businessId` masuk ke `meta.businessId` dan menjaga `logoImageUrl` jika dipilih admin.
- Function menganggap `https://www.google.com/maps/search/?api=1&query=...` sebagai URL fallback lemah. Saat Place Details memberi `url` exact, Function menimpa `sourceData.googleMapsUri`, `businessProfile.contact.directionsUrl`, dan `location.directionsUrl`.
- Jika logo dipilih, Function juga menulis `brand.logoImageUrl`, `brand.photoSource`, `brand.googlePhotoReference`, `brand.photoCaption`, `brand.photoAttributions`, dan `brand.selectedPhotoPriority`.

Logic R2:
- `/api/sites` route handling lives in `functions/api/sites/handler.ts`: site list/read/copy brief, no-AI service card image repair, `POST /api/sites/generate`, final lead/prospect/activity writes, generation job success/failure updates, deterministic visual/font/favicon defaults, and the save path shared by chunked job finalize.
- R2/site storage helpers live in `functions/api/sites/storage.ts`; `functions/api/sites/handler.ts` calls this module for image filename normalization, image asset upload, JSON upload/read, compact manifests, public R2 URLs, and `POST /api/sites/migrate-r2`.
- `siteSummaryFromJson()` stores service-card image audit fields (`serviceCardImageTotal`, `missingServiceCardImageCount`, `duplicateServiceCardImageCount`, `hasMissingServiceCardImages`, `hasDuplicateServiceCardImages`, `needsServiceCardImageRepair`, `lastImageRepairAt`) and visual variation fields (`fontPairing`, `fontPairingLabel`, `lastVisualVariationAt`) so `/api/sites` can badge/filter missing/duplicate images and show repair/visual pass timestamps from D1 summaries without reading every full R2 JSON.
- Binding optional: `R2`.
- Public URL: `R2_PUBLIC_BASE_URL`, default/fallback production `https://assets.webview.click`.
- Bucket CORS policy for `assets.webview.click` lives in `cloudflare/r2-cors-webview.json`, is applied with `npm run r2:cors`, and can be inspected with `npm run r2:cors:list`. It allows public `GET`/`HEAD` reads with wildcard origins so admin palette extraction can load R2 images using `<img crossOrigin="anonymous">` without tainting canvas. Applying this requires a Wrangler login/API token with R2 bucket CORS edit permission.
- Saat `POST /api/sites/generate`, Function:
  - Menormalisasi filename image non-URL agar mengandung slug `businessId`.
  - Meng-upload image URL non-Google yang bisa di-fetch ke `sites/{businessId}/assets/{businessId}-asset-XX.ext`.
  - Melewati Google Places photo URLs (`/api/places/photo`, Google photo media, `googleusercontent.com`) agar free preview tidak menyimpan ulang foto Google ke R2.
  - Meng-upload JSON final ke `sites/{businessId}/{businessId}.json`.
  - Menambahkan metadata `storage.r2JsonKey`, `storage.r2JsonUrl`, dan `storage.r2AssetKeys` ke JSON.
- D1 `json_sites` tidak lagi menyimpan full JSON untuk situs baru jika R2 tersedia. D1 hanya menyimpan manifest/summary kecil di `json_content`, plus `r2_json_key`, `r2_json_url`, dan `json_summary`.
- `GET /api/sites/:businessId` membaca full JSON dari R2 jika row D1 punya `r2_json_key`; row lama yang masih menyimpan full JSON di D1 tetap dibaca sebagai fallback.
- `GET /api/sites` memakai `json_summary`/manifest dari D1 untuk list admin, sehingga tidak perlu membaca full JSON R2 untuk setiap row.
- `GET /api/sites` juga returns `auditSnapshotCount` / `latestAuditSnapshotAt` dari `marketing_audits` dan `latestGenerationJobId`, `latestGenerationJobStatus`, dan `latestGenerationJobUpdatedAt` dari latest matching `generation_jobs.business_id`, dipakai `/admin/sites` untuk badge audit snapshot dan jump langsung ke audit row.
- `GET /api/sites/:businessId` menandai `json_sites.last_preview_error` dan `last_preview_error_at` bila full JSON gagal dibaca dari R2/manifest, sehingga `/admin/sites` bisa menampilkan filter `Recovery` untuk preview yang rusak tanpa harus membuka setiap site manual. Marker dibersihkan saat read berikutnya sukses atau saat `saveJsonSiteRecord()` menyimpan site JSON baru.
- `POST /api/sites/migrate-r2` adalah maintenance action untuk row lama: upload full JSON D1 ke R2, update `storage.r2JsonKey`, lalu replace `json_content` dengan compact manifest. Jika R2 belum binding, endpoint gagal eksplisit.
- `POST /api/sites/scan-r2-health` menerima `limit`/`offset`, membaca hanya row dengan `r2_json_key`, mencoba `readSiteJsonFromStorage()` untuk setiap row, menulis `last_preview_error` pada failure, dan menghapus marker pada success. `/admin/sites` memanggil endpoint ini sequential dalam chunk 10 dengan cap 50 per klik agar Pages Function tidak timeout.
- `POST /api/sites/:businessId/resave-json-summary` membaca full JSON dari R2/D1, menjalankan deterministic page inserts, menulis `meta.lastJsonSummaryRepairAt`, rebuild `json_summary`, dan re-save compact manifest/full JSON tanpa AI. Dipakai oleh `/admin/sites` untuk row `summary_error`; jika full JSON R2 tidak bisa dibaca, endpoint mengembalikan 409 agar admin tahu perlu regenerate/restore dari backup.
- `POST /api/sites/:businessId/restore-from-latest-job` mencari beberapa `generation_jobs` sukses terbaru untuk business tersebut, mengikuti `parentGenerationJobId` bila latest row adalah final save job, lalu rebuild full JSON dari `metadata.payload.jsonContent`, `metadata.offeringOutline`, dan `metadata.copyPatch`. Endpoint menulis `meta.lastRestoredFromGenerationJobAt` dan `meta.restoredFromGenerationJobId`, lalu menyimpan ulang R2/D1 summary. Jika tidak ada job metadata yang cukup, endpoint mengembalikan 409.
- `POST /api/sites/:businessId/repair-service-images` membaca full JSON dari R2/D1, menjalankan shared `repairServiceCardImages()` plus post-processing inserts, menulis `meta.lastImageRepairAt`, lalu menyimpan ulang JSON/manifest. Response mengembalikan `changed`, `availableImages`, `lastImageRepairAt`, dan `storageMode` supaya UI bisa menjelaskan apakah ada field yang berubah dan kapan pass terakhir berjalan.
- `POST /api/sites/:businessId/refresh-visual-variation` membaca full JSON dari R2/D1, menerapkan `applySeededFontPairing(..., force=true)`, menerima optional `paletteOptions` dari admin client, merge/dedupe option baru ke `brand.paletteOptions`, menulis `meta.lastVisualVariationAt`, lalu menyimpan ulang JSON/manifest. Endpoint hanya mengubah saved typography, saved palette options, dan metadata timestamp visual; copy, images, sourceData, navigation, dan service pages tidak diubah.
- `POST /api/sites/:businessId/downloaded` is a lightweight owner-download event. It ensures `leads.download_count` and `leads.last_downloaded_at`, increments the count, stores the latest timestamp, and inserts a `site_downloaded` CRM activity if the matching lead exists. `/api/sites` returns `lastDownloadedAt` and `downloadCount` for admin follow-up filtering.

Risiko debug:
- Jika asset tidak bisa dibuka, cek custom domain R2 `assets.webview.click`, bucket public/custom domain setting, dan env `R2_PUBLIC_BASE_URL`.
- Asset yang hanya berupa filename lokal tidak bisa di-upload karena tidak ada binary sumber; Function hanya memastikan namanya mengandung slug.
- Jika R2 sync gagal saat generate, Function menyimpan `storage.r2SyncError` dan tetap lanjut menyimpan JSON ke D1.

Logic Places Cache:
- `places_search_cache` menyimpan response `GET /api/places/search` selama 30 hari.
- `GET /api/places/search?query=...` membaca cache jika masih valid.
- `GET /api/places/search?query=...&refresh=1` melewati cache dan menyimpan response terbaru.
- `GET /api/places/search?query=...&websitePrecheck=1&precheckLimit=10` menjalankan Place Details minimal untuk hasil teratas supaya `website_check_status` diketahui sejak list/search.
- Google Place Details calls dari `GET /api/places/details` dan website precheck menambah counter harian `places_details`.
- `GET /api/places/history?limit=30` mengembalikan daftar search term cache, summary progress, dan daftar prospects yang dihydrate dari `places_prospects` berdasarkan `place_id`.
- `GET /api/places/manual-duplicates?limit=500` mengembalikan group kandidat duplikat manual dari `places_prospects` tanpa migration/schema baru. Group hanya ditampilkan jika minimal satu row berasal dari manual import.
- `POST /api/places/manual-duplicates/merge` menerima `{ keepPlaceId, duplicatePlaceId }`, menyalin missing `phone`, `address`, `rating`, `reviews`, `website_url`, `maps_url`, status website, dan JSON detail/result dari duplicate ke keep prospect, lalu mengubah duplicate menjadi `skipped`.
- `POST /api/places/manual-import` menerima `{ url, capturedText, capturedItems, query }`. Captured items membuat cache entry `MANUAL_CAPTURE`; search URL tanpa captured data sengaja tidak di-scrape server-side dan mengembalikan `needsBrowserCapture`.
- `GET /api/places/details?placeId=manual:*|cid:*|maps:*` tidak memanggil Google Details. Endpoint mengembalikan data manual yang tersimpan jika cukup lengkap, atau `MANUAL_CAPTURE_REQUIRED` jika record hanya berasal dari URL. `maps:*` yang hanya mewakili search/query placeholder dikembalikan sebagai 400 jelas; admin UI menonaktifkan gather/generate untuk row seperti itu sampai listing spesifik/captured JSON diimport.
- `POST /api/places/cache/trim` menghapus cache lama/expired; body: `{ "olderThanDays": 30 }`.

Logic Prospect Drafts:
- `places_prospects` menyimpan result Places per `place_id`.
- Search dan mock search memanggil upsert prospect draft.
- Manual import juga memakai `places_prospects`; jika Google `place_id` tidak tersedia, endpoint membuat `manual:{hash}` dari nama/alamat/Maps URL agar duplicate import tetap stabil.
- Importer tidak lagi memakai token internal Google Maps seperti `0x...:0x...` dari URL `data=!...` sebagai `place_id`, karena token itu bukan parameter valid untuk Google Place Details.
- Place Details memperbarui `details_json`, phone, website, maps URL, `website_check_status`, `website_checked_at`, dan `details_loaded_at`.
- Website pre-check memperbarui `phone`, `website_url`, `maps_url`, `website_check_status`, dan `website_checked_at` tanpa menandai `details_loaded_at`, sehingga admin tetap perlu `Gather data` sebelum generate.
- `GET /api/prospects` menerima filter `status`, `website=none|unknown|has|all`, `minRating`, `minReviews`, `city`, `state`, dan `niche`.
- `PUT /api/prospects/:placeId/status` mengubah status workflow (`new`, `details_loaded`, `site_generated`, `contacted`, `skipped`).
- `PUT /api/prospects/:placeId/selection` menyimpan selected Google Places photo metadata, selected palette, dan `paletteOptions`.

Logic Generation Jobs:
- Generation Jobs API handling lives in `functions/api/generationJobs/handler.ts`; `functions/api/[[path]].ts` now only wires dependencies and dispatches the route.
- `generation_jobs` mencatat setiap request `/api/sites/generate` dengan status `running`, `success`, atau `failed`.
- Setiap request `/api/sites/generate` yang membuat generation job menambah counter harian `site_generation`, termasuk request yang akhirnya gagal, supaya admin melihat retry/generate volume sebenarnya.
- `POST /api/generation-jobs/preflight-failure` mencatat generate/regenerate/retry yang diblokir oleh AI readiness sebelum `/api/sites/generate`, supaya kegagalan key/model/provider routing tetap terlihat di Jobs. Drawer detail `GenerationJobsTable` menampilkan ringkasan `AI readiness block` untuk key, local model registry, dan remote provider route.
- `POST /api/generation-jobs/cooldown-blocked` mencatat generate/regenerate/retry yang diblokir oleh shared provider cooldown sebelum `/api/sites/generate`. Row ini ikut `Preflight blocked` filter dan drawer menampilkan `Provider cooldown block`.
- `POST /api/generation-jobs/chunked-start` membuat D1-backed generation job berstatus `running` dengan payload generate di `metadata_json.payload` dan `nextStep: "outline"`. Dipakai oleh `/admin/leads`, `/admin/sites` AI generate/regenerate, dan job retry.
- `POST /api/generation-jobs/:jobId/run-step` menjalankan step retryable `outline`, `siteCopy`, `offeringCopy`, atau `finalize`. Step outline menyimpan `offeringOutline`; step siteCopy menyimpan `siteCopyPatch` dan mereset progress offering lama; step offeringCopy memproses service/product dalam batch sesuai provider/model speed mode, menyimpan cumulative `offeringCopyPatch` dan combined `copyPatch`, lalu hanya mengembalikan `nextStep: "finalize"` setelah `offeringCopyCursor >= offeringCopyTotal`; step finalize menggabungkan outline+copy patch ke JSON lalu memakai save pipeline `/api/sites/generate` dengan `skipAiCopyPatch=true` agar final save tidak memanggil AI ulang.
- Step finalize meneruskan `offeringOutline`, combined `copyPatch`, separate `siteCopyPatch`/`offeringCopyPatch`, offering coverage, hash, copy audit parent, dan optional copy-only retry delta ke child `/api/sites/generate` job, sehingga row finalize yang lebih baru tetap bisa dipakai untuk debug output AI.
- `generation_jobs.metadata_json` menyimpan audit generate: parsed `offeringOutline`, `offeringOutlineHash`, `offeringOutlineRepairAttempted`, `offeringOutlineInitialParseError`, parsed combined `copyPatch`, separate `siteCopyPatch`/`offeringCopyPatch`, service-copy progress (`offeringCopyCursor`, `offeringCopyTotal`, `offeringCopyLastItem`, `offeringCopyBriefHashes`, `offeringCopyPatchHashes`), `offeringCopyCoverage`, `conversionPagePattern`, `conversionPrimaryAction`, `conversionProofBadges`, `conversionAudit`, `designIntent`, `designAudit`, `copyOnlyRetryCoverageDelta`, `copyBriefHash`, `copyPatchHash`, `copyPatchApplied`, ringkasan/item audit copy AI (`copyAuditSummary`, `copyAuditItems`), provider/model, failure metadata bila generate gagal, dan `aiReadiness`/`remoteValidation` bila preflight memblokir sebelum generate.
- Drawer `GenerationJobsTable` membaca `metadata.step`, `metadata.nextStep`, `metadata.failureStage`, dan hash outline/copy untuk menampilkan status per step chunked job; tombol retry step hanya menjalankan step gagal/next step lewat endpoint `run-step`.
- Jika `metadata.offeringCopyForceBatchSizeOne` atau forced `offeringCopyMode` aktif, `/admin/jobs` table dan job drawer menampilkan badge `safe mode: 1 service/request`; ini berarti job tersebut dipaksa single-service chunk setelah transient `offeringCopy` edge/provider failure walaupun Settings batch lebih tinggi. Halaman Jobs juga punya filter server-backed `Safe mode` (`offeringCopyMode=safe`) dan sort `Safe mode first` untuk menemukan pola timeout/provider edge failure lintas job lama. Saat filter Safe mode aktif, API mengembalikan `safeModeBreakdown` top 8 provider/model dan UI menampilkan strip ringkas jumlah safe-mode job, failed count, dan latest timestamp per provider/model. Top offender chip punya tombol `Apply slow mode` yang menyimpan `AI_SERVICE_COPY_PROVIDER_MODES_JSON` untuk provider/model tersebut tanpa pindah ke Settings, lalu membersihkan cache AI readiness/provider health dan mengirim event refresh agar badge sekitar langsung recheck.
- `GenerationJobsTable` punya tombol `Export compact` yang menyalin JSON ringkas jobs yang sedang visible, termasuk provider/model, failure stage, readiness/cooldown metadata, copy audit summary, `offeringCopyCoverage`, `offeringCopyMode`, derived `offeringCopySafeMode`, `conversionPagePattern`, `conversionPrimaryAction`, `conversionAudit`, `designIntent`, `designAudit`, persisted `copyOnlyRetryCoverageDelta`, dan derived `copyOnlyRetryChangedDelta` untuk support/debug tanpa membuka drawer satu per satu.
- Jika generate sukses, prospect draft diupdate ke `site_generated` dan `generated_business_id` diisi.
- Jika generate gagal, `generation_jobs.error` dan `places_prospects.last_error` diisi agar admin bisa melihat error di UI.
- `GET /api/generation-jobs` mendukung query `limit` (1-500, default 100), `offset` (default 0), `q`, `status=running|success|failed`, `preflight=blocked`, `patch=applied|fallback`, `aiRewrite=zero`, `offeringCoverage=low`, `offeringCopyMode=safe`, dan `counts=1`.
- Quick panel Jobs di `/admin/leads` memakai `limit=100`; halaman penuh `/admin/jobs` memakai `limit=200`.
- Jika `counts=1`, endpoint mengembalikan `{ jobs, counts }` supaya badge filter tetap global walaupun rows sedang difilter server-side. Untuk `offeringCopyMode=safe`, response juga menyertakan `safeModeBreakdown`.
- Jika `q` dikirim bersama `counts=1`, counts dihitung dalam scope search query tersebut.
- `/admin/jobs` memakai `offset` untuk tombol `Load more`; quick drawer `/admin/leads` tetap tanpa pagination agar ringan.
- Panel Jobs menampilkan fingerprint pendek `brief:{8 chars}` dari `finalCopyBriefHash`/`copyBriefHash` dan `patch:{8 chars}` dari `copyPatchHash`, plus badge `patch applied` atau `fallback only`.
- Panel Jobs punya action `Retry current brief` dari row dan drawer detail: UI menghitung hash `GET /api/sites/:businessId/copy-brief` saat ini, membandingkannya dengan `generation_jobs.metadata.finalCopyBriefHash` atau `copyBriefHash`, lalu memberi warning inline jika brief berubah. Klik kedua (`Retry anyway`) membuat job baru memakai brief/current site JSON terbaru.
- Panel Jobs punya one-click copy retry: `Improve services` reruns `offeringCopy -> finalize` for low service coverage, intentionally resetting service-copy cursor; `Retry copy chunks` reruns `siteCopy -> offeringCopy -> finalize` for no-rewrite rows; `Resume ...` / `Retry ...` reruns the active or failed chunked step directly and continues service-copy item requests until finalize is ready. Before service-copy clicks, row tooltips and drawer next action use `src/lib/aiSlowProviderMode.ts` plus current Settings to show estimated remaining requests. `ProviderServiceCopyModeBadge` uses `/api/ai/provider-health` to show `Recommended: Slow mode` only when this provider/model has recent timeout/provider-temporary history; its `Apply` action saves `AI_SERVICE_COPY_PROVIDER_MODES_JSON` via `/api/settings` and updates page-local settings without refresh. Copy-only retry auto-opens the newly created final save job so admin can inspect returned AI work and coverage immediately; the drawer shows `Copy-only retry delta` from persisted job metadata comparing old and new `services changed/total`.
- Drawer detail menampilkan `AI copy audit` untuk job baru: jumlah source sentence yang dikirim, jumlah yang diubah/diisi AI, jumlah fallback/kept, dan daftar per field dengan source copy versus final copy. Chunked copy step menghitung audit segera setelah AI copy patch diterima, sehingga admin bisa membedakan "AI tidak mengirim field", "AI mengirim copy yang sama", dan "patch tidak mengubah final JSON".
- Panel Jobs punya filter `All`, `Failed`, `Preflight blocked`, `Fallback`, `Patch`, `No rewrite`, `Low service copy`, dan `Safe mode`; di halaman penuh filter memakai server/D1, sedangkan quick drawer menyaring row yang sudah loaded.
- Panel Jobs dirender sebagai compact table dengan kolom Job, Status, Model, Brief hash, Patch hash, dan Action agar status/retry lebih mudah discan saat job history panjang.
- `/admin/jobs` menambahkan sort lokal `Newest`, `Failed first`, `Fallback first`, `Patch applied first`, `No AI rewrite first`, `Low service copy first`, dan `Safe mode first`; quick drawer `/admin/leads` memakai sort yang sama.

Logic Owner HTML Export:
- `src/lib/exportSiteHtml.ts` membuat zip owner berisi `index.html`, `sitemap.xml`, `robots.txt`, folder `img/`, dan branded PDF owner guide.
- Export menghapus `<script>` internal, `.hide-in-export`, `[data-export-remove="true"]`, dan semua `[data-wv-tool-ui]` seperti download/setup panel, free-package modal, checkout modal, inspector, icon picker, tooltip WebView.click, dan style QA boundary demo.
- Export tidak menyertakan `site-data.json` karena JSON internal hanya untuk generator WebView.click.
- Export menyertakan inline script owner untuk tab navigation, section-anchor fallback seperti `#contact`, fixed overlay submenu hover/positioning, compact-on-scroll header, contact/feedback `mailto:`, feedback rating redirect/form behavior, dan shader pointer CSS variables (`--wv-pointer-x`, `--wv-pointer-y`) agar shader procedural tetap responsif di file HTML statis.
- Export mengambil gambar yang sedang tampil di DOM, menyimpannya ke folder `/img` di dalam zip, lalu mengubah `<img src>` menjadi path relatif seperti `img/{businessId}-hero.jpg`. Ini termasuk foto Google Business Profile yang sedang diproxy via WebView.click saat tombol download diklik, sehingga HTML owner tidak perlu hotlink ke Google atau Function WebView.click untuk gambar.
- Export membuat PDF `WebView.click Website Package Guide - {business}.pdf` saat download. PDF dibuat sebagai text/vector PDF langsung oleh helper `SelectablePdfGuide` di `exportSiteHtml.ts`, bukan screenshot/raster image, sehingga teks bisa dipilih dan link `mailto:` / preview tetap clickable. Helper juga melakukan page break saat konten melewati batas halaman, section accent memakai garis ungu tebal di bawah eyebrow uppercase dengan jarak aman sebelum title, dan icon kecil dibuat sebagai vector stroke/fill inline dengan section title, subheading, value cards, checklist, dan upgrade card headings.
- PDF owner guide menggantikan `README-FIRST.txt` dan `SETUP-GUIDE.txt`. Isinya noob-friendly: value summary `$997 -> $0`, isi zip, checklist self-hosting, done-for-you setup `$180/year` atau `$197/year` dengan domain, dan upgrade benefit-focused dalam card seperti tambah halaman from `$50/page`, sticky call/WhatsApp button `$49`, extra focused site from `$197/year`, lead capture polish `$99`, dan monthly care from `$49/month`. PDF menyertakan URL preview/download asli (`window.location.href`) dan email `email@codev.id`; reply path/mailto memakai subject/body prefilled dengan business/reference/preview tanpa extra email line di bawah callout.
- Export menambahkan Tailwind CSS/CDN hotlink, stylesheet production absolute, style tags renderer, favicon dari logo bisnis/fallback SVG, dan mengubah URL relatif non-gambar/link menjadi absolute URL.
- Export menambahkan JS inline kecil untuk mengaktifkan tabbed navigation pada elemen `data-wv-tab` dan `data-wv-page` karena React handler tidak ikut dalam HTML statis.
- Export JS juga mengaktifkan hover-persistent submenu dan contact form `mailto:` supaya HTML owner tetap interaktif tanpa React.
- Favicon export memakai inline SVG dari `meta.faviconSvg` / `brand.faviconSvg` / `brand.logoSvg`, atau fallback SVG monogram; tidak memanggil favicon remote WebView.click.
- Jika gambar gagal di-fetch saat export karena network/CORS/provider error, exporter mencatat warning di console dan mempertahankan URL absolute sebagai fallback terakhir.

Logic Payments:
- `/api/payments/checkout` lives in `functions/api/payments/handler.ts` and reads `PAYMENT_PROCESSOR` from Settings. Mode live yang didukung: Xendit hosted invoice, Midtrans Snap Redirect, DOKU Checkout, PayPal Orders v2 Checkout, Wise link, Payoneer link, dan legacy Lemon Squeezy.
- Jika processor aktif belum lengkap, endpoint berjalan mock mode dan mengembalikan `adminNotifyUrl` WhatsApp. It only creates/updates `checkout_pending` lead/payment rows when the request includes `ownerReviewSession: true` from a real owner review URL; normal admin preview checkout tests do not affect CRM owner stats.
- Paket default saat ini: `$180/year` managed hosting + `$17/year` domain fee hanya untuk domain baru yang WebView.click register; owned-domain checkout membayar hosting saja. `PAYMENT_DOMAIN_FEE_USD` memisahkan domain fee dari `PAYMENT_USD_AMOUNT`, term discount hanya mengurangi hosting, `PAYMENT_ADDON_PAGE_USD` untuk page/edit add-ons dengan checkout minimum `$50/action`, dan `PAYMENT_USD_TO_IDR_RATE` untuk mengirim amount IDR ke gateway Indonesia.
- Request checkout menyimpan `domainMode` (`new` atau `owned`), requested domain, optional sanitized `domainQuote`, amount, multi-year billing term/cadence, hosting/domain price split, add-on pricing, processor, dan sanitized `setupRequest/setupNote` ke CRM activity serta `lead_payments.raw_json`; gateway live juga menerima metadata/custom fields jika provider mendukung.
- PayPal API checkout membuat one-time/prepaid order dengan `intent=CAPTURE`, `NO_SHIPPING`, `PAY_NOW`, `invoice_id=paymentReference`, dan item breakdown base package/add-ons. Jika buyer memilih yearly billing (`annual_recurring`), `/api/payments/checkout` mencari cached PayPal plan di `system_settings` dengan key `PAYPAL_SUBSCRIPTION_PLAN__{mode}__{domainMode}__term_{n}__annual_{price}__hosting_{price}__domain_{fee}__setup_{fee}`. Jika ada match exact price/term/domain/setup-fee, checkout reuse plan ID; jika tidak, endpoint membuat PayPal Catalog Product + Billing Plan lalu menyimpan product/plan ID ke cache. Response mengembalikan `paypalSubscriptionPlanId`, dan `WebsiteActionPanel` memuat PayPal JS SDK dengan `vault=true&intent=subscription` lalu memakai `actions.subscription.create({ plan_id, custom_id })`. Setelah buyer approve, `/api/payments/paypal-subscription-approved` lookup subscription, update `lead_payments`, `subscriptions`, lead status, dan CRM activity. PayPal reads mode-specific credentials: sandbox uses `PAYPAL_SANDBOX_CLIENT_ID`/`PAYPAL_SANDBOX_CLIENT_SECRET`, live uses `PAYPAL_LIVE_CLIENT_ID`/`PAYPAL_LIVE_CLIENT_SECRET`, with legacy `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` as fallback. Webhook signature verification also reads mode-specific webhook IDs: `PAYPAL_SANDBOX_WEBHOOK_ID` or `PAYPAL_LIVE_WEBHOOK_ID`, with legacy `PAYPAL_WEBHOOK_ID` as fallback. Jika one-time order approve berhasil, `/api/payments/paypal-capture-order` capture order lalu update `lead_payments`, `subscriptions`, lead status, dan CRM activity.
- `GET /api/settings/paypal-plan-cache` returns sanitized cached PayPal plan rows (`mode`, `domainMode`, `termYears`, annual/hosting/domain/setup prices, product/plan IDs, status, updated time). It intentionally hides unrelated settings/secrets and is used only by `/admin/settings`.
- `GET /api/settings/payment-smoke` returns sanitized recent paid PayPal ledger rows from `lead_payments` for the Settings smoke checklist. It exposes only operational evidence such as amount, transaction/reference, PayPal order/subscription IDs parsed from raw JSON, source, payer email, timestamps, and subscription detection; it does not expose raw webhook JSON or secrets. Settings stores `PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE`, and the checklist gate turns green only when that recorded reference matches a recent paid row candidate.
- `setupTables()` memastikan `system_settings.updated_at` ada agar PayPal plan cache bisa ditulis/disortir di D1 lama tanpa manual migration.
- `/api/payments/paypal-webhook` handles `BILLING.SUBSCRIPTION.ACTIVATED` to reconcile approved yearly subscriptions and `PAYMENT.SALE.COMPLETED` with `billing_agreement_id` to record future PayPal subscription billing payments into `lead_payments`.
- PayPal/Wise/Payoneer manual fallback rails mengembalikan `requiresManualReview=true`, `paymentReference`, dan `paymentInstructions`; `WebsiteActionPanel` menampilkan review step sebelum membuka payment link agar buyer menyertakan business/domain/reference.
- PayPal setup lives in `/admin/settings#settings-payment`: sandbox/live API segmented toggle, mode-specific API key / Client ID, secret, and webhook ID fields, optional fallback `PAYPAL_BUSINESS_URL`, `PAYPAL_RISK_ACKNOWLEDGED`, active-mode missing credential warning, and a compact guardrails panel. `PAYPAL_PAYMENT_NOTE` and fallback account mode are only shown when a manual PayPal fallback link is configured because API Checkout stores the reference on the PayPal order.
- Domain registrar setup lives next to Payment Setup in `/admin/settings#settings-domain-registrar`: default registrar, max internal domain cost, and credential fields for Cloudflare Registrar, Name.com, Dynadot, and Spaceship. Registrar tooltips explain where to find each account ID/API token/key/secret. Empty registrar credentials are allowed; public checkout falls back to manual domain confirmation.
- Cloudflare observability setup lives in `/admin/settings#settings-cloudflare-observability`: it reuses shared `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, adds `CLOUDFLARE_PAGES_PROJECT_NAME`, and allows optional `CLOUDFLARE_PAGES_API_TOKEN` override for a restricted Pages Read token.
- `/api/payments/paypal-webhook` aman sebelum PayPal Business siap: tanpa active-mode PayPal Client ID/Secret/webhook ID, endpoint acknowledge dan ignore event. Jika lengkap, endpoint verify signature PayPal lalu mencatat completed payment yang match ke `lead_payments`, `subscriptions`, status lead, dan CRM activity sebagai backup bila browser capture callback terputus.
- `lead_payments` menyimpan ledger manual/webhook: processor, status, amount, transaction ID, payer email, payment reference, proof notes, raw webhook JSON, waktu verified, dan verifier.
- PayPal operating guidance and implementation tracker live in `docs/PAYPAL_RISK_CONTROLS.md` and `docs/PAYPAL_EXPRESS_CHECKOUT_IMPLEMENTATION.md`.

Logic Domains:
- `/api/domains/check?domain=...` lives in `functions/api/domains/handler.ts` and melakukan availability pre-check gratis.
- Primary provider: RDAP via `rdap.net`.
- Fallback signal: Google Public DNS SOA lookup.
- Jika RDAP `200`, response menyertakan `registrar`, `nameservers`, dan `rdapUrl` jika registry menyediakan field tersebut.
- `GET /api/domains/providers` returns score 7.0+ registrar adapter readiness for Cloudflare Registrar, Name.com, Dynadot, and Spaceship, including active default provider, missing config keys, and `DOMAIN_REGISTRATION_MAX_USD`.
- `POST /api/domains/quote` is the non-billable registrar quote endpoint. It normalizes to `DomainQuote`, reads provider credentials from Cloudflare env first and D1 settings second, returns `premium`, `withinMaxPrice`, and `supportedForMvp`, and never registers a domain.
- Registrar quote credentials/settings recognized by the backend: `DOMAIN_REGISTRAR_PROVIDER`, `DOMAIN_REGISTRATION_MAX_USD`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `NAME_COM_USERNAME`, `NAME_COM_API_TOKEN`, `NAME_COM_ENV`, `DYNADOT_API_KEY`, `DYNADOT_ENV`, `SPACESHIP_API_KEY`, and `SPACESHIP_API_SECRET`.
- Response harus diperlakukan sebagai kandidat availability, bukan jaminan pembelian; final confirmation terjadi saat registrar purchase.

Logic Cloudflare Observability:
- `/api/cloudflare/pages-logs` lives in `functions/api/cloudflare/handler.ts`.
- Endpoint reads env first, then D1 settings. Required values: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME`, and `CLOUDFLARE_PAGES_API_TOKEN` or shared `CLOUDFLARE_API_TOKEN`.
- If configured, it calls Cloudflare official Pages APIs: list latest deployment from `GET /accounts/{account_id}/pages/projects/{project_name}/deployments?env=production&per_page=1`, then fetch logs from `GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs`. Accepted Cloudflare permission is Pages Read.
- If credentials are missing, endpoint returns `{ configured:false, missingKeys }` with HTTP 200 so Dashboard can show setup guidance instead of treating it as an app outage.

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
- Tabel inti: `leads`, `subscriptions`, `crm_activities`, `json_sites`, `system_settings`, `ai_readiness_cache`, `daily_usage_counters`, `provider_cooldowns`, `provider_cooldown_events`, `marketing_audits`.
- Tabel admin prospecting: `places_search_cache`, `places_prospects`, dan `generation_jobs`.

Tabel:
- `leads`
- `subscriptions`
- `crm_activities`
- `json_sites`
- `system_settings`
- `ai_readiness_cache`
- `daily_usage_counters`
- `provider_cooldowns`
- `provider_cooldown_events`
- `marketing_audits`

## Maintenance Rule

Jika menambah laman atau komponen baru:
- Update route/entry di dokumen ini.
- Jelaskan fungsi, API yang dipakai, logic state penting, dan risiko debug.
- Jika menambah endpoint Function baru, update bagian `Cloudflare Pages Functions`.

Build/Deploy Guard:
- `npm run check:syntax` menjalankan `scripts/check-build-syntax.mjs`, yaitu parse-only esbuild transform untuk file `.ts/.tsx/.js/.jsx` di `src`, `functions`, `tests`, plus `server.ts` dan `vite.config.ts`. Ini menangkap syntax error Vite/esbuild seperti bracket/ternary rusak sebelum full build.
- `prebuild` otomatis menjalankan `npm run check:syntax`, sehingga Cloudflare Pages command `npm run build` gagal lebih awal dengan pesan file/baris yang lebih langsung setelah `npm clean-install`.

## Related Planning Docs

- `docs/GOOGLE_PLACES_DATA_INVENTORY.md`: inventaris data Google Places yang bisa dipakai untuk CRM lead scoring dan site generation.
- `docs/GOOGLE_PLACES_PHOTO_STRATEGY.md`: strategi foto Google Places untuk free preview vs paid website.
- `docs/GOOGLE_BUSINESS_PROFILE_MARKETING_AUDIT_PLAN.md`: tracker untuk `/audit/:businessId`, deterministic Google Business Profile marketing audit, competitor comparison, PDF export, and WebView.click service positioning.
- `docs/FREE_TIER_LIMITS_AUDIT.md`: baseline batas Cloudflare Pages/Workers/D1/R2, Google Maps, Clerk, dan audit endpoint yang berisiko quota/cost.
- `docs/NICHE_STYLE_PRESETS.md`: brainstorm dan kontrak `design.stylePreset`.
- `docs/LEMON_SQUEEZY_INTEGRATION.md`: catatan integrasi checkout Lemon Squeezy.
- `docs/PAYPAL_RISK_CONTROLS.md`: PayPal Business risk notes, checkout/payment-reference controls, and reconciliation checklist.
- `docs/PAYPAL_EXPRESS_CHECKOUT_IMPLEMENTATION.md`: PayPal JS SDK + Orders v2 / Subscriptions implementation notes, sandbox QA, and hosting/domain plus add-on pricing structure.
- `docs/DOMAIN_AVAILABILITY_RESEARCH.md`: riset provider gratis/murah untuk cek availability domain.
- `docs/DOMAIN_REGISTRATION_AUTOMATION_PLAN.md` dan `docs/domain-providers/*.md`: registrar automation scope, score 7.0+ provider summaries, provider-neutral adapter plan, and checklist progress for domain quote/register/connect work.
- `docs/SITE_BUILDER_UPGRADE_PLAN.md`: rencana upgrade JSON schema dan renderer agar demo/site output lebih modern dan personalized.
- `docs/ADMIN_WORKFLOW_AUDIT.md`, `docs/ADMIN_JOBS_USER_GUIDE.md`, and `docs/ADMIN_UI_TOOLTIP_COLLAPSE_AUDIT.md`: admin QA/workflow notes and practical Jobs usage guide exposed through the in-app docs reader.
