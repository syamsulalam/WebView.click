# Panduan Setup WebView.click

Dokumen ini berisi panduan teknis lengkap untuk mendeploy aplikasi WebView.click ke infrastruktur Cloudflare (Pages, D1, R2), melakukan setup Google Places API, dan menyiapkan integrasi pembayaran (untuk kreator Indonesia menerima pembayaran USD).

---

## 1. Cloudflare Pages Variables / Secrets Setup

Aplikasi produksi berjalan di Cloudflare Pages dengan Pages Functions untuk route `/api/*`, Cloudflare D1 untuk database, dan R2 untuk object storage. Backend Express di `server.ts` tetap ada sebagai referensi/legacy Node build, tetapi produksi Cloudflare memakai file di direktori `functions/`.

### Langkah-langkah di Cloudflare Dashboard:
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Masuk ke **Workers & Pages**.
3. Buat Project Pages baru, sambungkan dengan repository GitHub aplikasi ini.
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Sebelum melakukan deploy pertama kali, masuk ke **Settings > Environment variables**.
5. Tambahkan variable berikut:
   - `VITE_CLERK_PUBLISHABLE_KEY` (Publik, dari Clerk)
   - `CLERK_SECRET_KEY` (Rahasia, dari Clerk)
   
*Catatan: API Keys lainnya seperti Google Places, OpenAI, Gemini, dan Payment Links dikonfigurasi melalui D1 App Dashboard (`/admin/settings`) dan tidak perlu dimasukkan ke Environment Variables.*

### Cloudflare Pages Functions
Semua endpoint API produksi berada di:

`functions/api/[[path]].ts`

File ini menangani:
- `GET/POST /api/settings`
- `GET /api/public-settings`
- `GET /api/schema`
- `GET /api/stats`
- `GET /api/activities`
- `GET /api/leads`
- `PUT /api/leads/:id/status`
- `POST /api/leads/:business_id/ping`
- `GET /api/places/search`
- `POST /api/sites/generate`
- `GET /api/sites/:business_id`

Pastikan binding D1 bernama `DB`. Jika binding belum aktif, endpoint API akan mengembalikan JSON error, bukan fallback HTML.

File `public/_routes.json` membatasi Pages Functions hanya untuk `/api` dan `/api/*`, sehingga asset statis dan route SPA tetap dilayani Cloudflare Pages tanpa biaya invocation API yang tidak perlu.

### Konfigurasi Cloudflare D1 (Database)
Aplikasi produksi menggunakan Cloudflare D1:
1. Buka Terminal lokal, pastikan Anda install Wrangler: `npm install -g wrangler`
2. Login akun: `npx wrangler login`
3. Buat database: `npx wrangler d1 create webview-db`
4. Copy `database_id` yang muncul.
5. Jalankan inisialisasi skema dengan command: 
   `npx wrangler d1 execute webview-db --file=./SQL/schema.sql --remote`
6. Pada Cloudflare Pages Dashboard Anda, pergi ke **Settings > Bindings > D1 database bindings**.
7. Tambahkan binding baru dengan variabel `DB` dan pilih database `webview-db` yang baru saja Anda buat.
8. Redeploy Pages setelah binding ditambahkan.

### Konfigurasi Cloudflare R2 (Object Storage)
1. Di Dashboard Cloudflare R2, klik **Create bucket**, namakan `webview`.
2. Sambungkan bucket ke custom domain `assets.webview.click` untuk memberikan akses publik ke file `.json` dan gambar website generator.
3. Di Cloudflare Pages Dashboard, pergi ke **Settings > Bindings > R2 bucket bindings**.
4. Tambahkan binding dengan variabel `R2` dan hubungkan ke `webview`.
5. Tambahkan environment variable `R2_PUBLIC_BASE_URL` dengan nilai `https://assets.webview.click`. Function juga punya fallback ke domain ini, tetapi env variable tetap disarankan agar konfigurasi eksplisit di dashboard Cloudflare Pages.
6. Setelah deploy, hasil generate akan memakai pola URL publik:
   - JSON: `https://assets.webview.click/sites/{businessId}/{businessId}.json`
   - Asset: `https://assets.webview.click/sites/{businessId}/assets/{businessId}-asset-XX.ext`

---

