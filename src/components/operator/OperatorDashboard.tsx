import React, { useState, useEffect } from 'react';
import { User, Room } from '../../types/cat.ts';
import { apiRequest } from '../../lib/api.ts';
import { downloadCSV } from '../../lib/csvHelper.ts';
import { PrintableAnswerSheet } from '../common/PrintableAnswerSheet.tsx';
import {
  Monitor,
  Users,
  Clock,
  PlusCircle,
  RotateCcw,
  Edit,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  X,
  Loader2,
} from 'lucide-react';

interface OperatorDashboardProps {
  currentUser: User;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({ currentUser }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForSheet, setSelectedUserForSheet] = useState<{
    userId: number;
    examId: number;
  } | null>(null);

  // Extra Time Modal State
  const [extraTimeUser, setExtraTimeUser] = useState<any | null>(null);
  const [minutesToAdd, setMinutesToAdd] = useState(5);
  const [extraTimeLoading, setExtraTimeLoading] = useState(false);

  // Edit Participant Modal State
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Reset Status Modal State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [activeRoomId, setActiveRoomId] = useState<number | null>(currentUser.roomId || null);
  const [myRooms, setMyRooms] = useState<any[]>([]);

  // Fetch all assigned rooms for this operator
  useEffect(() => {
    const fetchAssignedRooms = async () => {
      try {
        const res = await apiRequest(`/api/operator/my-rooms/${currentUser.id}`);
        if (res.success && res.assignments) {
          setMyRooms(res.assignments);
          if (!activeRoomId && res.assignments.length > 0) {
            setActiveRoomId(res.assignments[0].roomId);
          }
        }
      } catch (err) {
        console.error('Failed fetching operator rooms:', err);
      }
    };
    fetchAssignedRooms();
  }, [currentUser.id]);

