# Panduan Setup WebView.click

Dokumen ini berisi panduan teknis lengkap untuk mendeploy aplikasi WebView.click ke infrastruktur Cloudflare (Pages, D1, R2), melakukan setup Google Places API, dan menyiapkan integrasi pembayaran (untuk kreator Indonesia menerima pembayaran USD).

---

## 1. Cloudflare Pages Variables / Secrets Setup

Aplikasi produksi berjalan di Cloudflare Pages dengan Pages Functions untuk `/api` dan `/api/*`, D1 untuk CRM dan order, serta R2 untuk penyimpanan aset. Express di `server.ts` adalah jalur lama. Halaman statis Elementor dari `wpwv.codev.id` diterbitkan terpisah oleh Worker `sites-webview-click` dari bucket privat `webview-sites`. Gunakan [panduan operasi](../GUIDE.md) untuk publish, verifikasi ZIP, dan penggantian revisi dengan slug yang sama.

### Langkah-langkah di Cloudflare Dashboard:
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Masuk ke **Workers & Pages**.
3. Buka project Pages `webview-click` pada akun WebView yang sudah tercatat di [GUIDE.md](../GUIDE.md). Untuk pemulihan dari awal, hubungkan project ke repository GitHub ini dengan branch produksi `main`.
   - **Framework preset:** `Vite`
   - **Build command:** `pnpm run build`
   - **Build output directory:** `dist`
4. Sebelum melakukan deploy pertama kali, masuk ke **Settings > Environment variables**.
5. Tambahkan variable berikut:
   - `VITE_CLERK_PUBLISHABLE_KEY` (Publik, dari Clerk)
   - `CLERK_SECRET_KEY` (Rahasia, dari Clerk)
   
Simpan kredensial provider seperti Google Places, AI, dan payment gateway sebagai **secret bindings**. Binding rahasia didahulukan dari nilai lama di D1. Halaman `/admin/settings` hanya menampilkan status keberadaan kredensial dan tidak mengirim nilainya kembali. Masukkan opsi publik dan konfigurasi nonrahasia lewat panel pengaturan yang sesuai.

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

Router memverifikasi sesi Clerk dan role admin sebelum memproses endpoint privat. Endpoint publik terbatas pada daftar method dan path di `functions/api/_shared/adminAccess.ts`. Baca [dokumentasi Clerk](clerk-auth.md) sebelum memberi akses admin.

File `public/_routes.json` membatasi Pages Functions hanya untuk `/api` dan `/api/*`, sehingga asset statis dan route SPA tetap dilayani Cloudflare Pages tanpa biaya invocation API yang tidak perlu.
File `public/_redirects` berisi `/* /index.html 200` agar direct open/refresh pada route React seperti `/admin/jobs` atau `/{businessId}` tidak menjadi static 404 di Cloudflare Pages.

### Konfigurasi Cloudflare D1 (Database)
Aplikasi memakai database D1 produksi yang terikat sebagai `DB`. Pertahankan binding ke database yang ada saat deploy rutin. Untuk database baru, inisialisasi dengan `SQL/schema.sql` dari root repository. Untuk database yang sudah terisi, periksa skema dan jalankan hanya migrasi yang diperlukan sebelum deploy. Endpoint publik tidak menjalankan migrasi.

### Konfigurasi Cloudflare R2 (Object Storage)
1. Di Dashboard Cloudflare R2, klik **Create bucket**, namakan `webview`.
2. Sambungkan bucket ke custom domain `assets.webview.click` untuk memberikan akses publik ke file `.json` dan gambar website generator.
3. Di Cloudflare Pages Dashboard, pergi ke **Settings > Bindings > R2 bucket bindings**.
4. Tambahkan binding dengan variabel `R2` dan hubungkan ke `webview`.
5. Tambahkan environment variable `R2_PUBLIC_BASE_URL` dengan nilai `https://assets.webview.click`. Function juga punya fallback ke domain ini, tetapi env variable tetap disarankan agar konfigurasi eksplisit di dashboard Cloudflare Pages.
6. Terapkan CORS bucket agar image asset di `assets.webview.click` bisa dibaca oleh browser canvas untuk ekstraksi palette warna:
   Jalankan perintah berikut dari root repository, memakai profil `webview` yang sudah dikonfigurasi sesuai [GUIDE.md](../GUIDE.md).
   Dari root repository, pasang tool Worker dengan `pnpm --dir cloudflare/sites-worker install --frozen-lockfile` lalu jalankan `pnpm run r2:cors`.
   - Verifikasi dengan `pnpm run r2:cors:list`.
