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
2. Aktifkan **Public R2.dev URL** atau sambungkan dengan domain kustom untuk memberikan akses publik ke file `.json` dan gambar website generator.
3. Di Cloudflare Pages Dashboard, pergi ke **Settings > Bindings > R2 bucket bindings**.
4. Tambahkan binding dengan variabel `R2` dan hubungkan ke `webview`.

---

## 2. Setup AI Generators (Website Builders)
Sistem memiliki pengaturan AI multikoneksi. Di `/admin`, Anda dapat memilih dari OpenRouter, OpenAI, Gemini, atau Opencode untuk meracik JSON dan copywriting website klien Anda. Di dashboard aplikasi (`/admin/settings`), atur variabel ini:
- `OPENROUTER_API_KEY`: Key dari OpenRouter untuk ratusan model OSS.
- `OPENAI_API_KEY`: Key jika memilih platform OpenAI (`gpt-4o`).
- `GEMINI_API_KEY`: Key jika memilih Gemini.
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
5. *PENTING:* Lakukan Restrict Key!
   - Di bagian _API restrictions_, pilih hanya `Places API (New)`.
   - Di bagian _Application restrictions_, pilih _HTTP referrers_ (atau IP Address jika berjalan di backend). Untuk backend Node/Pages Functions, tidak perlu referer, tapi gunakan restriction IP jika IP server statis, atau biarkan tidak di restrict asalkan disimpan di server rahasia (TIDAK bocor ke VITE_).
6. Copy API Key tersebut, lalu masukkan ke dalam `.env` lokal sebagai variabel `GOOGLE_PLACES_API_KEY`.

---

## 3. Setup Pembayaran Ekstensif (IDR ke USD)

Sebagai developer/bisnis di Indonesia yang menargetkan pasar US ($120 - $297/tahun), menggunakan **Stripe lokal (Indonesia)** seringkali menjadi kendala karena currency conversion dan syarat perusahaan (PT/CV). Berikut solusi terbaik untuk menerima pembayaran dari klien US:

### Opsi A: Paddle / Lemon Squeezy (Merchant of Record - Rekomendasi 🏆)
Metode ini paling mudah bagi perorangan di Indonesia karena mereka bertindak sebagai pihak penjual (MoR) resmi.
1. Daftar di [LemonSqueezy](https://www.lemonsqueezy.com) atau [Paddle](https://www.paddle.com).
2. Buat produk berlangganan (Subscription Product): "Premium Managed Hosting - $120/year" & "Basic Setup - $197/one-time".
3. Aktifkan pembayaran via Card, Apple Pay, dan PayPal (ditangani otomatis oleh LS/Paddle).
4. Ambil **Checkout Link** dari produk tersebut.
5. Masukkan ke dalam `.env` aplikasi ini, sehingga ketika klien menekan "Checkout/Bayar" dari web preview, mereka akan diarahkan ke Lemon Squeezy. Pencairan dana otomatis ditransfer setiap bulan / dua minggu langsung ke rekening BCA/Mandiri Anda dalam bentuk Rupiah (IDR).

### Opsi B: Stripe Atlas + Wise/Payoneer (Untuk Badan Usaha Kelas Dunia)
Bila ingin terlihat 100% korporat Amerika Serikat.
1. Daftar [Stripe Atlas](https://stripe.com/atlas) ($500) untuk membuka entitas LLC di Delaware, USA.
2. Kamu akan memilik Stripe Account resmi USA dan rekening Mercury Bank USA.
3. Klien US dapat membayar menggunakan kartu kredit atau ACH Transfer (sangat diminati pebisnis B2B lokal di US).
4. Buat Stripe Payment Links dan gunakan URL tersebut di aplikasi ini.
5. Pindahkan uang dari Mercury Bank LLC -> Akun Wise -> Rekening Pribadi di Indonesia.

### Opsi C: PayPal Pribadi (Bootstrap Pemula 🚀)
Sesuai PRD, untuk awal yang cepat tanpa modal.
1. Kunjungi dompet PayPal dan buat tautan **PayPal.Me**. (Misal: `paypal.me/akunanda`).
2. Kirim email B2B dengan faktur tagihan PayPal manual.
3. Di CRM Aplikasi ini, terdapat tombol "Tandai Sudah Bayar" yang hanya Anda (admin) yang bisa mengeklik. Ubah statusnya secara manual.
4. *Peringatan:* Jika transaksi di atas $2000 per bulan dari akun pribadi menggunakan PayPal biasa tanpa verifikasi bisnis yang kuat, risiko funds diblokir sepihak cukup tinggi.
