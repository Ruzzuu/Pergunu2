# Arsitektur

```mermaid
flowchart LR
  Browser[Browser pengguna/admin] --> Worker[Cloudflare Worker]
  Worker --> Assets[React static assets]
  Worker --> D1[(D1 database)]
  Worker --> R2[(R2 media pribadi/publik)]
  Worker --> Resend[Resend email]
  Browser --> Turnstile[Cloudflare Turnstile]
  Worker --> Turnstile
```

Worker dan frontend menggunakan origin yang sama. Semua perubahan data melewati `/api/*`; browser tidak memiliki kredensial D1, R2, atau Resend.

## Data dan akses

- `news` dan `scholarships` dapat dibaca publik setelah diterbitkan.
- Form publik menghasilkan nomor referensi acak. Pemeriksaan status memerlukan nomor referensi dan email.
- `sessions` menyimpan hash token; browser menerima cookie HTTP-only dengan masa berlaku 12 jam.
- `auth_tokens` menyimpan hash undangan dan reset sekali pakai.
- Endpoint `/api/admin/*` memeriksa sesi dan peran admin di server.
- Gambar berita dibaca publik melalui `/media/images/*`. Sertifikat hanya tersedia melalui endpoint akun pemilik.
- Semua tindakan penting dicatat di `audit_events`.

## Alur persetujuan anggota

```mermaid
sequenceDiagram
  participant P as Pendaftar
  participant W as Worker
  participant A as Admin
  participant E as Resend
  P->>W: Form anggota
  W-->>P: Nomor referensi
  A->>W: Setujui
  W->>W: Buat user berstatus invited
  W->>E: Tautan atur password 48 jam
  P->>W: Atur password
  W->>W: Aktifkan akun dan buat sesi
```
