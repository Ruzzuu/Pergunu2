# PERGUNU Situbondo — Cloudflare

Pengganti bersih untuk aplikasi PERGUNU lama. Satu Cloudflare Worker menjalankan API dan aset React, D1 menyimpan data, R2 menyimpan gambar/PDF, dan Resend mengirim email transaksional.

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
