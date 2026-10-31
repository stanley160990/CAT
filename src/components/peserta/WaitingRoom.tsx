import React, { useState, useEffect } from 'react';
import { User, Exam, Room } from '../../types/cat.ts';
import { apiRequest } from '../../lib/api.ts';
import { Clock, RefreshCw, AlertTriangle, CheckCircle2, User as UserIcon, Building2, BookOpen, ShieldAlert, Play } from 'lucide-react';

interface WaitingRoomProps {
  user: User;
  onStartExam: () => void;
  onRefreshStatus?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ user, onStartExam }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [checking, setChecking] = useState(false);
  const [examStatus, setExamStatus] = useState<string>('draft');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setChecking(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<{
        success: boolean;
        exam: Exam;
        room: Room;
        user: any;
        error?: string;
      }>(`/api/exam/participant-status/${user.id}`);

      if (res.success) {
        setExam(res.exam);
        setRoom(res.room);
        setExamStatus(res.exam.status);

        // If exam is already finished by student
        if (res.user.examStatus === 'finished') {
          onStartExam();
        }
      } else {
        setErrorMessage(res.error || 'Gagal memuat status ujian');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server');
    } finally {
      setChecking(false);
    }
  };

  // Auto-polling status every 4 seconds to detect when Admin starts the exam
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [user.id]);

  const isExamReady = examStatus === 'ongoing';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-[#0f5132] bg-[#d1e7dd] px-3 py-1 rounded-full border border-[#badbcc]">
              Ruang Tunggu Seleksi CAT
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-2">
              {exam?.title || 'Memuat Jadwal Ujian...'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {exam?.description || 'Silakan membaca tata tertib dan menunggu hingga admin memulai ujian.'}
            </p>
          </div>

          <button
            onClick={fetchStatus}
            disabled={checking}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition shadow-sm self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-slate-600 ${checking ? 'animate-spin text-[#FF006E]' : ''}`} />
            <span>Periksa Status Ujian</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: Biodata Peserta & Status Ujian */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Kolom Biodata */}
        <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center">
            <UserIcon className="w-4 h-4 mr-2 text-[#FF006E]" /> Identitas Peserta
          </h2>

          <div>
            <span className="text-xs text-slate-400 block">Nomor Peserta (Username)</span>
            <span className="text-base font-extrabold text-slate-900 font-mono">{user.username}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Nama Lengkap</span>
            <span className="text-sm font-semibold text-slate-800">{user.name}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Ruangan Ujian</span>
            <div className="flex items-center text-sm font-semibold text-slate-800 mt-0.5">
              <Building2 className="w-4 h-4 mr-1 text-slate-500" />
              <span>{room?.name || 'Ruangan Belum Ditentukan'}</span>
            </div>
            {room?.location && (
              <span className="text-xs text-slate-500 block ml-5">{room.location}</span>
            )}
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Durasi Pengerjaan</span>
            <div className="flex items-center text-sm font-semibold text-slate-800 mt-0.5">
              <Clock className="w-4 h-4 mr-1 text-slate-500" />
              <span>{exam?.durationMinutes || 60} Menit</span>
              {user.extraTimeMinutes > 0 && (
                <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  +{user.extraTimeMinutes} Menit Tambahan
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Jenis Ujian</span>
            <span className="inline-block mt-1 text-xs font-bold uppercase px-2.5 py-1 rounded bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]">
              {exam?.examType === 'essay' ? 'Ujian Essay' : 'Ujian Pilihan Ganda'}
            </span>
          </div>
        </div>

        {/* Status Box & Tombol Mulai */}
        <div className="md:col-span-2 space-y-6">
          <div
            className={`rounded-2xl p-6 border shadow-sm transition-all ${
              isExamReady
                ? 'bg-[#d1e7dd]/40 border-[#badbcc]'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isExamReady
                    ? 'bg-[#FF006E] text-white shadow-lg shadow-[#FF006E]/30'
                    : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                }`}
              >
                {isExamReady ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6 animate-pulse" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isExamReady
                        ? 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]'
                        : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {isExamReady ? 'UJIAN TELAH DIMULAI' : 'MENUNGGU ADMIN UTAMA'}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-[#FF006E] animate-ping mr-1" />
                    Auto-Sync
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {isExamReady
                    ? 'Ujian telah dibuka secara serentak!'
                    : 'Ujian belum dimulai oleh Admin Pusat'}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {isExamReady
                    ? 'Waktu pengerjaan akan mulai dihitung mundur saat Anda mengklik tombol "Mulai Mengerjakan Ujian" di bawah ini. Pastikan Anda sudah siap.'
                    : 'Harap tetap berada di halaman ini. Halaman ini memperbarui status secara otomatis setiap beberapa detik, atau Anda dapat menekan tombol Refresh di atas.'}
                </p>

                {isExamReady ? (
                  <button
                    onClick={onStartExam}
                    className="mt-5 w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-lg shadow-[#FF006E]/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    <span>Mulai Mengerjakan Ujian Sekarang</span>
                  </button>
                ) : (
                  <div className="mt-4 p-3 bg-amber-100/60 rounded-xl text-xs text-amber-900 flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-700" />
                    <span>
                      Tombol pengerjaan akan otomatis aktif begitu Admin Pusat mengklik "Mulai Ujian".
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tata Tertib Ujian CAT */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center mb-3">
              <BookOpen className="w-4 h-4 mr-2 text-[#FF006E]" />
              Tata Tertib & Petunjuk Ujian Computer Assisted Test (CAT)
            </h2>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
              <li>
                <strong>Penyimpanan Otomatis:</strong> Setiap butir jawaban yang Anda pilih atau ketik langsung tersimpan permanen di database PostgreSQL secara otomatis.
              </li>
              <li>
                <strong>Pengacakan Soal:</strong> Urutan nomor soal dan opsi jawaban diacak secara sistematis untuk tiap peserta.
              </li>
              <li>
                <strong>Navigasi Soal:</strong> Gunakan nomor pada kisi soal (sebelah kanan) untuk melompat ke nomor tertentu. Tombol <em>Ragu-ragu</em> dapat digunakan sebagai penanda.
              </li>
              <li>
                <strong>Hitungan Mundur:</strong> Ujian akan selesai secara otomatis saat waktu hitungan mundur habis. Pastikan tidak ada soal yang terlewat.
              </li>
              <li>
                <strong>Kompensasi Waktu:</strong> Jika terjadi kendala perangkat atau jaringan di ruangan, operator ruangan berwenang memberikan penambahan waktu ujian.
              </li>
              <li>
                <strong>Integritas:</strong> Dilarang keras membuka tab baru, menyalin materi, atau berkomunikasi antar peserta selama ujian berlangsung.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
