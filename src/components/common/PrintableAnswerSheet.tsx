import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { X, Printer, Loader2, CheckCircle2, XCircle, FileText, User } from 'lucide-react';

interface PrintableAnswerSheetProps {
  userId: number;
  examId: number;
  onClose: () => void;
}

export const PrintableAnswerSheet: React.FC<PrintableAnswerSheetProps> = ({
  userId,
  examId,
  onClose,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSheet = async () => {
      try {
        setLoading(true);
        const res = await apiRequest(`/api/reports/participant-sheet/${userId}/${examId}`);
        if (res.success) {
          setData(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSheet();
  }, [userId, examId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 print:bg-white print:text-black">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Dokumen Resmi Ujian
            </span>
            <h2 className="text-lg sm:text-xl font-bold">
              Lembar Jawaban Peserta (CAT Answer Sheet)
            </h2>
          </div>

          <div className="flex items-center space-x-2 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 shadow transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              <span>Cetak / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Memuat rincian lembar jawaban peserta...</p>
            </div>
          ) : data ? (
            <>
              {/* Peserta & Ujian Header Info */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Nomor Peserta:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {data.user?.username}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Nama Peserta:</span>
                  <span className="font-bold text-slate-900">{data.user?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Ruangan:</span>
                  <span className="font-semibold text-slate-800">
                    {data.room?.name || 'Lab CBT'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Skor Akhir:</span>
                  <span className="font-mono font-black text-blue-700 text-base">
                    {data.result?.totalScore ?? '-'} Poin
                  </span>
                </div>
              </div>

              {/* List of Questions and Answers */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                  Rincian Jawaban Butir Soal ({data.sheetItems?.length || 0} Soal)
                </h3>

                {data.sheetItems?.map((item: any, idx: number) => {
                  const isEssay = item.type === 'essay';
                  return (
                    <div
                      key={item.questionId}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {isEssay ? 'Essay' : 'Pilihan Ganda'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-slate-900 font-mono">
                            Skor: {item.scoreEarned} / {item.points} Poin
                          </span>
                        </div>
                      </div>

                      {/* Question Content */}
                      <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap mb-3">
                        {item.content}
                      </p>

                      {/* Multiple Choice Answers */}
                      {!isEssay ? (
                        <div className="space-y-1.5 text-xs">
                          {['A', 'B', 'C', 'D', 'E'].map((optKey) => {
                            const optText = item.options[optKey];
                            if (!optText) return null;
                            const isChosen = item.studentSelected === optKey;
                            const isCorrect = item.correctAnswer === optKey;

                            let optClass = 'bg-slate-50 border-slate-200 text-slate-700';
                            if (isCorrect) {
                              optClass = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold';
                            }
                            if (isChosen && !isCorrect) {
                              optClass = 'bg-rose-50 border-rose-300 text-rose-900 font-semibold';
                            }

                            return (
                              <div
                                key={optKey}
                                className={`p-2 rounded-lg border flex items-center justify-between ${optClass}`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold w-4">{optKey}.</span>
                                  <span>{optText}</span>
                                </div>
                                <div className="flex items-center space-x-1.5 text-[11px]">
                                  {isChosen && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                                      Jawaban Peserta
                                    </span>
                                  )}
                                  {isCorrect && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                      Kunci Benar
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Essay Answer Review */
                        <div className="mt-2 space-y-2 text-xs">
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="font-bold text-slate-600 block mb-1">
                              Jawaban Essay Peserta:
                            </span>
                            <p className="text-slate-800 whitespace-pre-wrap italic">
                              {item.studentEssay || '(Peserta tidak mengisi jawaban essay)'}
                            </p>
                          </div>

                          {item.correctAnswer && (
                            <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200">
                              <span className="font-bold text-purple-900 block mb-1">
                                Pedoman Penilaian / Rubrik:
                              </span>
                              <p className="text-purple-800">{item.correctAnswer}</p>
                            </div>
                          )}

                          {item.essayFeedback && (
                            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                              <span className="font-bold block">Catatan Penguji / Korektor:</span>
                              <p>{item.essayFeedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-center text-slate-500 py-8">Gagal memuat data lembar jawaban.</p>
          )}
        </div>
      </div>
    </div>
  );
};
