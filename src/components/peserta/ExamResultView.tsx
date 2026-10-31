import React from 'react';
import { User, Exam, ExamResult } from '../../types/cat.ts';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Printer,
  FileText,
  UserCheck,
  Building2,
  LogOut,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ExamResultViewProps {
  user: User;
  exam: Exam;
  result: ExamResult;
  onLogout: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({ user, exam, result, onLogout }) => {
  const isPassed = result.isPassed;
  const isEssay = exam.examType === 'essay';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Printable Certificate Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        {/* Banner Status */}
        <div
          className={`py-8 px-6 text-center text-white relative ${
            isPassed
              ? 'bg-[#0f5132]'
              : 'bg-slate-900'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md mx-auto flex items-center justify-center border border-white/20 mb-3 shadow-inner">
            <Award className="w-8 h-8 text-[#d1e7dd]" />
          </div>

          <span className="text-xs uppercase font-extrabold tracking-widest text-[#d1e7dd] bg-black/20 px-3.5 py-1 rounded-full border border-white/10">
            HASIL RESMI COMPUTER ASSISTED TEST (CAT)
          </span>

          <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
            {isPassed ? 'SELAMAT, ANDA MEMENUHI AMBANG BATAS!' : 'UJIAN CAT TELAH SELESAI'}
          </h1>
          <p className="text-sm text-slate-200 mt-1 max-w-lg mx-auto">
            Seluruh data lembar jawaban telah dikalkulasi dan tersimpan secara permanen pada database PostgreSQL.
          </p>
        </div>

        {/* Hero Score Showcase */}
        <div className="p-6 sm:p-8 bg-[#d1e7dd]/30 border-b border-[#badbcc]/60 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Total Perolehan Nilai CAT
          </span>

          <div className="my-2 flex items-baseline justify-center space-x-2">
            <span
              className={`text-6xl font-black tracking-tight ${
                isPassed ? 'text-[#0f5132]' : 'text-slate-900'
              }`}
            >
              {result.totalScore}
            </span>
            <span className="text-slate-500 text-sm font-semibold">/ Nilai KKM: {exam.passingGrade}</span>
          </div>

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-1">
            {isPassed ? (
              <span className="text-[#0f5132] bg-[#d1e7dd] border border-[#badbcc] px-3.5 py-1 rounded-full flex items-center shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#0f5132]" /> MEMENUHI PASSING GRADE (LULUS)
              </span>
            ) : (
              <span className="text-amber-900 bg-amber-100 border border-amber-300 px-3.5 py-1 rounded-full flex items-center shadow-sm">
                BELUM MEMENUHI PASSING GRADE
              </span>
            )}
          </div>
        </div>

        {/* Detail Breakdown */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Identitas Peserta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs">
            <div>
              <span className="text-slate-400 block">Nomor Peserta:</span>
              <span className="font-extrabold text-slate-900 font-mono text-sm">{user.username}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Nama Peserta:</span>
              <span className="font-bold text-slate-900 text-sm">{user.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Ruangan:</span>
              <span className="font-semibold text-slate-800">{user.room?.name || 'Lab CBT'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Waktu Selesai:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {result.submittedAt ? new Date(result.submittedAt).toLocaleTimeString('id-ID') : '-'} WIB
              </span>
            </div>
          </div>

          {/* Rincian Jawaban & Skor */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-1.5 text-[#FF006E]" /> Rincian Lembar Jawaban & Komponen Nilai
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Soal</span>
                <span className="text-xl font-extrabold text-slate-900">{result.totalQuestions}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#d1e7dd]/60 border border-[#badbcc]">
                <span className="text-[11px] font-bold text-[#0f5132] uppercase block">Jawaban Benar</span>
                <span className="text-xl font-extrabold text-[#0f5132]">{result.correctCount}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[11px] font-bold text-rose-700 uppercase block">Jawaban Salah</span>
                <span className="text-xl font-extrabold text-rose-700">{result.wrongCount}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Kosong / Blank</span>
                <span className="text-xl font-extrabold text-slate-600">{result.emptyCount}</span>
              </div>
            </div>

            {/* Breakdown Per Nilai */}
            <div className="mt-4 p-4 rounded-xl bg-[#d1e7dd]/40 border border-[#badbcc] space-y-2 text-xs">
              {!isEssay && (
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Skor Pilihan Ganda (Otomatis Dihitung Instan):</span>
                  <span className="font-mono text-[#0f5132] font-extrabold text-sm">{result.mcqScore} Poin</span>
                </div>
              )}

              {isEssay && (
                <div className="flex justify-between font-semibold text-slate-800">
                  <div>
                    <span>Skor Ujian Essay / Penalaran Kasus:</span>
                    <span className="text-[10px] text-slate-500 block">
                      (Penilaian rubrik koreksi oleh Operator / Penguji)
                    </span>
                  </div>
                  <span className="font-mono text-[#FF006E] font-extrabold text-sm">
                    {result.essayScore > 0 ? `${result.essayScore} Poin` : 'Menunggu Koreksi'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-2 text-slate-600" />
              <span>Cetak Bukti Hasil Ujian (PDF)</span>
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-md shadow-[#FF006E]/20 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Keluar ke Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