7. JSON dan aset baru memakai kunci revisi di bawah namespace bisnis. Akses preview React melalui `GET /api/sites/<businessId>` agar selalu mengikuti revisi yang dipilih D1. Untuk URL statis dan ZIP, gunakan Worker pada `sites.webview.click`.

---

## 2. Setup AI Generators (Website Builders)
Sistem memiliki pengaturan AI multikoneksi untuk generator JSON di aplikasi. Atur pilihan provider di `/admin/settings` dan simpan API key di secret binding Cloudflare. Alur Elementor menggunakan AI Bridge dan brief yang direview menurut [GUIDE.md](../GUIDE.md).
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
8. Simpan API key tersebut sebagai secret binding `GOOGLE_PLACES_API_KEY` pada project Pages.

---

## 3. Setup Pembayaran

Untuk offer done-for-you website setup, jangan jadikan Lemon Squeezy sebagai default karena aturan prohibited products mereka melarang services termasuk web development/design/consulting. Riset lebih lengkap ada di `docs/PAYMENT_PROCESSOR_RESEARCH.md`.

Rekomendasi praktis:
1. Mulai dari `PAYMENT_PROCESSOR=mock` agar checkout tetap mencatat lead `checkout_pending`.
2. Setelah akun merchant siap, pilih salah satu live processor di `/admin/settings#settings-payment`: `xendit`, `midtrans`, atau `doku`.
3. Isi `PAYMENT_USD_AMOUNT` dan `PAYMENT_USD_TO_IDR_RATE`. App menampilkan USD ke calon klien, lalu mengirim amount IDR ke gateway Indonesia.
4. Simpan key provider sebagai secret bindings:
   - Xendit: `XENDIT_SECRET_KEY`
   - Midtrans: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
   - DOKU: `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_IS_PRODUCTION`
5. Tambahkan fallback manual jika dibutuhkan: `PAYPAL_BUSINESS_URL`, `WISE_PAYMENT_URL`, atau `PAYONEER_PAYMENT_URL`. `PAYPAL_PAYMENT_NOTE` hanya relevan untuk fallback link manual, bukan PayPal API Checkout.
6. Jika memakai PayPal Business Checkout, isi sandbox API key / Client ID ke `PAYPAL_SANDBOX_CLIENT_ID` dan sandbox secret ke `PAYPAL_SANDBOX_CLIENT_SECRET`, lalu pilih mode Sandbox (`PAYPAL_IS_PRODUCTION=false`) untuk testing.
7. Review `docs/PAYPAL_RISK_CONTROLS.md` dan `docs/PAYPAL_EXPRESS_CHECKOUT_IMPLEMENTATION.md`, lalu set `PAYPAL_RISK_ACKNOWLEDGED=true` setelah siap.
8. Setelah sandbox capture berhasil, isi `PAYPAL_SANDBOX_WEBHOOK_ID` jika memakai webhook sandbox. Lalu isi live API key / Client ID ke `PAYPAL_LIVE_CLIENT_ID`, live secret ke `PAYPAL_LIVE_CLIENT_SECRET`, live webhook ID ke `PAYPAL_LIVE_WEBHOOK_ID`, dan pilih mode Live (`PAYPAL_IS_PRODUCTION=true`). Endpoint webhook tersedia di `/api/payments/paypal-webhook` sebagai backup reconciliation.

Gunakan PayPal Business, bukan PayPal Personal, untuk volume bisnis. Legacy Lemon Squeezy fields tetap ada hanya untuk kompatibilitas lama.

Server mengikat order WebView ke transaksi PayPal dan menunggu settlement yang cocok sebelum menandai order sebagai dibayar. Persetujuan langganan tetap berstatus pending sampai ada pembayaran yang memenuhi syarat. Server juga memvalidasi ulang pilihan domain baru. Gunakan sandbox untuk menguji proses end-to-end.
