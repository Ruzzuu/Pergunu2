# Panduan migrasi dan peluncuran

## 1. Buat repository bersih

Folder ini dirancang menjadi akar repository privat baru. Pastikan `git status` tidak pernah menampilkan `.dev.vars`, `.generated`, `db.json`, `mongodb-import`, atau folder upload. Repository lama mengandung data pribadi dan rahasia Cloudinary dalam riwayat; jadikan privat setelah repository baru dan backup terverifikasi. Pemilik akun Cloudinary lama tetap harus merotasi rahasianya.

## 2. Buat resource Cloudflare

Masuk ke akun Cloudflare yang dimiliki organisasi, lalu buat database dan bucket:

Aktifkan R2 satu kali melalui Cloudflare Dashboard terlebih dahulu. Cloudflare dapat meminta persetujuan metode pembayaran meskipun pemakaian masih berada dalam kuota gratis. Setelah status R2 aktif, jalankan:

```bash
npx wrangler login
npx wrangler d1 create pergunu-db
npx wrangler d1 create pergunu-db-preview
npx wrangler r2 bucket create pergunu-media
npx wrangler r2 bucket create pergunu-media-preview
```

Ganti UUID nol/placeholder produksi di `wrangler.jsonc` setelah database produksi dibuat. Preview telah dikonfigurasi pada `https://pergunu-situbondo-preview.fairuz-fuadi04.workers.dev`. Simpan rahasia pada kedua environment:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put RESEND_API_KEY --env preview
npx wrangler secret put TURNSTILE_SECRET --env preview
```

Atur `RESEND_FROM` setelah domain pengirim diverifikasi di Resend. Buat Turnstile widget untuk hostname preview dan `pergunu.fairuzfd.dev`, lalu set `VITE_TURNSTILE_SITE_KEY` pada lingkungan build.

## 3. Migrasi skema dan data

Jalankan skema terhadap preview terlebih dahulu. Jangan memasukkan file database lama ke repository baru.

```bash
npm run db:migrate:preview
npm run data:prepare -- /lokasi/aman/db.json
npx wrangler d1 execute pergunu-db-preview --remote --env preview --file=.generated/legacy-import.sql
```

`data:prepare` berhenti jika jumlah sumber bukan 6 user, 7 berita, 8 pendaftaran anggota, dan 6 beasiswa. Perintah ini:

- membuang 39 sesi lama dan semua hash kata sandi;
- membuat ID stabil agar impor dapat diulang tanpa duplikasi;
- menandai semua akun untuk membuat kata sandi baru;
- menandai 7 gambar berita dan 3 sertifikat sebagai file hilang;
- membersihkan HTML berita sebelum membuat SQL.

Untuk deployment otomatis, tambahkan GitHub Environments bernama `preview` dan `production`. Isi masing-masing dengan `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, dan `VITE_TURNSTILE_SITE_KEY`. Batasi token Cloudflare pada Worker, dua D1 database, dua bucket R2, dan zona domain proyek ini.

Periksa `.generated/legacy-import-report.json`, kemudian buat admin baru:

```bash
npm run admin:create -- --email admin@domain-anda --name "Nama Admin" --remote --app-url https://URL-PREVIEW
```

## 4. Preview dan produksi

```bash
npm run check
npm run deploy:preview
```

Di preview, uji login admin, data hasil impor, persetujuan, undangan, unggah gambar, unggah/unduh sertifikat, dan pengiriman email. Unggah ulang media yang ditandai hilang atau biarkan placeholder.

Sebelum produksi, terapkan `npm run db:migrate:remote`, ulangi impor tervalidasi dengan `npm run data:import:remote`, lalu buat admin produksi baru. Jangan menyalin sesi atau token preview. Workflow GitHub `Deploy Cloudflare` menyediakan tombol terpisah untuk preview dan production setelah secret repository dikonfigurasi.

## 5. Domain dan rollback

Saat ini `pergunu.fairuzfd.dev` mengarah ke `52.117.52.70`, menyajikan halaman nginx lama melalui HTTP, dan HTTPS gagal. Nameserver `fairuzfd.dev` dikelola Name.com.

Sebelum memindahkan nameserver:

1. Ekspor dan simpan seluruh record DNS Name.com.
2. Tambahkan zona `fairuzfd.dev` di Cloudflare dan salin seluruh record, termasuk MX, TXT, DKIM, SPF, serta subdomain lain.
3. Bandingkan record satu per satu dan uji layanan email.
4. Tambahkan custom domain `pergunu.fairuzfd.dev` ke Worker.
5. Ubah nameserver di registrar dan pantau DNS serta HTTPS.

Simpan ekspor D1 sebelum cutover dan catat deployment Worker terakhir yang lolos uji. Rollback aplikasi dilakukan lewat Cloudflare Deployments; rollback DNS dilakukan dengan mengembalikan record lama yang sudah diekspor.
