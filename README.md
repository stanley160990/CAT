# Aplikasi Web Computer Assisted Test (CAT) - PostgreSQL

Aplikasi Computer Assisted Test (CAT) berbasis Web modern untuk seleksi terpadu dengan seluruh data tersimpan langsung di database **PostgreSQL**. Dirancang dengan arsitektur multi-role: **Peserta**, **Operator Ruangan**, dan **Admin Keseluruhan**.

---

## 🔐 Akun & Password Default

Seluruh kata sandi di-hash menggunakan algoritma **SHA-1** dan disimpan langsung di database PostgreSQL.

| Role | Username / No. Peserta | Password Default | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin Keseluruhan (Super Admin)** | `admin` | `admin123` | Membuka/mengakhiri ujian, kelola ujian, ruangan, bank soal, dan peserta |
| **Operator Ruang 01** | `operator1` | `operator123` | Pengawas Lab CBT 01, tambah waktu, cetak lembar jawaban |
| **Operator Ruang 02** | `operator2` | `operator123` | Pengawas Lab CBT 02 |
| **Peserta 1** | `2026001` | `peserta123` | Alokasi Ruang Lab 01, Ujian Simulasi 2026 |
| **Peserta 2** | `2026002` | `peserta123` | Alokasi Ruang Lab 01, Ujian Simulasi 2026 |
| **Peserta 3** | `2026003` | `peserta123` | Alokasi Ruang Lab 02, Ujian Simulasi 2026 |
| **Peserta 4** | `2026004` | `peserta123` | Alokasi Ruang Lab 02, Ujian Simulasi 2026 |

---

## 🚀 Alur Kerja Sistem (Application Workflow)

```
[ Admin Keseluruhan ]
  ├── 1. Mengelola Operator Ruangan (Tambah username & password, atau Import CSV)
  ├── 2. Mengelola Ruangan Ujian (Lab CBT, Lokasi, Kapasitas - tanpa operator statis)
  ├── 3. Membuat Kelompok Bank Soal terlebih dahulu, kemudian menambahkan butir soal / Import CSV
  ├── 4. Membuat Jadwal Ujian:
  │      ├── Memilih Jenis Ujian: Pilihan Ganda ATAU Essay (Murni tanpa Mix)
  │      ├── Memilih Kelompok Bank Soal yang digunakan
  │      ├── Memilih Multi-Ruangan (bisa memilih banyak ruangan sekaligus)
  │      ├── Menentukan Operator Penanggung Jawab Ujian
  │      └── Menentukan Formula Skoring (MCQ) atau KKM Passing Grade
  ├── 5. Mengupload Data Peserta (Manual / CSV Peserta)
  └── 6. Memulai Ujian Serentak ("Mulai Ujian")
           │
           ▼
[ Peserta ]
  ├── 1. Login Sederhana (Username & Password hash SHA-1)
  ├── 2. Masuk Ruang Tunggu & Membaca Tata Tertib CAT
  ├── 3. Halaman Auto-Sync mendeteksi ujian telah dibuka Admin
  ├── 4. Mengerjakan Soal CAT:
  │      ├── Hitungan mundur waktu (Timer Countdown)
  │      ├── Jawaban otomatis tersimpan seketika ke PostgreSQL (Auto-save)
  │      └── Penanda ragu-ragu & navigasi kisi nomor soal
  └── 5. Waktu Habis / Klik Selesai ➔ Nilai Pilihan Ganda langsung dikalkulasi instan
           │
           ▼
[ Operator Ruangan ]
  ├── 1. Memantau Peserta di Ruangannya secara realtime
  ├── 2. Memberikan Tambahan Waktu (+5, +10, +15 mnt) jika komputer bermasalah / peserta telat
  ├── 3. Mereset sesi login peserta jika komputer mati mendadak (jawaban tetap aman)
  ├── 4. Mengunduh Rekapitulasi Hasil Ujian Ruangan (CSV)
  └── 5. Mencetak / Mengunduh Lembar Jawaban Peserta (Answer Sheet)
           │
           ▼
[ Admin Keseluruhan ]
  ├── 1. Koreksi Soal Essay:
  │      ├── Dikelompokkan per Ujian
  │      └── Fasilitas penilaian rubrik per butir soal + feedback/catatan penguji
  ├── 2. Mengakhiri Keseluruhan Ujian ("Akhiri Ujian")
  └── 3. Mengunduh Rekapitulasi Nilai Lengkap Seluruh Ruangan (CSV)
```

---

## 🗄️ Konfigurasi Database PostgreSQL

