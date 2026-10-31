import Papa from 'papaparse';

/**
 * Trigger browser file download from CSV text
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate CSV template for Bulk Upload Peserta
 */
export function downloadParticipantTemplate() {
  const headers = ['nomor_peserta', 'nama_lengkap', 'password', 'email', 'room_id', 'exam_id'];
  const sampleRows = [
    ['2026005', 'Hendra Wijaya', 'peserta123', 'hendra@example.com', '1', '1'],
    ['2026006', 'Maya Anggraini', 'peserta123', 'maya@example.com', '1', '1'],
    ['2026007', 'Denny Gunawan', 'peserta123', 'denny@example.com', '2', '1'],
  ];

  const csv = Papa.unparse({
    fields: headers,
    data: sampleRows,
  });

  downloadCSV('template_upload_peserta_cat.csv', csv);
}

/**
 * Generate CSV template for Bulk Upload Operator Ruangan
 */
export function downloadOperatorTemplate() {
  const headers = ['username', 'nama_lengkap', 'password', 'email', 'room_id'];
  const sampleRows = [
    ['operator3', 'Hendra Setiawan, S.T', 'operator123', 'hendra@cat-system.id', '1'],
    ['operator4', 'Dewi Sartika, S.Pd', 'operator123', 'dewi@cat-system.id', '2'],
  ];

  const csv = Papa.unparse({
    fields: headers,
    data: sampleRows,
  });

  downloadCSV('template_upload_operator_cat.csv', csv);
}

/**
 * Generate CSV template for Bulk Upload Soal (Multiple Choice atau Essay)
 */
export function downloadQuestionTemplate() {
  const headers = [
    'nama_bank_soal',
    'soal',
    'jenis', // 'multiple_choice' atau 'essay'
    'pilihan_a',
    'pilihan_b',
    'pilihan_c',
    'pilihan_d',
    'pilihan_e',
    'kunci', // A/B/C/D/E untuk PG, atau pedoman nilai untuk essay
    'bobot',
    'pembahasan',
  ];

  const sampleRows = [
    [
      'Bank Soal SKD TWK',
      'Lambang negara Garuda Pancasila dengan semboyan Bhinneka Tunggal Ika diatur dalam UUD 1945 pasal...',
      'multiple_choice',
      'Pasal 36A',
      'Pasal 36B',
      'Pasal 36C',
      'Pasal 37',
      'Pasal 35',
      'A',
      '5',
      'Pasal 36A UUD 1945 menegaskan: Lambang Negara ialah Garuda Pancasila dengan semboyan Bhinneka Tunggal Ika.',
    ],
    [
      'Bank Soal Esai Kepemimpinan',
      '[SOAL ESSAY] Jelaskan strategi Anda dalam mengoptimalkan kolaborasi antar anggota tim yang memiliki perbedaan latar belakang generasi dan budaya!',
      'essay',
      '',
      '',
      '',
      '',
      '',
      'Pedoman: Menilai komunikasi asertif, inklusivitas, saling menghargai perspektif, dan orientasi pada target bersama.',
      '15',
      'Kriteria penilaian berfokus pada kepemimpinan inklusif dan resolusi konflik.',
    ],
  ];

  const csv = Papa.unparse({
    fields: headers,
    data: sampleRows,
  });

  downloadCSV('template_upload_soal_cat.csv', csv);
}

/**
 * Parse CSV file into JSON rows
 */
export function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
