# **📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)**

**Project Name:** WebView.click  
**Version:** 1.0  
**Description:** Platform otomatisasi *lead generation* dan *website builder* berbasis JSON untuk mengonversi prospek Google My Business menjadi klien *managed hosting*.

## **1\. Executive Summary**

**WebView.click** adalah alat operasional bisnis (CRM & Website Generator) sekaligus *front-end* *preview* bagi calon klien. Admin mencari bisnis di Google Maps yang tidak memiliki website, men-generate website menggunakan AI berdasarkan data Google My Business (GMB), dan memberikan URL *preview* (webview.click/namabisnis) kepada prospek. Jika prospek tertarik, mereka bisa mendapatkan kode HTML secara gratis, atau membayar layanan *setup*, domain, dan *managed hosting* (target: $120/tahun).

## **2\. Tech Stack**

* **Frontend:** React.js \+ Vite  
* **Styling:** Tailwind CSS (untuk mempermudah injeksi kustomisasi dari JSON)  
* **Authentication:** Clerk (Mendukung SSO, registrasi, dan sistem *approval* untuk *staff/admin*).  
* **Hosting / Deployment:** Cloudflare Pages.  
* **Database (CRM & Users):** Cloudflare D1 (Serverless SQL DB).  
* **File Storage (JSON & Assets):** Cloudflare R2 (Object Storage).  
* **AI Integration:** OpenAI API (atau Claude/Gemini) untuk *copywriting* dan ekstraksi/mapping data GMB ke format JSON.

## **3\. Core Features & Requirements**

### **A. Public Facing App (webview.click)**

1. **Dynamic Rendering via JSON:**  
   * URL webview.click/\[business-id\] akan me-render template web statis.  
   * Saat halaman dimuat, sistem akan melakukan *fetch* ke Cloudflare R2 untuk mengambil \[business-id\].json.  
   * React akan menggunakan data dari JSON tersebut untuk mengubah semua elemen *layout* (Nama Bisnis, Deskripsi, Testimoni, Warna Tema/Hex Codes, *Font Pairing*, *CSS Classes*, URL Gambar, dan Tombol CTA/WhatsApp).  
2. **Local Storage Persistence:**  
   * Jika prospek membuka webview.click/\[business-id\], ID tersebut akan disimpan di localStorage browser mereka.  
   * Jika di masa depan mereka hanya membuka *root domain* webview.click/, sistem akan mengecek localStorage dan secara otomatis me-render situs \[business-id\] mereka, memberikan kesan bahwa itu adalah *domain* milik mereka.  
3. **Download Static HTML:**  
   * Tersedia tombol (atau *hidden menu* untuk prospek) "Download Kode Website".  
   * Sistem akan mengompilasi halaman React (beserta aset dan konten JSON-nya) menjadi *file* .zip berisi *Static HTML/CSS* murni yang bisa di-host di mana saja oleh prospek.

### **B. Admin Panel & CRM (webview.click/admin)**

1. **Authentication & Role Management (via Clerk):**  
   * Halaman dilindungi oleh Clerk.  
   * Role: Super Admin dan Staff.  
   * Fitur registrasi terbuka, namun akun baru berstatus pending hingga di-*approve* oleh Super Admin.  
2. **Google My Business (GMB) Scraper / Integration:**  
   * Halaman pencarian bisnis di mana admin bisa mencari data GMB. *(Catatan teknis untuk AI: Google Maps iframe tidak mengizinkan ekstraksi data karena aturan X-Frame-Options. AI harus menggunakan Google Places API atau backend scrapper untuk mengambil data Nama, Alamat, Rating, Ulasan, dan Foto).* Kita akan pakai Google Places API untuk ini.  
   * Admin mengklik tombol "Pilih Bisnis Ini".  
