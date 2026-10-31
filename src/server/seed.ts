import { db } from '../db/index.ts';
import { users, rooms, exams, questions, participantAnswers, examResults } from '../db/schema.ts';
import { hashPassword } from './crypto.ts';
import { sql } from 'drizzle-orm';

export async function checkAndAutoInitIfEmpty(force = false) {
  try {
    const userCountResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const count = Number(userCountResult[0]?.count ?? 0);

    if (count > 0 && !force) {
      console.log(`Database already has ${count} users. Skipping automatic seed.`);
      return { initialized: false, message: 'Database sudah memiliki data' };
    }

    if (force) {
      console.log('Force re-initialization requested. Cleaning existing records...');
      await db.delete(examResults);
      await db.delete(participantAnswers);
      await db.delete(questions);
      await db.delete(users);
      await db.delete(exams);
      await db.delete(rooms);
    }

    console.log('Seeding initial data for CAT system...');

    // 1. Create Rooms
    const [room1, room2] = await db.insert(rooms).values([
      {
        roomCode: 'LAB-01',
        name: 'Laboratorium CBT 01 (Utama)',
        capacity: 40,
        location: 'Gedung Rektorat Lt. 3, Sayap Barat',
        operatorName: 'Operator Ruang 01',
      },
      {
        roomCode: 'LAB-02',
        name: 'Laboratorium CBT 02 (Multimedia)',
        capacity: 35,
        location: 'Gedung TI Lt. 2, Sayap Timur',
        operatorName: 'Operator Ruang 02',
      },
    ]).returning();

    // 2. Create Exams
    const [examDemo] = await db.insert(exams).values([
      {
        title: 'Simulasi CAT Mandiri & Seleksi Kompetensi 2026',
        examType: 'mix', // Multiple choice + Essay
        description: 'Ujian simulasi terpadu berbasis CAT dengan kombinasi Soal Pilihan Ganda (TWK, TIU, TKP) dan Uji Penalaran Studi Kasus (Essay).',
        durationMinutes: 30,
        scoringCorrect: 5,
        scoringWrong: 0,
        scoringEmpty: 0,
        passingGrade: 65,
        randomizeQuestions: true,
        randomizeOptions: true,
        status: 'draft', // Admin starts it
      },
      {
        title: 'Ujian Khusus Pilihan Ganda - Pemahaman Umum',
        examType: 'multiple_choice',
        description: 'Ujian standar seluruhnya pilihan ganda dengan penilaian otomatis instan setelah selesai pengerjaan.',
        durationMinutes: 45,
        scoringCorrect: 4,
        scoringWrong: -1,
        scoringEmpty: 0,
        passingGrade: 70,
        randomizeQuestions: true,
        randomizeOptions: true,
        status: 'draft',
      }
    ]).returning();

    // 3. Create Users (Admin, Operators, Peserta)
    await db.insert(users).values([
      // Admin Keseluruhan
      {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        name: 'Administrator Utama (Pusat)',
        email: 'admin@cat-system.ac.id',
        role: 'admin',
      },
      // Operator Ruang 1
      {
        username: 'operator1',
        passwordHash: hashPassword('operator123'),
        name: 'Bambang Sudirman, S.Kom',
        email: 'operator1@cat-system.ac.id',
        role: 'operator',
        roomId: room1.id,
      },
      // Operator Ruang 2
      {
        username: 'operator2',
        passwordHash: hashPassword('operator123'),
        name: 'Ratna Kusuma, M.Kom',
        email: 'operator2@cat-system.ac.id',
        role: 'operator',
        roomId: room2.id,
      },
      // Peserta di Ruang 1
      {
        username: '2026001',
        passwordHash: hashPassword('peserta123'),
        name: 'Ahmad Fauzi Pratama',
        email: 'fauzi@example.com',
        role: 'peserta',
        roomId: room1.id,
        examId: examDemo.id,
        examStatus: 'registered',
      },
      {
        username: '2026002',
        passwordHash: hashPassword('peserta123'),
        name: 'Siti Nurhaliza Putri',
        email: 'siti@example.com',
        role: 'peserta',
        roomId: room1.id,
        examId: examDemo.id,
        examStatus: 'registered',
      },
      // Peserta di Ruang 2
      {
        username: '2026003',
        passwordHash: hashPassword('peserta123'),
        name: 'Budi Santoso Wibowo',
        email: 'budi@example.com',
        role: 'peserta',
        roomId: room2.id,
        examId: examDemo.id,
        examStatus: 'registered',
      },
      {
        username: '2026004',
        passwordHash: hashPassword('peserta123'),
        name: 'Dewi Ayu Lestari',
        email: 'dewi@example.com',
        role: 'peserta',
        roomId: room2.id,
        examId: examDemo.id,
        examStatus: 'registered',
      },
    ]);

    // 4. Create Questions for examDemo (Mix: Multiple Choice & Essay)
    await db.insert(questions).values([
      {
        examId: examDemo.id,
        questionOrder: 1,
        questionType: 'multiple_choice',
        content: 'Pancasila sebagai dasar negara Indonesia memiliki kedudukan sebagai sumber dari segala sumber hukum. Sila yang paling menekankan keadilan sosial bagi seluruh rakyat Indonesia tercermin pada lambang...',
        optionA: 'Bintang Tunggal',
        optionB: 'Rantai Emas',
        optionC: 'Pohon Beringin',
        optionD: 'Kepala Banteng',
        optionE: 'Padi dan Kapas',
        correctAnswer: 'E',
        points: 5,
        explanation: 'Padi dan Kapas melambangkan sandang dan pangan yang merupakan simbol kemakmuran dan keadilan sosial bagi seluruh rakyat Indonesia (Sila ke-5).',
      },
      {
        examId: examDemo.id,
        questionOrder: 2,
        questionType: 'multiple_choice',
        content: 'Jika semua pegawai negeri sipil bersikap profesional dan jujur, serta sebagian aparatur negara bertugas di daerah perbatasan, maka kesimpulan logis yang paling tepat adalah...',
        optionA: 'Semua yang bersikap profesional bertugas di daerah perbatasan',
        optionB: 'Sebagian aparatur negara yang bertugas di daerah perbatasan bersikap profesional dan jujur',
        optionC: 'Tidak ada pegawai di perbatasan yang bersikap jujur',
        optionD: 'Hanya sedikit pegawai negeri sipil yang bertugas di perkotaan',
        optionE: 'Seluruh aparatur di perbatasan wajib bersikap keras',
        correctAnswer: 'B',
        points: 5,
        explanation: 'Silogisme kategoris parsial: jika semua PNS profesional dan jujur, dan sebagian aparatur bertugas di perbatasan, maka sebagian yang bertugas di perbatasan tersebut bersikap profesional dan jujur.',
      },
      {
        examId: examDemo.id,
        questionOrder: 3,
        questionType: 'multiple_choice',
        content: 'Dalam sistem Computer Assisted Test (CAT), integritas data ujian dijaga melalui beberapa mekanisme. Manakah di bawah ini yang paling efektif untuk mencegah kecurangan saling bertukar jawaban antar peserta yang bersebelahan?',
        optionA: 'Mengurangi jumlah total soal ujian',
        optionB: 'Mengacak urutan nomor soal dan mengacak pilihan jawaban (A-E) untuk tiap peserta',
        optionC: 'Mempercepat hitungan mundur timer ujian',
        optionD: 'Mengganti seluruh monitor komputer menjadi warna monokrom',
        optionE: 'Mengharuskan peserta membawa catatan sendiri',
        correctAnswer: 'B',
        points: 5,
        explanation: 'Pengacakan urutan soal (randomize questions) dan pengacakan urutan opsi jawaban (randomize choices) adalah standar CAT modern.',
      },
      {
        examId: examDemo.id,
        questionOrder: 4,
        questionType: 'multiple_choice',
        content: 'Deret angka: 3, 7, 15, 31, 63, ... Angka berikutnya pada deret tersebut adalah...',
        optionA: '120',
        optionB: '125',
        optionC: '127',
        optionD: '128',
        optionE: '131',
        correctAnswer: 'C',
        points: 5,
        explanation: 'Pola: (n * 2) + 1. 3*2+1=7, 7*2+1=15, 15*2+1=31, 31*2+1=63, 63*2+1 = 127.',
      },
      {
        examId: examDemo.id,
        questionOrder: 5,
        questionType: 'multiple_choice',
        content: 'Saat Anda sedang melayani masyarakat di loket pelayanan publik, datang seorang warga lansia yang tampak kebingungan dengan sistem antrean elektronik. Sikap terbaik Anda adalah...',
        optionA: 'Menyuruh warga lain untuk membantunya agar antrean Anda tidak terganggu',
        optionB: 'Meminta satpam untuk memandu keluar dari ruangan',
        optionC: 'Menyapa dengan ramah, memandu langsung penggunaan sistem antrean, dan memberikan bantuan prioritas sesuai SOP',
        optionD: 'Mengabaikan karena sudah ada pengeras suara panduan',
        optionE: 'Meminta beliau pulang dan meminta anaknya yang datang',
        correctAnswer: 'C',
        points: 5,
        explanation: 'Aspek Pelayanan Publik TKP mengedepankan empati, kesigapan, keramahan, dan perlindungan bagi kelompok rentan/prioritas.',
      },
      {
        examId: examDemo.id,
        questionOrder: 6,
        questionType: 'essay',
        content: '[SOAL ESSAY 1] Jelaskan langkah konkret yang akan Anda lakukan jika dalam pelaksanaan tes CAT terjadi gangguan teknis seperti pemadaman listrik darurat atau pemutusan jaringan lokal di ruangan Anda. Bagaimana Anda menenangkan peserta dan memastikan data jawaban yang telah tersimpan tidak hilang?',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        optionE: null,
        correctAnswer: 'Pedoman Penilaian: Menjelaskan SOP penanganan listrik/jaringan, auto-save database per butir soal, penambahan waktu kompensasi oleh operator ruangan, dan koordinasi dengan panitia pusat.',
        points: 15,
        explanation: 'Penilaian didasarkan pada pemahaman manajemen krisis, integritas data, dan ketenangan psikologis.',
      },
      {
        examId: examDemo.id,
        questionOrder: 7,
        questionType: 'essay',
        content: '[SOAL ESSAY 2] Bagaimana pandangan Anda mengenai penerapan transformasi digital dan transparansi nilai secara realtime pada seleksi pegawai berbasis Computer Assisted Test dibandingkan metode lembar jawaban komputer (LJK) konvensional?',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        optionE: null,
        correctAnswer: 'Pedoman Penilaian: Menyoroti aspek kecepatan, akurasi, pencegahan manipulasi manual, transparansi akuntabilitas publik, dan efisiensi anggaran.',
        points: 15,
        explanation: 'Penilaian menekankan wawasan teknologi informasi dan tata kelola pemerintahan yang bersih (good governance).',
      },
    ]);

    // Also seed questions for second exam (Multiple choice pure)
    const secondExam = (await db.select().from(exams))[1];
    if (secondExam) {
      await db.insert(questions).values([
        {
          examId: secondExam.id,
          questionOrder: 1,
          questionType: 'multiple_choice',
          content: 'Ibukota Nusantara (IKN) berlokasi di provinsi...',
          optionA: 'Kalimantan Selatan',
          optionB: 'Kalimantan Timur',
          optionC: 'Kalimantan Barat',
          optionD: 'Kalimantan Tengah',
          optionE: 'Kalimantan Utara',
          correctAnswer: 'B',
          points: 10,
          explanation: 'IKN berada di wilayah Kabupaten Penajam Paser Utara dan Kutai Kartanegara, Kalimantan Timur.',
        },
        {
          examId: secondExam.id,
          questionOrder: 2,
          questionType: 'multiple_choice',
          content: 'Protokol internet yang digunakan untuk mengamankan komunikasi data terenkripsi di web browser adalah...',
          optionA: 'HTTP',
          optionB: 'FTP',
          optionC: 'HTTPS',
          optionD: 'SMTP',
          optionE: 'Telnet',
          correctAnswer: 'C',
          points: 10,
          explanation: 'HTTPS (Hypertext Transfer Protocol Secure) menggunakan TLS/SSL untuk enkripsi.',
        },
      ]);
    }

    console.log('Seeding completed successfully!');
    return { initialized: true, message: 'Inisialisasi data berhasil diselesaikan.' };
  } catch (error) {
    console.error('Error during database seed:', error);
    throw error;
  }
}
