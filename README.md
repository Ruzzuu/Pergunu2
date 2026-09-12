# PERGUNU Situbondo — Cloudflare

Migrasi backend PERGUNU dengan tampilan asli dipulihkan. Satu Cloudflare Worker menjalankan API dan aset React, D1 menyimpan data, R2 menyimpan gambar/PDF, dan Resend mengirim email transaksional setelah dikonfigurasi.

Preview aktif: [pergunu-situbondo-preview.fairuz-fuadi04.workers.dev](https://pergunu-situbondo-preview.fairuz-fuadi04.workers.dev). Preview menggunakan `pergunu-db-preview` dan `pergunu-media-preview`; keduanya terpisah dari resource produksi.

## Menjalankan secara lokal

Persyaratan: Node.js 20 atau lebih baru dan npm.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run data:prepare -- ../backend/src/db.json
npm run data:import:local
npm run admin:create -- --email admin@example.com --app-url http://localhost:5173
```

Jalankan API dan frontend pada dua terminal:

```bash
npm run dev:worker
npm run dev
```

Frontend tersedia di `http://localhost:5173`; Worker lokal di `http://localhost:8787`. Tautan aktivasi admin dicetak sekali oleh perintah `admin:create`.

## Pemeriksaan

```bash
npm run check
```

Data pribadi tidak pernah boleh dimasukkan ke repository ini. SQL hasil impor dibuat di `.generated/`, memiliki permission lokal terbatas, dan diabaikan oleh Git.

Lanjutkan dengan [panduan migrasi](docs/MIGRATION-ID.md), [panduan operasional](docs/OPERATIONS-ID.md), dan [arsitektur](docs/ARCHITECTURE.md).

## Mengubah tampilan

Entry point `src/main.jsx` memakai `src/legacy/App.jsx`. Komponen, halaman, CSS, gambar, dan dokumen publik berasal dari `../frontend`. Edit halaman di `src/legacy/pages/` dan komponen di `src/legacy/componen/`. Seluruh CSS asli dipertahankan.

`src/legacy/services/cloudflare.js` memetakan permintaan komponen asli ke API Cloudflare. Autentikasi menggunakan cookie server; data tampilan di localStorage bukan sumber otorisasi. Password setup/reset, nomor referensi untuk cek status, dan akses sertifikat privat adalah penyesuaian alur yang diperlukan untuk backend baru.