  const fetchRoomData = async () => {
    const targetRoomId = activeRoomId || currentUser.roomId;
    if (!targetRoomId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest(`/api/operator/room-monitoring/${targetRoomId}`);
      if (res.success) {
        setRoom(res.room);
        setParticipants(res.participants || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomData();
    const interval = setInterval(fetchRoomData, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, [activeRoomId, currentUser.roomId]);

  // Handle Add Extra Time
  const handleSaveExtraTime = async () => {
    if (!extraTimeUser) return;
    setExtraTimeLoading(true);
    try {
      await apiRequest(`/api/participants/${extraTimeUser.id}/extra-time`, {
        method: 'POST',
        body: JSON.stringify({ minutes: Number(minutesToAdd) }),
      });
      setExtraTimeUser(null);
      await fetchRoomData();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan waktu.');
    } finally {
      setExtraTimeLoading(false);
    }
  };

  // Handle Edit Participant
  const handleSaveEditUser = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      await apiRequest(`/api/participants/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          username: editUsername.trim(),
          password: editPassword ? editPassword : undefined,
        }),
      });
      setEditUser(null);
      await fetchRoomData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data peserta.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Reset Participant Status
  const handleConfirmReset = async (status: string, resetTimer: boolean) => {
    if (!resetTargetUser) return;
    setResetLoading(true);
    try {
      await apiRequest(`/api/participants/${resetTargetUser.id}/reset-status`, {
        method: 'POST',
        body: JSON.stringify({ status, resetTime: resetTimer }),
      });
      setResetTargetUser(null);
      await fetchRoomData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengatur ulang status.');
    } finally {
      setResetLoading(false);
    }
  };

  // Export Room Results to CSV
  const exportRoomResultsCSV = () => {
    if (!participants.length) return;
    const headers = [
      'nomor_peserta',
      'nama_lengkap',
      'ruangan',
      'status_ujian',
      'soal_terjawab',
      'skor_akhir',
      'status_kelulusan',
      'waktu_tambahan_menit',
    ];

    const rows = participants.map((p) => [
      p.username,
      `"${p.name}"`,
      room?.name || 'Ruang CBT',
      p.examStatus,
      p.answered ?? 0,
      p.score ?? '-',
      p.isPassed !== null ? (p.isPassed ? 'LULUS' : 'TIDAK LULUS') : 'BELUM SELESAI',
      p.extraTimeMinutes || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`hasil_ujian_${room?.roomCode || 'ruangan'}.csv`, csvContent);
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const testingCount = participants.filter((p) => p.examStatus === 'testing').length;
  const finishedCount = participants.filter((p) => p.examStatus === 'finished').length;
  const readyCount = participants.filter(
    (p) => p.examStatus === 'registered' || p.examStatus === 'ready'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Room Header Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#FF006E] flex items-center justify-center text-white shadow-md shadow-[#FF006E]/20 flex-shrink-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0f5132] bg-[#d1e7dd] px-2.5 py-0.5 rounded border border-[#badbcc]">
                Panel Admin Ruangan (Operator)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Kode: {room?.roomCode || 'LAB-01'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              {room?.name || 'Monitoring Ruang CBT'}
            </h1>
            <p className="text-xs text-slate-500">
              Lokasi: {room?.location || '-'} &bull; Kapasitas: {room?.capacity || 30} Kursi &bull;
              Petugas: {room?.operatorName || currentUser.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {myRooms.length > 1 && (
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Ruangan Tanggung Jawab:</span>
              <select
                value={activeRoomId || ''}
                onChange={(e) => setActiveRoomId(Number(e.target.value))}
                className="text-xs font-bold bg-white p-1 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#FF006E]"
              >
                {myRooms.map((mr) => (
                  <option key={mr.roomId} value={mr.roomId}>
                    {mr.roomName} ({mr.roomCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchRoomData}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Perbarui Data</span>
          </button>

          <button
            onClick={exportRoomResultsCSV}
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm shadow-[#FF006E]/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            <span>Unduh Hasil Ujian (CSV)</span>
          </button>
        </div>
      </div>

      {!activeRoomId && myRooms.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold block">Belum Dialokasikan ke Ruangan Ujian:</span>
            <p>Akun operator ini belum ditetapkan sebagai penanggung jawab ruangan pada jadwal ujian. Administrator dapat mengalokasikan operator bersamaan dengan pemilihan ruangan di menu Manajemen Ujian.</p>
          </div>
        </div>
      )}

      {/* Quick Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Total Peserta Ruangan
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{participants.length}</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">
            Sedang Mengerjakan
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black text-blue-600">{testingCount}</span>
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block">
            Selesai Ujian
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{finishedCount}</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Belum Masuk / Siap
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-700">{readyCount}</span>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Peserta Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center">
            <Users className="w-4 h-4 mr-2 text-emerald-600" />
            Daftar Peserta di Ruangan ({filteredParticipants.length})
          </h2>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama atau nomor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">No. Peserta</th>
                <th className="py-3 px-4">Nama Peserta</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progres Soal</th>
                <th className="py-3 px-4">Sisa Waktu</th>
                <th className="py-3 px-4">Nilai CAT</th>
                <th className="py-3 px-4 text-center">Aksi Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada peserta di ruangan ini.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.username}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {p.name}
                        {p.extraTimeMinutes > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            +{p.extraTimeMinutes}m
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.examStatus === 'testing' && (
                          <span className="inline-flex items-center text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1" />
                            Sedang Mengerjakan
                          </span>
                        )}
                        {p.examStatus === 'finished' && (
                          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            <Check className="w-3 h-3 mr-1" /> Selesai
                          </span>
                        )}
                        {(p.examStatus === 'registered' || p.examStatus === 'ready') && (
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                            Siap / Menunggu
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {p.answered} Soal Terjawab
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-800">
                        {p.secondsLeft !== null ? (
                          <span
                            className={
                              p.secondsLeft < 300
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-700 font-semibold'
                            }
                          >
                            {Math.floor(p.secondsLeft / 60)}m {p.secondsLeft % 60}s
                          </span>
                        ) : p.examStatus === 'finished' ? (
                          <span className="text-slate-400">Waktu Berakhir</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-sm">
                        {p.score !== null ? (
                          <span
                            className={
                              p.isPassed ? 'text-emerald-700' : 'text-amber-800'
                            }
                          >
                            {p.score} Poin
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Add Extra Time Button */}
                          <button
                            onClick={() => {
                              setExtraTimeUser(p);
                              setMinutesToAdd(5);
                            }}
                            title="Tambah Waktu Ujian (Kompensasi Gangguan/Telat)"
                            className="p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Participant Button */}
                          <button
                            onClick={() => {
                              setEditUser(p);
                              setEditName(p.name);
                              setEditUsername(p.username);
                              setEditPassword('');
                            }}
                            title="Edit Data Peserta / Ganti Kata Sandi"
                            className="p-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Login Session */}
                          <button
                            onClick={() => setResetTargetUser(p)}
                            title="Reset Sesi Login (Jika PC Error/Crash)"
                            className="p-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* View Lembar Jawaban */}
                          {p.examId && (
                            <button
                              onClick={() =>
                                setSelectedUserForSheet({
                                  userId: p.id,
                                  examId: p.examId,
                                })
                              }
                              title="Lihat & Cetak Lembar Jawaban Peserta"
                              className="p-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Penambahan Waktu Ujian */}
      {extraTimeUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Penambahan Waktu Ujian (Kompensasi)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tambahkan kompensasi waktu untuk peserta:{' '}
              <strong className="text-slate-800">{extraTimeUser.name}</strong> ({extraTimeUser.username}).
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Pilih Durasi Penambahan Waktu (Menit):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutesToAdd(m)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      minutesToAdd === m
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    +{m} mnt
                  </button>
                ))}
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Atau masukkan manual:</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={minutesToAdd}
                  onChange={(e) => setMinutesToAdd(Number(e.target.value))}
                  className="mt-1 w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono"
                />
              </div>

              <p className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Waktu pengerjaan peserta akan langsung bertambah dan diperbarui seketika di layar ujian mereka.
              </p>
            </div>

            <div className="mt-6 flex space-x-2">
              <button
                type="button"
                onClick={() => setExtraTimeUser(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={extraTimeLoading}
                onClick={handleSaveExtraTime}
                className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow transition cursor-pointer flex items-center justify-center"
              >
                {extraTimeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Simpan Penambahan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Detail Peserta */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Edit Detail Peserta</h3>
            <p className="text-xs text-slate-500 mt-1">
              Perbarui identitas atau ganti kata sandi login peserta.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Peserta (Username):
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ganti Password (Kosongkan jika tidak diubah):
                </label>
                <input
                  type="password"
                  placeholder="Password baru (akan di-hash SHA-1)..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editLoading}
                onClick={handleSaveEditUser}
                className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition cursor-pointer flex items-center justify-center"
              >
                {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Status Sesi */}
      {resetTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Atur Ulang Status Peserta</h3>
            <p className="text-xs text-slate-600 mt-1">
              Gunakan fitur ini jika komputer peserta mendadak mati atau mengalami error koneksi
              agar peserta dapat melanjutkan ujian.
            </p>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={resetLoading}
                onClick={() => handleConfirmReset('ready', false)}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-xs font-bold text-left transition cursor-pointer flex items-center justify-between"
              >
                <span>Buka Kunci (Lanjutkan Ujian dengan Jawaban Tersimpan)</span>
                <Check className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={resetLoading}
                onClick={() => handleConfirmReset('registered', true)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-left transition cursor-pointer flex items-center justify-between"
              >
                <span>Kembalikan ke Status Awal (Reset Total Waktu)</span>
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Answer Sheet Modal */}
      {selectedUserForSheet && (
        <PrintableAnswerSheet
          userId={selectedUserForSheet.userId}
          examId={selectedUserForSheet.examId}
          onClose={() => setSelectedUserForSheet(null)}
        />
      )}
    </div>
  );
};