3. **AI JSON Generator:**  
   * Setelah bisnis dipilih, data mentah dari GMB dikirim ke AI API.  
   * AI memproses dan menghasilkan objek JSON terstruktur (lihat *Data Architecture*).  
   * Admin bisa melakukan *preview* dan *edit* JSON tersebut sebelum di-save.  
   * Klik "Simpan & Generate" akan mengunggah JSON tersebut ke Cloudflare R2.  
4. **CRM (Customer Relationship Management) terintegrasi D1:**  
   * Daftar prospek (*List View* atau *Kanban Board*).  
   * Kolom data: Nama Bisnis, URL Preview, Kontak, Status.  
   * Status Pipeline: Scraped \-\> Contacted \-\> Viewed Preview \-\> Negotiating \-\> Won (Paid) / Lost (Took Free Code).  
   * Admin dapat menambahkan catatan interaksi (*notes*) untuk setiap prospek.

## **4\. Data Architecture**

### **A. Contoh Struktur JSON Website (Disimpan di Cloudflare R2)**

### **1\. Logika Navigasi (Single Page dengan Tab JavaScript)**

Karena situs ini akan diunduh sebagai satu file HTML statis yang di host di Cloudflare Pages (agar gratis), kerangka kerjanya adalah **SPA (Single Page Application) murni menggunakan Vanilla JS \+ Tailwind**.

* **Cara Kerjanya:** Semua "halaman" (Beranda, Tentang Kami, Galeri, dll) sebenarnya di-render sekaligus di dalam DOM HTML, namun dibungkus dalam \<section\> atau \<div\> yang memiliki class seperti hidden atau active.  
* Ketika menu "Tentang Kami" diklik, JavaScript akan menyembunyikan bagian "Beranda" dan menampilkan bagian "Tentang Kami". Ini membuat transisi halaman terjadi secara instan tanpa *loading*.

### **2\. Logika Formulir Kontak (Gratis vs Berbayar)**

* **Versi Download (Gratis):** Tag \<form\> akan tetap ada secara desain, namun *action*\-nya kosong atau menggunakan mailto:. Saat prospek menekan tombol "Kirim", bisa muncul notifikasi JavaScript: *"Formulir ini membutuhkan backend. Hubungi \[Nomor Anda\] untuk mengaktifkan fitur formulir & hosting."* (Ini trik *upsell* yang sangat bagus\!).  
* **Versi Berbayar (Managed Hosting):** Formulir akan secara otomatis diarahkan ke fitur bawaan Cloudflare Pages atau menggunakan layanan formulir gratis statis seperti *Formspree* / *Web3Forms* yang akan mengirimkan email langsung ke pebisnis.

### **3\. Logika Penamaan Gambar & R2**

AI akan men-download foto dari Google Places API, lalu menyimpannya ke Cloudflare R2 dengan aturan penamaan (*naming convention*) berurutan berdasarkan slug bisnis.

* \[namabisnis\]-hero.jpg (Gambar utama di atas)  
* \[namabisnis\]-about.jpg (Gambar profil bisnis)  
* \[namabisnis\]-team1.jpg, \[namabisnis\]-team2.jpg  
* \[namabisnis\]-gallery1.jpg, \[namabisnis\]-gallery2.jpg, dst.

### **4\. Instruksi AI untuk *Font Pairing* & Desain (Berdasarkan Niche)**

Data Google Places API memiliki *field* types (kategori bisnis, misal: *lawyer, restaurant, salon*). AI Anda harus diinstruksikan dengan aturan baku ini:

* **Formal / Resmi (Hukum, Akuntan, Real Estate):**  
  * *Font:* Heading menggunakan **Serif** (misal: *Playfair Display, Merriweather*), Body menggunakan **Sans-Serif** yang bersih (*Inter, Roboto*).  
  * *Warna:* Navy Blue, Emas, Abu-abu tua, Putih.  
* **F\&B / Hospitality (Kafe, Restoran, Hotel):**  
  * *Font:* Heading dan Body menggunakan **Sans-Serif** yang modern dan membulat (*Poppins, Montserrat*).  
  * *Warna:* Warna hangat (Terracotta, Coklat Kopi, Oranye, Merah maroon).  
