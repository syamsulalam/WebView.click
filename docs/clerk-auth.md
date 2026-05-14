# Dokumentasi Integrasi Clerk & Auth

Dokumen ini menjelaskan bagaimana sistem autentikasi Clerk diimplementasikan pada aplikasi WebView.click, cara menyesuaikan metadata untuk akses admin, serta pembaruan terbaru mengenai `needs_client_trust`.

---

## 1. Pembaruan Kepercayaan Klien (`needs_client_trust`)

Clerk telah merilis pembaruan keamanan yang menambahkan status baru `needs_client_trust`. Status ini dipicu jika pengguna masuk (Sign-In) dari perangkat atau klien yang benar-benar baru, di mana sistem akan memberikan tantangan tambahan (seperti autentikasi 2FA) untuk memastikan keamanan.

### Implementasi pada Aplikasi Kita:
- **Kita Menggunakan Komponen Standar (`<SignIn />` dari `@clerk/clerk-react`)**: Pembaruan paket `@clerk/clerk-react` ke versi `6.0.0` atau yang lebih tinggi sudah secara otomatis mendukung dan menangani status `needs_client_trust` di dalam UI komponen bawaannya.
- **Tindakan Tambahan**: Tidak ada perubahan logika kustom yang perlu ditambahkan, karena kita _tidak_ menggunakan aliran sign-in kustom murni via API (seperti mengeksekusi `signIn.create` secara manual dan menangani siklus hidupnya). Cukup pastikan versi paket di `package.json` tetap up-to-date.

---

## 2. Struktur Akses Dashboard & Komponen Kustom

Alur sistem Login telah diperbarui mengikuti aturan yang Anda minta:

1. **Komponen Default di `/admin`**: Jika pengguna belum _log in_, alih-alih di-redirect jauh ke halaman Clerk bawaan, URL tetap berada di `/admin` dan _render_ langsung komponen UI `<SignIn routing="hash" />`.
2. **Kustomisasi Tema Super Sign-In**: Komponen `<SignIn />` dan `<SignUp />` telah diberi gaya (styled) lewat variabel `appearance` pada `<ClerkProvider>` di dalam `src/main.tsx`.
   - **Label di Atas Form**: Form Label telah ditambahkan `display: block` beserta margin bawah agar tampil di atas kotak input (tidak berdampingan).
   - **Tipografi & Warna**: Mengikuti palet sistem (Indigo-600) dengan border melengkung modern, efek _shadow-xl_, dan _padding_ yang pas untuk memberikan kesan _White-Label_ bagi aplikasi web Anda.
3. **Role-based Access Control (RBAC)**: Jika seseorang telah berhasil membuat akun dan log in, sistem tidak langsung membiarkan mereka masuk ke CMS (Content Management System).
   - Sistem melakukan pengecekan meta-data: `user.publicMetadata?.role === 'admin'`.

---

## 3. Cara Memberikan Akses Admin kepada Diri Sendiri (atau Tim)

Bila Anda membuat akun baru, Anda akan menemui layar "Akses Ditolak". Untuk mengubah akun Anda tersebut agar bisa melihat dashboard CRM, ikuti langkah ini:

1. Beralih ke layar tab/browser lain dan masuk ke [Dashboard Clerk](https://dashboard.clerk.com).
2. Pergi ke dalam aplikasi Anda dan navigasi ke menu **Users** di kiri.
3. Klik pada baris _Email address_ milik Anda.
4. Scroll ke bawah sampai Anda menemukan _section_ yang bernama **Public Metadata**.
5. Klik ikon Edit (Pensil), dan ubah format JSON menjadi seperti ini:
   ```json
   {
     "role": "admin"
   }
   ```
6. Simpan konfigurasi tersebut.
7. Kembali ke aplikasi `WebView.click` Anda, lalu muat ulang (refresh) halamannya. Dashboard kini dapat diakses sepenuhnya.
