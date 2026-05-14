# Admin Workflow Audit

Last updated: 15 Mei 2026.

Tujuan `/admin/leads` adalah mencari bisnis yang belum punya website bagus, membuat preview website yang personal, lalu mengubahnya menjadi lead berbayar.

## Current Fixes Implemented

- Search Google Places sekarang memakai cache D1 `places_search_cache`.
- Search default membaca cache dulu; tombol `Refresh` memaksa request baru ke Google Places.
- Cache otomatis punya expiry 30 hari.
- Endpoint maintenance tersedia: `POST /api/places/cache/trim` dengan body `{ "olderThanDays": 30 }`.
- UI `/admin/leads` punya tombol `Trim cache 30d` untuk membersihkan cache lama/expired.
- Setiap Places result disimpan ke `places_prospects` sebagai prospect draft.
- Prospect draft bisa difilter berdasarkan status, no website/has website, dan minimum rating.
- Filter sekarang juga mendukung minimum review count, city, state, dan niche.
- Default admin workflow memprioritaskan bisnis tanpa website.
- Prospect bisa di-skip tanpa menghapus data historis.
- Generate site tidak lagi menghapus hasil pencarian saat `/api/sites/generate` gagal.
- Response generate sekarang dibaca dan ditampilkan sebagai status per bisnis.
- Setiap generate dicatat ke `generation_jobs`.
- Error generate terakhir disimpan ke `places_prospects.last_error` dan terlihat di card/drawer.
- Admin bisa batch generate selected prospects. Queue berjalan sequential di browser agar tidak mengirim banyak AI request paralel.
- Panel `Jobs` menampilkan 100 generation jobs terbaru.
- Jika R2 sync gagal, endpoint tetap lanjut menyimpan site JSON ke D1 agar generate tidak langsung gagal total.
- Admin bisa klik `Load more photos/details` untuk mengambil Place Details. Ini biasanya memberi lebih banyak foto dibanding Text Search.
- Admin bisa membuka drawer detail untuk melihat website, phone, rating, Maps link, status, foto, dan palette.
- Foto/palette pilihan admin disimpan ke `places_prospects`, sehingga pilihan tidak hilang saat admin refresh dan membuka prospect draft lagi.
- Free download owner sekarang berupa zip berisi `index.html` saja, tanpa `site-data.json`, tanpa panel internal WebView.click, dengan Tailwind CSS/CDN hotlink, stylesheet absolute, favicon, dan gambar Google Places hotlink/proxy.

## Why Search Sometimes Shows Only One Image

Google Places Text Search sering hanya mengembalikan ringkasan tempat, termasuk foto terbatas. Untuk pilihan gambar yang lebih banyak, flow yang lebih tepat:

1. Admin search query.
2. Result list muncul dari cache/Google.
3. Admin klik `Load more photos/details` pada bisnis yang menarik.
4. App memanggil `GET /api/places/details?placeId=...`.
5. Admin memilih salah satu foto dari hasil details sebagai brand/logo/palette source.

Catatan penting: Google Places tidak memberi flag reliable bahwa foto adalah owner-uploaded. Ranking sekarang best-effort:

- attribution mirip nama bisnis = `Owner-like`
- tanpa attribution = `No attribution`
- attribution user/reviewer = `UGC/attributed`

## Must Do Next

- Tambahkan filter already generated yang lebih granular dan quick chips untuk kota/state paling sering muncul.
- Tambahkan halaman job view khusus untuk `generation_jobs`, bukan hanya panel ringkas di `/admin/leads`.
- Tambahkan action `Mark contacted` dan template outreach dari prospect drawer.
- Tambahkan retry failed jobs dari panel Jobs.

## Nice To Have

- Place details drawer: tampilkan phone, website, maps URL, hours, rating, review count, categories, photos, dan selected palette dalam panel samping.
- Compare view: pilih 2-3 foto dan lihat preview palette/style preset sebelum generate.
- Outreach workspace: template email/SMS/WhatsApp per niche dan bahasa wilayah.
- “Without website first” default mode untuk target utama WebView.click.
- Lead enrichment: detect domain/website quality jika bisnis sudah punya website, lalu tandai sebagai redesign candidate.
- Duplicate detection by `place_id`, phone, website, and normalized business name.
- Cost guardrail: daily AI spend estimate, generated count, and warning before expensive model batch.

## Best Practice Notes

- Jangan menghapus result list setelah generate; admin biasanya ingin generate beberapa bisnis dari satu query.
- Treat Google data as source/provenance, not final truth. Admin tetap perlu bisa edit JSON.
- Cache search queries to reduce Google API spend, but always provide a refresh button because business data can change.
- Use Place Details only on promising rows. Calling details for every row increases cost and slows admin work.
- Store selected photo reference and attribution in generated JSON so future debugging can trace the image source.
- Keep `/admin/leads` focused on repeated work: search, qualify, inspect photos/details, generate, open preview, contact.