* **Kecantikan & Kesehatan (Salon, Klinik, Spa):**  
  * *Font:* Heading elegan (**Serif/Display**), Body (**Sans-Serif** ringan).  
  * *Warna:* Pastel, Rose Gold, Mint, Putih Bersih.

File: namabisnis-id.json  
{  
  "meta": {  
    "businessName": "Kopi Senja Jakarta",  
    "businessId": "kopi-senja-jakarta",  
    "niche": "cafe",  
    "language": "id",  
    "seoTitle": "Kopi Senja Jakarta \- Tempat Nongkrong Terbaik",  
    "seoDescription": "Kopi Senja menyajikan biji kopi Nusantara terbaik dengan suasana nyaman di Jakarta.",  
    "faviconSvg": "\<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'\>\<text y='.9em' font-size='90'\>☕\</text\>\</svg\>"  
  },  
  "design": {  
    "themeVariables": {  
      "colors": {  
        "primary": "\#4E342E",  
        "secondary": "\#D7CCC8",  
        "accent": "\#FF7043",  
        "textMain": "\#212121",  
        "textMuted": "\#757575",  
        "background": "\#FAFAFA"  
      },  
      "typography": {  
        "headingFont": "'Poppins', sans-serif",  
        "bodyFont": "'Inter', sans-serif"  
      },  
      "uiTokens": {  
        "borderRadius": "12px",  
        "borderWidth": "1px",  
        "borderColor": "\#E0E0E0",  
        "boxShadow": "0 4px 6px \-1px rgba(0, 0, 0, 0.1)"  
      }  
    },  
    "customCss": "/\* Override Tailwind spesifik \*/\\n.glass-effect { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); }\\n.hover-zoom:hover { transform: scale(1.03); transition: transform 0.3s ease; }"  
  },  
  "global": {  
    "header": {  
      "logoSvg": "\<svg\>...\</svg\>",  
      "logoImageUrl": "kopi-senja-jakarta-logo.png",  
      "ctaButton": {  
        "text": "Hubungi WA",  
        "href": "https://wa.me/6281234567890"  
      }  
    },  
    "footer": {  
      "text": "© 2026 Kopi Senja Jakarta. All rights reserved.",  
      "socials": \[  
        { "platform": "Instagram", "href": "https://instagram.com/kopisenja", "iconSvg": "\<svg\>...\</svg\>" }  
      \]  
    },  
    "socialProof": {  
      "googleRating": "4.8",  
      "reviewCount": "320",  
      "reviews": \[  
        { "authorName": "Andi W", "rating": 5, "text": "Kopinya enak banget, tempatnya cozy buat kerja seharian\!" },  
        { "authorName": "Rina R", "rating": 5, "text": "Croissant-nya juara. Pasti bakal balik lagi ke sini." }  
      \]  
    }  
  },  
  "navigation": {  
    "headerMenu": \[  
      { "label": "Beranda", "href": "\#home" },  
      { "label": "Tentang Kami", "href": "\#about" },  
      { "label": "Menu", "href": "\#services" },  
      { "label": "Galeri", "href": "\#gallery" },  
      { "label": "Kontak", "href": "\#contact" }  
    \]  
  },  
  "pages": \[  
    {  
      "pageId": "home",  
      "pageTitle": "Beranda",  
      "sections": \[  
        {  
          "type": "hero",  
          "id": "hero-main",  
          "content": {  
            "headline": "Awali Harimu dengan Secangkir Inspirasi",  
            "subheadline": "Tempat ngopi paling nyaman di Jakarta. Wi-Fi cepat, kopi nikmat.",  
            "buttons": \[  
              { "text": "Lihat Menu", "href": "\#services", "style": "primary" },  
              { "text": "Booking Tempat", "href": "\#contact", "style": "outline" }  
            \],  
            "image": "kopi-senja-jakarta-hero.jpg"  
          }  
        },  
        {  
          "type": "features",  
          "id": "features-usp",  
          "content": {  
            "title": "Mengapa Memilih Kami?",  
            "items": \[  
              { "title": "Biji Kopi Pilihan", "description": "100% Arabica Nusantara", "iconSvg": "\<svg\>...\</svg\>" },  
              { "title": "Wi-Fi Cepat", "description": "Cocok untuk WFC", "iconSvg": "\<svg\>...\</svg\>" },  
              { "title": "Area Outdoor", "description": "Smoking area yang luas", "iconSvg": "\<svg\>...\</svg\>" }  
            \]  
          }  
        }  
      \]  
    },  
    {  
      "pageId": "about",  
      "pageTitle": "Tentang Kami",  
      "sections": \[  
        {  
          "type": "textImageBlock",  
          "id": "about-story",  
          "content": {  
            "layout": "imageLeft",  
            "title": "Cerita Kami",  
            "bodyHtml": "\<p\>Berdiri sejak 2021, Kopi Senja berawal dari kecintaan kami terhadap kopi lokal. Kami percaya bahwa setiap seduhan menceritakan kisah yang berbeda. Suasana kedai dirancang khusus agar Anda merasa seperti di rumah sendiri.\</p\>",  
            "image": "kopi-senja-jakarta-about.jpg",  
            "button": null  
          }  
        },  
        {  
          "type": "teamGrid",  
          "id": "about-team",  
          "content": {  
            "title": "Tim Hebat Kami",  
            "members": \[  
              { "name": "Budi Santoso", "role": "Head Barista", "image": "kopi-senja-jakarta-team1.jpg" },  
              { "name": "Siti Aminah", "role": "Pastry Chef", "image": "kopi-senja-jakarta-team2.jpg" }  
            \]  
          }  
        }  
      \]  
    },  
    {  
      "pageId": "services",  
      "pageTitle": "Menu & Layanan",  
      "sections": \[  
        {  
          "type": "gridCards",  
          "id": "menu-list",  
          "content": {  
            "title": "Menu Unggulan Kami",  
            "description": "Dibuat dengan bahan premium dan cinta.",  
            "cards": \[  
              { "title": "Es Kopi Senja", "description": "Espresso dengan susu dan gula aren", "price": "Rp 25.000", "image": "kopi-senja-jakarta-service1.jpg" },  
              { "title": "Croissant Butter", "description": "Renyah di luar, lembut di dalam", "price": "Rp 30.000", "image": "kopi-senja-jakarta-service2.jpg" }  
            \]  
          }  
        }  
      \]  
    },  
    {  
      "pageId": "gallery",  
      "pageTitle": "Galeri",  
      "sections": \[  
        {  
          "type": "imageGallery",  
          "id": "gallery-main",  
          "content": {  
            "title": "Suasana Kedai Kami",  
            "images": \[  
              "kopi-senja-jakarta-gallery1.jpg",  
              "kopi-senja-jakarta-gallery2.jpg",  
              "kopi-senja-jakarta-gallery3.jpg",  
              "kopi-senja-jakarta-gallery4.jpg"  
            \]  
          }  
        }  
      \]  
    },  
    {  
      "pageId": "contact",  
      "pageTitle": "Kontak Kami",  
      "sections": \[  
        {  
          "type": "contactForm",  
          "id": "contact-main",  
          "content": {  
            "title": "Hubungi Kami",  
            "address": "Jl. Sudirman No. 12, Jakarta Selatan",  
            "phone": "+62 812-3456-7890",  
            "email": "halo@kopisenja.com",  
            "mapsEmbedUrl": "https://www.google.com/maps/embed/v1/place?key=API\_KEY\&q=place\_id:ChIJ...",  
            "openingHours": \[  
              "Senin \- Jumat: 08:00 \- 22:00",  
              "Sabtu \- Minggu: 07:00 \- 23:00"  
            \],  
            "formConfig": {  
              "heading": "Kirim Pesan",  
              "endpoint": "https://formspree.io/f/endpoint-anda",  
              "buttonText": "Kirim Pesan Sekarang",  
              "fields": \[  
                { "name": "nama", "label": "Nama Lengkap", "type": "text", "required": true },  
                { "name": "email", "label": "Alamat Email", "type": "email", "required": true },  
                { "name": "pesan", "label": "Pesan", "type": "textarea", "required": true }  
              \]  
            }  
          }  
        }  
      \]  
    }  
  \]  
}

