# WebView.click Codebase Reference

Terakhir diperbarui: 14 Mei 2026.

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
- Section renderer mendukung `hero`, `features`, `textImageBlock`, `teamGrid`, `gridCards`, `imageGallery`, dan `contactForm`.
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
- `GET /api/settings`
- `GET /api/places/search?query=...`
- `GET /api/places/photo?reference=...`
- `POST /api/sites/generate`
- `PUT /api/leads/:id/status`

Logic penting:
- Provider AI tersedia: OpenRouter, OpenAI, Gemini, KIE.ai, dan Opencode.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- Jika hasil Google Places punya `photos`, admin bisa memilih salah satu sebagai logo/brand source.
- Gambar logo diambil melalui proxy same-origin `/api/places/photo`, lalu canvas browser mengekstrak palette warna dominan.
- Palette dikirim ke `/api/sites/generate` sebagai `brandPalette`.
- Logo yang dipilih dikirim sebagai `selectedLogoImageUrl`.
- JSON mock fallback memakai palette tersebut untuk `primary`, `accent`, dan `secondary`.
- Search Google Places menampilkan feedback sukses/kosong/error melalui `searchMessage`, supaya response kosong tidak terlihat seperti tombol tidak bekerja.

Risiko debug:
- Jika foto Google tidak muncul, cek Places API key dan apakah Text Search mengembalikan `photos`.
- Jika pencarian tidak menampilkan hasil, cek pesan di UI dan response `/api/places/search`; Function menormalisasi status Google seperti `ZERO_RESULTS`, `REQUEST_DENIED`, dan fetch failure ke JSON.
- Error `API keys with referer restrictions cannot be used with this API` berarti key Google Places masih dibatasi HTTP referrer. Untuk Pages Functions/server-side, pakai server key tanpa application restriction dan batasi hanya API-nya di Google Cloud.
- Canvas palette butuh image same-origin/CORS; karena itu foto harus lewat proxy `/api/places/photo`, bukan langsung URL Google.

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
- Auto-save berjalan 1,2 detik setelah perubahan terakhir.
- Banner status custom menggantikan `alert()` browser.
- Estimator biaya memakai `src/lib/aiPricing.ts`.
- KIE.ai ditampilkan sebagai estimasi diskon karena pricing live berada di dashboard/pricing KIE.

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
- Menggunakan `SiteRenderer` dengan `showProspectPanel={false}` agar demo fokus ke hasil render website.

Risiko debug:
- Jika `/demo` blank, cek apakah `resolveJsonModule` aktif di `tsconfig.json`.
- Jika section baru tidak muncul sesuai harapan, update `SiteRenderer`.

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
- Payment link basic/premium dibaca dari D1 settings.

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

Logic D1:
- Binding wajib: `DB`.
- `setupTables()` membuat tabel jika belum ada.
- `addColumnIfMissing()` menjalankan migrasi ringan berbasis `PRAGMA table_info`.
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
- Function memaksa `businessId` masuk ke `meta.businessId` dan menjaga `logoImageUrl` jika dipilih admin.

Logic R2:
- Binding optional: `R2`.
- Public URL: `R2_PUBLIC_BASE_URL`, default/fallback production `https://assets.webview.click`.
- Saat `POST /api/sites/generate`, Function:
  - Menormalisasi filename image non-URL agar mengandung slug `businessId`.
  - Meng-upload image URL yang bisa di-fetch ke `sites/{businessId}/assets/{businessId}-asset-XX.ext`.
  - Meng-upload JSON final ke `sites/{businessId}/{businessId}.json`.
  - Menambahkan metadata `storage.r2JsonKey`, `storage.r2JsonUrl`, dan `storage.r2AssetKeys` ke JSON.

Risiko debug:
- Jika asset tidak bisa dibuka, cek custom domain R2 `assets.webview.click`, bucket public/custom domain setting, dan env `R2_PUBLIC_BASE_URL`.
- Asset yang hanya berupa filename lokal tidak bisa di-upload karena tidak ada binary sumber; Function hanya memastikan namanya mengandung slug.

## Data and Schema

### `JSON/template-schema.json`

Fungsi:
- Baseline struktur JSON website yang diberikan ke model AI.

### `SQL/schema.sql`

Fungsi:
- Skema Cloudflare D1 production.

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