Aplikasi telah dilengkapi konfigurasi terpisah pada file:
- `src/config/database.ts` (Konfigurasi koneksi modular)
- `src/db/index.ts` (Connection pool Drizzle ORM)
- `init-db.sql` (Skrip skema tabel dan inisiasi data SQL mandiri)

### Pengaturan Variabel Lingkungan (`.env`)

Untuk menghubungkan ke PostgreSQL lokal Anda sendiri:

```bash
# Host database (e.g. localhost atau nama service docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=cat_user
DB_PASSWORD=cat_password_123
DB_NAME=cat_db

# Port Web Server
PORT=3000
```

> **Catatan:** Jika dijalankan di lingkungan Cloud SQL Google AI Studio, aplikasi secara otomatis mengenali variabel bawaan `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, dan `SQL_DB_NAME`.

---

## 🐳 Deployment Menggunakan Docker & Docker Compose

Aplikasi telah dilengkapi dengan `Dockerfile` dan `docker-compose.yml` untuk kemudahan deploy pada server lokal atau VPS.

### Langkah Menjalankan:

1. **Jalankan Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

2. **Periksa Status Container:**
   ```bash
   docker compose ps
   ```
   Dua container akan berjalan:
   - `cat_postgres`: Service database PostgreSQL 16 lengkap dengan volume persistensi data `pgdata` dan auto-init skema dari `init-db.sql`.
   - `cat_web`: Service aplikasi web CAT yang berjalan pada port 3000.

3. **Buka Aplikasi:**
   Buka browser dan akses:
   ```
   http://localhost:3000
   ```

4. **Menghentikan Container:**
   ```bash
   docker compose down
   ```
   *(Data ujian tetap aman tersimpan di Docker volume `pgdata`)*.

---

## 💻 Menjalankan Secara Manual (Tanpa Docker)

Jika Anda sudah memiliki server PostgreSQL lokal yang aktif:

1. **Buat Database PostgreSQL:**
   ```sql
   CREATE DATABASE cat_db;
   ```

2. **Jalankan Skrip Inisialisasi Tabel & Data Awal:**
   ```bash
   psql -U postgres -d cat_db -f init-db.sql
   ```

3. **Instal Dependensi Node.js:**
   ```bash
   npm install
   ```

4. **Jalankan Server Development:**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

5. **Build dan Jalankan untuk Produksi:**
   ```bash
   npm run build
   npm start
   ```

---

## 📊 Format Template Upload Massal (CSV)

### 1. Template Operator (`template_upload_operator_cat.csv`)
Kolom: `username`, `nama_lengkap`, `password`, `email`, `room_id`
```csv
username,nama_lengkap,password,email,room_id
operator3,Rahmat Santoso,operator123,rahmat@example.com,1
operator4,Siti Nurhaliza,operator123,siti@example.com,2
```

### 2. Template Peserta (`template_upload_peserta_cat.csv`)
Kolom: `nomor_peserta`, `nama_lengkap`, `password`, `email`, `room_id`, `exam_id`
```csv
nomor_peserta,nama_lengkap,password,email,room_id,exam_id
2026005,Hendra Wijaya,peserta123,hendra@example.com,1,1
2026006,Maya Anggraini,peserta123,maya@example.com,1,1
```

### 3. Template Soal (`template_upload_soal_cat.csv`)
Kolom: `nama_bank_soal`, `soal`, `jenis`, `pilihan_a`, `pilihan_b`, `pilihan_c`, `pilihan_d`, `pilihan_e`, `kunci`, `bobot`, `pembahasan`
```csv
nama_bank_soal,soal,jenis,pilihan_a,pilihan_b,pilihan_c,pilihan_d,pilihan_e,kunci,bobot,pembahasan
"Bank Soal SKD TWK 2026","Ibukota Negara Indonesia adalah...","multiple_choice","Surabaya","Jakarta","IKN Nusantara","Medan","Bandung","C","5","Sesuai UU IKN."
"Bank Soal Penalaran Studi Kasus","Jelaskan prinsip pelayanan publik!","essay","","","","","","Pedoman: Transparansi, akuntabilitas, kecepatan.","15","Kriteria rubrik penilaian."
```
*(Semua file template CSV resmi dapat diunduh langsung melalui tombol "Unduh Template CSV" di masing-masing panel Admin).*

---

## 🔒 Keamanan & Integritas Data
- **SHA-1 Password Hash:** Tidak ada kata sandi yang disimpan dalam bentuk teks biasa (plain text).
- **Direct Database Authentication:** Login langsung memeriksa kecocokan username dan hash kata sandi pada PostgreSQL.
- **Auto-Save Answer Sheets:** Jawaban peserta disimpan seketika setiap kali opsi diklik atau uraian diketik, mencegah kehilangan data saat terjadi pemadaman listrik atau crash komputer.