### **B. Database Schema (Cloudflare D1)**

#### **1\. Tabel: leads (Database Prospek & CRM Utama)**

Menyimpan semua data prospek hasil *scrape*, status CRM, dan integrasi dengan file JSON di R2.

CREATE TABLE leads (  
    id TEXT PRIMARY KEY, \-- UUID  
    business\_id TEXT UNIQUE NOT NULL, \-- Format: 'namabisnis-kota' (Sama dengan nama file JSON di R2)  
    business\_name TEXT NOT NULL,  
    niche TEXT, \-- Contoh: 'dental\_clinic', 'cafe'  
      
    \-- Informasi Kontak (US Market Focus)  
    email TEXT, \-- Untuk pengiriman email cold outreach  
    phone TEXT, \-- Untuk SMS (US Market)  
    gmb\_url TEXT, \-- Link asli ke Google My Business  
    website\_url TEXT, \-- Jika mereka punya web jelek dan ingin kita ganti (opsional)

    \-- CRM & Tracking  
    status TEXT DEFAULT 'scraped', \-- ENUM: 'scraped', 'contacted', 'viewed', 'negotiating', 'won\_free' (Download HTML), 'won\_paid' (Beli Hosting), 'lost'  
    view\_count INTEGER DEFAULT 0, \-- Bertambah setiap kali script tracking di halaman preview mendeteksi kunjungan  
    last\_viewed\_at DATETIME, \-- Waktu terakhir prospek membuka webview.click/business\_id  
      
    \-- Operasional Admin  
    staff\_id TEXT, \-- ID User dari CLERK (Siapa admin yang mengurus lead ini)  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

#### **2\. Tabel: subscriptions (Pelacakan Pendapatan & Masa Aktif)**

Tabel ini digunakan untuk fitur *Revenue Tracking Dashboard* dan memastikan kita tahu kapan klien harus ditagih kembali (bayar tahunan).

CREATE TABLE subscriptions (  
    id TEXT PRIMARY KEY, \-- UUID  
    lead\_id TEXT NOT NULL, \-- Relasi ke tabel leads  
      
    package\_type TEXT NOT NULL, \-- ENUM: 'basic' ($197), 'premium' ($297)  
    amount\_paid REAL DEFAULT 0.00, \-- Jumlah yang dibayarkan (untuk kalkulasi Revenue Dashboard)  
      
    payment\_status TEXT DEFAULT 'unpaid', \-- ENUM: 'unpaid', 'paid' (Diubah manual oleh admin atau via Stripe Webhook)  
    payment\_method TEXT, \-- Contoh: 'paypal\_personal', 'stripe'  
    payment\_reference TEXT, \-- Catatan manual admin atau Transaction ID dari Stripe/PayPal  
      
    subscription\_start\_date DATETIME, \-- Kapan mulai bayar  
    subscription\_end\_date DATETIME, \-- \+1 tahun dari start\_date  
      
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
      
    FOREIGN KEY (lead\_id) REFERENCES leads(id) ON DELETE CASCADE  
);

#### **3\. Tabel: crm\_activities (Riwayat Interaksi / Log)**

Sangat penting agar Anda dan *Staff* tahu histori komunikasi (Kapan terakhir SMS/Email, dan apa respon klien).

CREATE TABLE crm\_activities (  
    id TEXT PRIMARY KEY, \-- UUID  
    lead\_id TEXT NOT NULL, \-- Relasi ke tabel leads  
    staff\_id TEXT NOT NULL, \-- Relasi ke CLERK User ID yang melakukan aksi  
      
    activity\_type TEXT NOT NULL, \-- ENUM: 'email\_sent', 'sms\_sent', 'note\_added', 'status\_changed'  
    description TEXT NOT NULL, \-- Isi catatan admin atau isi pesan yang dikirim  
      
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
      
    FOREIGN KEY (lead\_id) REFERENCES leads(id) ON DELETE CASCADE  
);

### **Instruksi Tambahan untuk AI Developer Anda Terkait Skema Ini:**

Berikan catatan berikut bersamaan dengan *query SQL* di atas ke AI Anda:

1. **D1 SQLite Limitations:** Harap dicatat bahwa Cloudflare D1 menggunakan engine **SQLite**. Oleh karena itu, tipe data yang digunakan adalah TEXT, INTEGER, dan REAL (tidak ada ENUM native, validasi *enum* harus dilakukan di level aplikasi / TypeScript).  
2. **Auto-Update Timestamp Trigger:** Buatkan fungsi di Backend/Worker yang selalu mengupdate kolom updated\_at di tabel leads dan subscriptions setiap kali ada proses UPDATE.  
3. **View Tracking Logic (Dashboard API):** Saat endpoint backend menerima Ping *view* dari klien, lakukan *query*:  
   UPDATE leads SET view\_count \= view\_count \+ 1, last\_viewed\_at \= CURRENT\_TIMESTAMP, status \= 'viewed' WHERE business\_id \= ? AND status \= 'contacted'  
4. **Revenue Dashboard Query:** Untuk menampilkan analitik di /admin, buat endpoint yang melakukan *SUM* pada amount\_paid di tabel subscriptions di mana payment\_status \= 'paid', serta hitung konversi (*Conversion Rate*) dengan membandingkan jumlah won\_paid di tabel leads dengan total leads.

## **5\. User Flows**

**A. Flow Akuisisi (Admin):**

1. Admin login via Clerk SSO ke /admin.  
2. Buka menu "Find Leads", masukkan kata kunci pencarian GMB (misal: "Kedai Kopi di Bandung").  
3. Pilih "Kedai Kopi A". Klik "Generate Site".  
4. AI mengekstrak info, membuat *copywriting*, memilih kombinasi warna/font, dan menampilkan *draft* JSON.  
5. Admin menyetujui, sistem menyimpan data prospek di D1 dan menaruh JSON di R2.  
6. URL webview.click/kedaikopi-a siap digunakan. Admin mengirim pesan WhatsApp ke *owner* bisnis beserta URL-nya.

**B. Flow Prospek (Business Owner):**

1. *Owner* menerima link webview.click/kedaikopi-a dan membukanya.  
2. Web me-render secara instan dari JSON R2 dengan animasi dan desain yang tampak *custom*. Browser menyimpan kedaikopi-a di *local storage*.  
3. *Owner* takjub. Dia ditawarkan opsi:  
   * **Opsi A:** Download HTML (Gratis) \-\> Klik tombol, unduh ZIP.  
   * **Opsi B:** Terima Beres \-\> Hubungi admin via WhatsApp untuk bayar $120/tahun (Termasuk domain kedaikopia.com \+ Hosting gratis seumur hidup di Cloudflare Pages yang di-*manage* admin).

**C. Flow Kunjungan Ulang (Return Visit):**

1. Besoknya, *owner* mengetik webview.click di browser.  
2. Script mengecek localStorage. Ditemukan *slug* kedaikopi-a.  
3. Website kedaikopi-a langsung ditampilkan.

## **6\. Development Phases (Instruksi untuk AI / Developer)**

* **Phase 1:** Setup Vite \+ React \+ Tailwind \+ Clerk Auth.  
* **Phase 2:** Integrasi Cloudflare D1 (CRUD CRM Leads) & Cloudflare R2 (Upload/Fetch JSON).  
* **Phase 3:** Pembuatan Dynamic Template Engine di *frontend* yang merespons objek JSON (Warna, Font, Konten).  
* **Phase 4:** Pembuatan halaman Admin GMB *Data Fetcher* dan integrasi prompt OpenAI untuk merakit JSON.  
* **Phase 5:** Fitur *Local Storage memory* dan *Export to Static HTML ZIP*.

---

### **Saran Tambahan untuk Anda:**

1. **Masalah Iframe Google Maps:** Di tahap pengembangan, AI mungkin akan mengingatkan bahwa Google Maps tidak bisa dimasukkan ke dalam *iframe* lalu datanya diambil menggunakan JavaScript (karena perlindungan keamanan *CORS/X-Frame-Options* dari Google). *Solusinya:* Gunakan **Google Places API** di backend admin. Admin cukup mengetik nama bisnis, API yang akan menarik semua data (foto, review, alamat) secara resmi, lalu AI akan meracik JSON-nya.  
2. **Export HTML:** Untuk mengubah React ke HTML statis, AI bisa menggunakan *library* kecil di klien untuk mengambil document.documentElement.outerHTML, memasukannya ke file ZIP beserta gambar-gambarnya, dan memicu *download*. Ini sangat mudah di-coding oleh AI.

## **7\. Admin Dashboard (/admin), CRM, & Operasional Bisnis**

### **A. UI/UX: Custom Icon Tabs & Instant Tooltips**

*(Instruksi untuk AI Developer)*

* **Layout Utama:** Halaman /admin menggunakan navigasi berupa *Tabbed Buttons* (hanya menampilkan Icon) di sisi kiri (*Sidebar*) atau atas (*Topbar*).  
* **Custom Tooltip Component:**  
  * HAPUS atribut title bawaan HTML pada semua tombol agar browser tidak memunculkan tooltip bawaan yang *delay*.  
  * Buat komponen React \<CustomTooltip\> yang muncul **secara instan** (tanpa *delay* atau animasi lambat) saat di-*hover*.  
  * **CSS Rule Penting:** Komponen Tooltip harus menggunakan position: absolute atau menggunakan *React Portal* dan memiliki z-index: 9999. Pastikan tooltip di-*render* di luar (di atas) elemen *parent* yang mungkin memiliki atribut overflow: hidden agar teks tooltip tidak terpotong.

### **B. CRM & Lead Tracking (Pelacakan Kunjungan)**

*(Instruksi untuk AI Developer)*  
Sistem CRM harus bisa mendeteksi apakah prospek sudah membuka link *preview* yang kita kirimkan.

1. **Tracking Logic:** Pada *frontend* webview.click/\[id\], buat sebuah *script* ringan (menggunakan useEffect di React). Saat halaman berhasil dimuat, kirim *HTTP POST request* (Ping) ke backend Cloudflare D1/Worker yang berisi businessId dan waktu kunjungan.  
2. **Status CRM Otomatis:** Di database D1, status *Lead* akan otomatis berubah dari Sent menjadi Viewed saat ping tersebut diterima. Admin akan melihat indikator warna hijau (misal: "Dilihat 2 jam yang lalu") di baris CRM prospek tersebut.

### **C. US Market Communication Strategy**

*(Instruksi Khusus Bisnis & Teknis)*  
Karena pasar US jarang menggunakan WhatsApp untuk komunikasi bisnis (mereka lebih menggunakan SMS/iMessage dan Email), maka:

1. **Integrasi Email (Resend/SendGrid):** Tambahkan tombol "Kirim Email via Admin" di CRM. Admin bisa mengirim email dengan *template* yang sudah berisi link webview.click langsung ke email publik GMB mereka.  
2. **SMS Protocol:** Ubah tombol WhatsApp di dashboard admin menjadi tombol SMS (menggunakan protokol sms:+1...). Saat ditekan dari HP/Macbook Anda, ini akan membuka aplikasi pesan bawaan (iMessage). *Saran bisnis untuk Anda: Gunakan aplikasi seperti Skype, OpenPhone, atau Google Voice untuk membeli nomor virtual US agar bisa SMS klien.*

### **D. Instant Screenshot Generator (Untuk Cold Outreach)**

*(Instruksi untuk AI Developer)*  
Mengirim gambar situs yang sudah jadi via email/SMS jauh lebih efektif daripada sekadar link.

1. **Fitur "Capture Preview":** Di dashboard CRM, setiap prospek memiliki tombol kamera (📸).  
2. **Teknis Eksekusi (Client-side):** Gunakan *library* html2canvas atau dom-to-image di dalam React admin.  
3. **Alur:** Saat tombol ditekan, sistem me-*render* URL JSON prospek di dalam *hidden* \<iframe\>, mengambil *screenshot* beresolusi tinggi dari area *Hero section*, dan langsung memunculkan hasil PNG-nya.  
4. **Aksi Lanjutan:** Sediakan tombol "Copy Image" (menggunakan Clipboard API) agar Admin bisa langsung me-*paste* gambar tersebut ke Email atau SMS prospek.

### **E. Revenue Tracking & Dashboard Analytics**

*(Instruksi untuk AI Developer)*  
Sediakan satu Tab khusus bernama **"Dashboard"** (Icon Chart/Grafik) yang menampilkan:

1. **Total Leads Scraped:** Jumlah prospek di database.  
2. **Conversion Rate:** Persentase prospek yang melihat URL dan akhirnya mengunduh (Gratis) vs Membayar (Premium).  
3. **Revenue Overview:** Total pendapatan (Misal: $197 x 5 \= $985).  
4. **Recent Transactions:** Daftar klien yang baru saja membayar beserta paket yang mereka beli (Basic $197 atau Premium $297).

### **F. Integrasi Pembayaran (PayPal Personal & Opsional Stripe)**

*(Instruksi Bisnis & Teknis)*  
Menerima pembayaran dari US untuk layanan berlangganan.

1. **Menggunakan PayPal Personal (Solusi Awal yang Diminta):**  
   * *Bisa atau tidak?* Ya, bisa. Anda bisa menggunakan tautan **PayPal.me** (misal: paypal.me/username/197).  
   * *Kendala:* Karena Personal, tidak ada API otomatis. Klien membayar secara manual, Anda harus mengecek email/aplikasi PayPal Anda, lalu masuk ke /admin dan **secara manual** mengubah status klien dari Unpaid menjadi Paid.  
   * *Instruksi UI:* Di halaman prospek, tambahkan tombol "Tandai Sudah Bayar" yang hanya bisa di-klik oleh Super Admin.  
2. **Sistem Checkout untuk Klien:**  
   * Di halaman webview.click/\[id\], saat klien menekan tombol "Saya Mau Beli", munculkan *Modal/Pop-up* yang mengarahkan mereka ke URL PayPal.me Anda beserta instruksi: *"Tuliskan nama bisnis Anda di catatan pembayaran PayPal".*  
3. **Saran Jangka Panjang (Stripe Payment Links):**  
   * Karena PayPal Personal kurang terlihat profesional untuk B2B dan rawan diblokir jika volume uang masuk terlalu besar, instruksikan AI Anda untuk membuat *schema* yang siap mendukung **Stripe**.  
   * Cukup minta AI membuat kolom payment\_link di D1. Admin bisa men-generate *Stripe Payment Link* satu kali klik, menaruhnya di sistem, dan webhook Stripe akan secara otomatis menandai prospek sebagai Paid di CRM Anda tanpa campur tangan manual.