## 2. Setup AI Generators (Website Builders)
Sistem memiliki pengaturan AI multikoneksi. Di `/admin`, Anda dapat memilih dari OpenRouter, OpenAI, Gemini, KIE.ai, atau Opencode untuk meracik JSON dan copywriting website klien Anda. Di dashboard aplikasi (`/admin/settings`), atur variabel ini:
- `OPENROUTER_API_KEY`: Key dari OpenRouter untuk ratusan model OSS.
- `OPENAI_API_KEY`: Key jika memilih platform OpenAI (`gpt-5.5`, `gpt-5.4`, atau `gpt-5.4-mini`).
- `GEMINI_API_KEY`: Key jika memilih Gemini.
- `KIE_API_KEY`: Key jika memilih KIE.ai.
- `OPENCODE_API_KEY` & `OPENCODE_BASE_URL`: Jika menggunakan Custom Opencode API atau custom OpenAI-compatible endpoint.

---

## 3. Setup Google Places API (Scraping GMB)

Agar fitur "cari prospek" berfungsi dengan data dunia nyata:
1. Kunjungi [Google Cloud Console](https://console.cloud.google.com).
2. Buat Project baru bernama `WebView CRM`.
3. Buka menu **APIs & Services > Library**, cari dan AKTIFKAN:
   - **Places API (New)**
   - **Maps JavaScript API** (Untuk render peta lokal jika butuh fallback)
4. Buka **Credentials**, klik **Create Credentials > API Key**.
5. *PENTING:* Karena WebView.click memanggil Google Places dari Cloudflare Pages Functions/server-side, **jangan gunakan HTTP referrer restriction** untuk key ini. Jika memakai referrer restriction, Google akan menolak request dengan error `API keys with referer restrictions cannot be used with this API`.
6. Rekomendasi konfigurasi key untuk produksi:
   - **Application restrictions:** `None`.
   - **API restrictions:** batasi hanya ke Places API yang dipakai project ini.
   - Aktifkan billing dan kuota/budget alert di Google Cloud.
7. Cloudflare Pages tidak menyediakan static outbound IP yang stabil untuk IP restriction, jadi restriction IP biasanya tidak praktis untuk Pages Functions. Jika wajib IP restriction, pindahkan endpoint Google Places ke server dengan static egress IP.
8. Copy API Key tersebut, lalu simpan di `/admin/settings` sebagai `GOOGLE_PLACES_API_KEY`.

---

## 3. Setup Pembayaran

Untuk offer done-for-you website setup, jangan jadikan Lemon Squeezy sebagai default karena aturan prohibited products mereka melarang services termasuk web development/design/consulting. Riset lebih lengkap ada di `docs/PAYMENT_PROCESSOR_RESEARCH.md`.

Rekomendasi praktis:
1. Mulai dari `PAYMENT_PROCESSOR=mock` agar checkout tetap mencatat lead `checkout_pending`.
2. Setelah akun merchant siap, pilih salah satu live processor di `/admin/settings#settings-payment`: `xendit`, `midtrans`, atau `doku`.
3. Isi `PAYMENT_USD_AMOUNT` dan `PAYMENT_USD_TO_IDR_RATE`. App menampilkan USD ke calon klien, lalu mengirim amount IDR ke gateway Indonesia.
4. Simpan key provider:
   - Xendit: `XENDIT_SECRET_KEY`
   - Midtrans: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
   - DOKU: `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_IS_PRODUCTION`
5. Tambahkan fallback manual: `PAYPAL_BUSINESS_URL`, `WISE_PAYMENT_URL`, atau `PAYONEER_PAYMENT_URL`.
6. Jika memakai PayPal Business Checkout, set `PAYPAL_ACCOUNT_MODE=business`, isi sandbox API key / Client ID ke `PAYPAL_SANDBOX_CLIENT_ID` dan sandbox secret ke `PAYPAL_SANDBOX_CLIENT_SECRET`, lalu pilih mode Sandbox (`PAYPAL_IS_PRODUCTION=false`) untuk testing.
7. Review `docs/PAYPAL_RISK_CONTROLS.md` dan `docs/PAYPAL_EXPRESS_CHECKOUT_IMPLEMENTATION.md`, lalu set `PAYPAL_RISK_ACKNOWLEDGED=true` setelah siap.
8. Setelah sandbox capture berhasil, isi live API key / Client ID ke `PAYPAL_LIVE_CLIENT_ID` dan live secret ke `PAYPAL_LIVE_CLIENT_SECRET`, pilih mode Live (`PAYPAL_IS_PRODUCTION=true`), dan tambahkan `PAYPAL_WEBHOOK_ID` setelah webhook dibuat. Endpoint webhook tersedia di `/api/payments/paypal-webhook` sebagai backup reconciliation.

Gunakan PayPal Business, bukan PayPal Personal, untuk volume bisnis. Legacy Lemon Squeezy fields tetap ada hanya untuk kompatibilitas lama.
