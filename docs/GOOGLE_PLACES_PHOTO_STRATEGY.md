# Google Places Photo Strategy

Last updated: 14 Mei 2026.

Dokumen ini menjelaskan arah produk terbaru untuk foto Google Business Profile / Google Places di WebView.click.

## Decision

Untuk situs gratis, WebView.click tidak menyimpan ulang foto Google Places ke R2.

Situs gratis akan:
- Menyimpan `placeId`, photo reference/name, proxy URL `/api/places/photo`, photo source, dan attribution metadata di JSON.
- Merender foto runtime lewat endpoint proxy `/api/places/photo`.
- Menampilkan caption/attribution dekat dengan gambar, misalnya `Photo from Google Business Profile`.
- Menjaga zip/export tetap ringan karena tidak membawa binary foto Google.

Untuk situs paid, gambar Google Places sebaiknya diganti dengan:
- Upload manual dari owner.
- Asset brand resmi dari owner.
- Foto yang kita generate atau produksi sendiri.
- Asset final yang aman disimpan ke R2 dengan filename mengandung slug bisnis.

## Reasoning

Alasan teknis:
- Tidak menghabiskan storage R2 untuk free preview.
- Zip/download gratis tetap sederhana.
- Foto Google Places bisa expire jika memakai photo reference/name, sehingga lebih cocok dipanggil runtime daripada diperlakukan sebagai file permanen.
- Kalau paid client sudah onboard, kita bisa minta asset langsung dari owner dan menyimpan asset final ke R2.

Alasan compliance:
- Google Places policy membatasi caching/storing Places content.
- Place ID boleh disimpan lebih long-term, tetapi photo reference/name dan konten Places tidak boleh diperlakukan sebagai owned asset permanen.
- Jika menampilkan foto Places, attribution/author attribution harus ditampilkan saat tersedia.

## Implementation

Frontend CRM:
- `AdminLeads` tetap mengambil foto melalui `/api/places/photo`.
- Admin memilih foto sebagai sumber palette/brand.
- Selection menyimpan:
  - `selectedLogoImageUrl`
  - `selectedLogoReference`
  - `selectedLogoSource = "google_places"`
  - `selectedLogoAttributions`
  - `selectedLogoPriority`

Pages Function:
- `functions/api/[[path]].ts` menulis metadata foto ke `brand`:
  - `brand.logoImageUrl`
  - `brand.photoSource`
  - `brand.googlePhotoReference`
  - `brand.photoCaption`
  - `brand.photoAttributions`
  - `brand.selectedPhotoPriority`
- `uploadImageAssetsToR2()` melewati Google Places photo URLs. URL seperti `/api/places/photo`, Google photo media endpoint, dan `googleusercontent.com` tidak di-upload ke R2.
- JSON final masih bisa disimpan ke R2, tetapi binary foto Google tidak disalin.

Renderer:
- `SiteRenderer` menampilkan attribution overlay untuk gambar Google Places.
- Caption default: `Photo from Google Business Profile`.
- Jika `brand.photoAttributions` ada, caption menambahkan nama attribution.

## Palette Strategy

Current behavior:
- Admin can pick one photo in `/admin/leads`; the browser extracts a dominant palette from that image via canvas and saves it to `places_prospects.selected_palette_json`.
- `/admin/sites` uses the saved selected photo/palette when present.
- If admin forgets to pick a photo, generation uses the first available Places photo as image fallback where possible.
- If no palette is saved, generation uses a safe default palette (`#111827`, `#4F46E5`, `#F3F4F6`) rather than a random palette.

Implemented / current direction:
- `brand.paletteOptions` is supported in generated JSON as up to 5 palette choices, each tied to a different Places photo when available:
  - `id`
  - `label`
  - `colors`
  - `sourceImageUrl`
  - `photoReference`
  - `attributions`
- `/admin/leads` extracts these palette options from the first 5 usable photos after `Gather data`.
- Palette options are stored on the prospect in `places_prospects.palette_options_json` so they survive refresh and can be reused by `/admin/sites`.
- The owner can choose among those palette options in `/:businessId` before download/setup, similar to the font pairing selector.
- Keep `brand.palette` as the default active palette for rendering/export.

## Free vs Paid Behavior

Free:
- Hotlink/proxy Google Places photo.
- Untuk HTML gratis yang diberikan ke owner, tetap gunakan proxy WebView.click untuk foto Places. Direct hotlink ke Google Places Photo membutuhkan API key di URL/header atau redirect ke media URL yang tidak stabil/berumur pendek; memasukkan key ke HTML owner akan membocorkan key dan sulit direstrict ke domain owner yang belum pasti.
- Attribution wajib tampil.
- Tidak ada R2 image copy.
- Jika photo reference expire, preview bisa perlu refresh dari Places data.

Paid:
- Replace Google Places photos with owner-provided/generated images.
- Upload final image assets to R2.
- Filename asset harus tetap mengandung slug bisnis.
- Attribution Google tidak perlu dipakai jika asset bukan Google Places content.

## Debug Notes

Jika foto gratis tidak tampil:
- Cek `GOOGLE_PLACES_API_KEY`.
- Cek `/api/places/photo?reference=...`.
- Cek apakah photo reference/name sudah expire.
- Refresh data Places untuk mendapat photo reference terbaru.

Jika foto Google tiba-tiba masuk R2:
- Cek `isGooglePlacesPhotoUrl()` di `functions/api/[[path]].ts`.
- Pastikan URL foto tetap memakai `/api/places/photo` atau host Google yang dikenali.

## Sources

- Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Place Photos (New): https://developers.google.com/maps/documentation/places/web-service/place-photos
- Place Photos (Legacy): https://developers.google.com/maps/documentation/places/web-service/photos?hl=en
