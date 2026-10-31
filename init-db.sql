-- ========================================================
-- SISTEM COMPUTER ASSISTED TEST (CAT) - POSTGRESQL SCHEMA
-- Inisialisasi Tabel dan Data Awal
-- ========================================================

-- 1. Tabel Ruangan (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30,
  location TEXT NOT NULL DEFAULT '',
  operator_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Ujian (Exams)
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'multiple_choice',
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  scoring_correct INTEGER NOT NULL DEFAULT 4,
  scoring_wrong INTEGER NOT NULL DEFAULT 0,
  scoring_empty INTEGER NOT NULL DEFAULT 0,
  passing_grade INTEGER NOT NULL DEFAULT 65,
  randomize_questions BOOLEAN NOT NULL DEFAULT TRUE,
  randomize_options BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft',
  bank_name TEXT DEFAULT 'Bank Soal Utama',
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  room_ids TEXT DEFAULT '[]',
  room_names TEXT DEFAULT '',
  room_operators TEXT DEFAULT '[]',
  operator_id INTEGER,
  operator_name TEXT DEFAULT '',
  started_at TIMESTAMP WITHOUT TIME ZONE,
  ended_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Pengguna (Users: Admin, Operator Ruangan, Peserta)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'peserta',
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL,
  extra_time_minutes INTEGER NOT NULL DEFAULT 0,
  exam_status TEXT NOT NULL DEFAULT 'registered',
  started_at TIMESTAMP WITHOUT TIME ZONE,
  finished_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Soal (Questions)
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 1,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  content TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  correct_answer TEXT,
  points INTEGER NOT NULL DEFAULT 5,
  explanation TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Lembar Jawaban Peserta (Participant Answers)
CREATE TABLE IF NOT EXISTS participant_answers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT,
  essay_answer TEXT,
  is_doubtful BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER NOT NULL DEFAULT 0,
  is_correct BOOLEAN,
  essay_feedback TEXT,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 6. Tabel Hasil Ujian (Exam Results)
CREATE TABLE IF NOT EXISTS exam_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  empty_count INTEGER NOT NULL DEFAULT 0,
  mcq_score INTEGER NOT NULL DEFAULT 0,
  essay_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  is_passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- DATA AWAL (DEFAULT SEED DATA)
-- Password di-hash menggunakan SHA-1:
-- 'admin123'    -> f865b53623b121fd34ee5426c792e5c33af8c227
-- 'operator123' -> 4aed7fb4eed446796c59ab3fd911e359f063ec83
-- 'peserta123'  -> 989186acb8b1c6d80c546e245df27391957a3192
-- ========================================================

-- Seed Ruangan
INSERT INTO rooms (room_code, name, capacity, location, operator_name) VALUES
('LAB-01', 'Laboratorium CBT 01 (Utama)', 40, 'Gedung Rektorat Lt. 3, Sayap Barat', 'Bambang Sudirman, S.Kom'),
('LAB-02', 'Laboratorium CBT 02 (Multimedia)', 35, 'Gedung TI Lt. 2, Sayap Timur', 'Ratna Kusuma, M.Kom')
ON CONFLICT (room_code) DO NOTHING;

-- Seed Ujian
INSERT INTO exams (id, title, exam_type, description, duration_minutes, scoring_correct, scoring_wrong, scoring_empty, passing_grade, randomize_questions, randomize_options, status) VALUES
(1, 'Simulasi CAT Mandiri & Seleksi Terbuka 2026', 'mix', 'Ujian simulasi komprehensif CAT BKN: Pilihan Ganda & Soal Penalaran Studi Kasus (Essay).', 30, 5, 0, 0, 65, true, true, 'draft')
ON CONFLICT (id) DO NOTHING;

-- Seed Pengguna (Admin, Operator, Peserta)
INSERT INTO users (username, password_hash, name, email, role, room_id, exam_id, exam_status) VALUES
('admin', 'f865b53623b121fd34ee5426c792e5c33af8c227', 'Administrator Utama (Pusat)', 'admin@cat-system.id', 'admin', NULL, NULL, 'registered'),
('operator1', '4aed7fb4eed446796c59ab3fd911e359f063ec83', 'Bambang Sudirman, S.Kom', 'bambang@cat-system.id', 'operator', 1, NULL, 'registered'),
('operator2', '4aed7fb4eed446796c59ab3fd911e359f063ec83', 'Ratna Kusuma, M.Kom', 'ratna@cat-system.id', 'operator', 2, NULL, 'registered'),
('2026001', '989186acb8b1c6d80c546e245df27391957a3192', 'Ahmad Fauzi Pratama', 'fauzi@example.com', 'peserta', 1, 1, 'registered'),
('2026002', '989186acb8b1c6d80c546e245df27391957a3192', 'Siti Nurhaliza Putri', 'siti@example.com', 'peserta', 1, 1, 'registered'),
('2026003', '989186acb8b1c6d80c546e245df27391957a3192', 'Budi Santoso Wibowo', 'budi@example.com', 'peserta', 2, 1, 'registered'),
('2026004', '989186acb8b1c6d80c546e245df27391957a3192', 'Dewi Ayu Lestari', 'dewi@example.com', 'peserta', 2, 1, 'registered')
ON CONFLICT (username) DO NOTHING;

-- Seed Butir Soal (Pilihan Ganda & Essay)
INSERT INTO questions (exam_id, question_order, question_type, content, option_a, option_b, option_c, option_d, option_e, correct_answer, points, explanation) VALUES
(1, 1, 'multiple_choice', 'Pancasila sebagai dasar negara Indonesia memiliki kedudukan sebagai sumber dari segala sumber hukum formal negara. Sila yang paling menekankan prinsip keadilan sosial bagi seluruh rakyat Indonesia dilambangkan oleh...', 'Bintang Bersudut Lima Emas', 'Tali Rantai Bulat dan Persegi', 'Pohon Beringin Rindang', 'Kepala Banteng Hitam', 'Padi dan Kapas Bersusun', 'E', 5, 'Padi dan Kapas melambangkan sandang dan pangan yang mencerminkan kemakmuran dan keadilan sosial bagi seluruh rakyat Indonesia.'),
(1, 2, 'multiple_choice', 'Jika semua aparatur negara wajib menjunjung tinggi integritas moral, dan sebagian peserta seleksi CAT kelak menjadi aparatur negara teladan, maka simpulan silogisme yang paling sah adalah...', 'Semua peserta seleksi CAT kelak menjadi aparatur teladan', 'Sebagian peserta seleksi CAT kelak wajib menjunjung tinggi integritas moral', 'Hanya aparatur di kementerian yang berintegritas moral', 'Tidak ada hubungan antara seleksi CAT dan moral aparatur', 'Seluruh aparatur teladan dibebaskan dari seleksi', 'B', 5, 'Berdasarkan aturan silogisme kategoris parsial, jika semua aparatur wajib berintegritas dan sebagian peserta menjadi aparatur, maka sebagian peserta tersebut wajib berintegritas.'),
(1, 3, 'multiple_choice', 'Fitur utama sistem Computer Assisted Test (CAT) modern yang menjamin objektivitas dan transparansi hasil ujian adalah...', 'Pemeriksaan lembar jawaban secara manual setelah 3 hari', 'Pengacakan urutan nomor soal dan opsi jawaban secara dinamis serta kalkulasi nilai instan', 'Pemberian soal yang sama persis kepada seluruh peserta tanpa batasan waktu', 'Penyerahan kunci jawaban sebelum ujian dimulai', 'Penyimpanan hasil ujian di kertas memo pengawas', 'B', 5, 'Keunggulan utama CAT adalah keadilan terdistribusi lewat acak butir soal, acak opsi, dan realtime scoring yang akurat.'),
(1, 4, 'multiple_choice', 'Deret Pola Bilangan: 4, 9, 19, 39, 79, ... Suku berikutnya dari barisan bilangan tersebut adalah...', '149', '158', '159', '160', '169', 'C', 5, 'Pola deret: Un = (Un-1 * 2) + 1. Suku berikutnya: (79 * 2) + 1 = 158 + 1 = 159.'),
(1, 5, 'multiple_choice', 'Seorang warga lansia datang ke kantor pelayanan publik pada siang hari yang terik dan terlihat lelah mengantre. Sistem tiket digital sedang mengalami antrean panjang. Tindakan terbaik Anda selaku petugas front-office adalah...', 'Menyuruh warga lansia tersebut bersabar sesuai urutan tiket di layar', 'Meminta warga lain mengantrekan untuk beliau sementara Anda tetap duduk', 'Menyambut beliau dengan hormat, mengarahkan ke kursi prioritas lansia, serta memberikan layanan khusus loket prioritas sesuai SOP inklusif', 'Menolak melayani karena jam istirahat kantor telah mendekat', 'Menyarankan agar mengurus keperluannya lewat aplikasi online dari rumah saja', 'C', 5, 'Aspek Pelayanan Publik mengedepankan kepedulian tulus, proaktif, dan penerapan loket prioritas bagi kelompok rentan/lansia.'),
(1, 6, 'essay', '[STUDI KASUS 1 - INTEGRITAS DAN MANAJEMEN RISIKO] Dalam pelaksanaan tes CAT di sebuah daerah, terjadi fluktuasi tegangan listrik yang menyebabkan sebagian workstation peserta restart mendadak. Sebagai administrator ruangan, uraikan langkah operasional Anda untuk: (1) Menenangkan peserta, (2) Memverifikasi auto-save jawaban di server PostgreSQL, dan (3) Mekanisme penambahan waktu (extra time) bagi peserta terdampak.', NULL, NULL, NULL, NULL, NULL, 'Pedoman Penilaian: Menilai pemahaman SOP kegawatdaruratan, komunikasi persuasif, verifikasi data PostgreSQL, dan objektivitas penambahan waktu kompensasi.', 15, 'Penilaian rubrik: 5 poin manajemen emosi, 5 poin validasi database, 5 poin akurasi kebijakan kompensasi waktu.'),
(1, 7, 'essay', '[STUDI KASUS 2 - AKUNTABILITAS DIGITAL] Mengapa sistem seleksi aparatur menggunakan Computer Assisted Test (CAT) dinilai mampu memangkas praktik nepotisme dan calo seleksi secara drastis? Uraikan sedikitnya tiga faktor teknologis dan tata kelola yang membedakannya dengan ujian konvensional berbasis kertas (LJK).', NULL, NULL, NULL, NULL, NULL, 'Pedoman Penilaian: Menilai analisis mengenai keamanan database, live score monitor yang dapat disaksikan publik, dan rekam jejak digital (audit trail).', 15, 'Rubrik: 5 poin pencegahan manipulasi manual, 5 poin live score transparency, 5 poin efisiensi dan audit trail digital.');
