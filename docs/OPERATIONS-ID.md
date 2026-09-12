# Panduan pengelolaan harian

## Layanan yang dimiliki

| Layanan | Fungsi | Rahasia/billing |
|---|---|---|
| GitHub privat | Source code dan riwayat perubahan | Aktifkan 2FA; jangan simpan ekspor data |
| Cloudflare Workers | Website dan API | Deployment dan log |
| Cloudflare D1 | User, berita, beasiswa, pendaftaran | Backup sebelum migrasi/perubahan besar |
| Cloudflare R2 | Gambar dan sertifikat | Sertifikat harus tetap privat |
| Cloudflare Turnstile | Perlindungan form publik | Secret hanya di Worker |
| Resend | Email undangan dan status | API key hanya di Worker secrets |
| Name.com/Cloudflare DNS | Kepemilikan domain | Jaga akses registrar dan recovery email |

Gunakan email organisasi, password manager, dan 2FA untuk setiap akun. Catat pemilik, recovery email, serta metode pembayaran dalam dokumen internal yang tidak disimpan di Git.

## Tugas admin di website

- **Pendaftaran:** buka tab Pendaftaran, pilih jenis, lalu setujui atau tolak. Persetujuan anggota membuat akun dan mengirim tautan password 48 jam. Penolakan harus berisi alasan.
- **Berita:** buat judul, ringkasan, isi HTML sederhana, kategori, dan gambar maksimal 5 MB. Centang Terbitkan agar publik; hanya satu berita utama yang aktif.
- **Beasiswa:** gunakan Draf saat menyiapkan, Dibuka untuk menerima form, dan Ditutup setelah deadline. Beasiswa dengan pendaftaran tidak dapat dihapus.
- **Pengguna:** kirim ulang undangan bila tautan kedaluwarsa, tangguhkan akun untuk mencabut semua sesinya, dan berikan peran admin hanya kepada pengelola resmi.
- **Sertifikat:** unggah PDF valid maksimal 10 MB. File hanya dapat diunduh oleh pemilik akun.

## Deployment aman

```bash
git pull --ff-only
npm ci
npm run check
npm run deploy
```

Setelah deployment, buka `/api/health`, halaman publik, satu berita, login admin, dan daftar pendaftaran. Periksa log Worker bila ada respons 500. Jangan mengubah D1 secara manual sebelum membuat ekspor.

## Backup dan pemulihan

Sebelum deployment yang mengubah skema atau sebelum impor besar:

```bash
mkdir -p .generated/backups
npx wrangler d1 export pergunu-db --remote --output .generated/backups/pergunu-YYYY-MM-DD.sql
```

Simpan salinan backup terenkripsi di media organisasi di luar repository. Uji pemulihan secara berkala ke database preview. R2 harus diaudit terpisah: bandingkan jumlah objek dengan tabel `certificates` dan berita yang memiliki `image_key`.

## Insiden dan rotasi rahasia

Jika API key bocor, cabut di penyedia, buat key baru, lalu jalankan `wrangler secret put NAMA_SECRET`. Jika sesi pengguna dicurigai, hapus sesi user terkait atau seluruh tabel sesi. Untuk akun admin yang disusupi, tangguhkan akun, hapus sesinya, dan kirim undangan/reset baru dari akun admin lain.

Jangan memulihkan Cloudinary secret, password default, hash password lama, atau file `.env` dari repository lama.
