import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, Question, ParticipantAnswer, ExamResult } from '../../types/cat.ts';
import { apiRequest } from '../../lib/api.ts';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle,
  AlertCircle,
  Database,
  HelpCircle,
  Send,
  Loader2,
  BookmarkCheck,
  Check,
} from 'lucide-react';

interface ExamSheetProps {
  user: User;
  onFinishExam: (result: ExamResult, exam: Exam) => void;
}

export const ExamSheet: React.FC<ExamSheetProps> = ({ user, onFinishExam }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<number, ParticipantAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [extraTimeMinutes, setExtraTimeMinutes] = useState<number>(user.extraTimeMinutes || 0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounce ref for essay typing
  const essayDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Start attempt, load questions and existing answers
  useEffect(() => {
    const initializeExam = async () => {
      try {
        setLoading(true);

        // A. Confirm start-attempt
        await apiRequest('/api/exam/start-attempt', {
          method: 'POST',
          body: JSON.stringify({ userId: user.id }),
        });

        // B. Get participant status & initial time
        const statusRes = await apiRequest<{
          success: boolean;
          exam: Exam;
          user: User;
          secondsLeft: number;
          result?: ExamResult;
        }>(`/api/exam/participant-status/${user.id}`);

        if (statusRes.success) {
          setExam(statusRes.exam);
          setSecondsRemaining(statusRes.secondsLeft);
          setExtraTimeMinutes(statusRes.user.extraTimeMinutes || 0);

          // If already finished
          if (statusRes.user.examStatus === 'finished' && statusRes.result) {
            onFinishExam(statusRes.result, statusRes.exam);
            return;
          }
        }

        // C. Fetch questions prepared for student
        const qRes = await apiRequest<{ success: boolean; questions: Question[] }>(
          `/api/exam/questions-for-student/${user.id}`
        );

        if (qRes.success) {
          setQuestions(qRes.questions);
        }

        // D. Fetch existing saved answers
        if (statusRes.exam?.id) {
          const ansRes = await apiRequest<{ success: boolean; answers: ParticipantAnswer[] }>(
            `/api/exam/my-answers/${user.id}/${statusRes.exam.id}`
          );
          if (ansRes.success && Array.isArray(ansRes.answers)) {
            const map: Record<number, ParticipantAnswer> = {};
            ansRes.answers.forEach((ans) => {
              map[ans.questionId] = ans;
            });
            setAnswersMap(map);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal memuat lembar ujian');
      } finally {
        setLoading(false);
      }
    };

    initializeExam();
  }, [user.id]);

  // 2. Countdown Timer
  useEffect(() => {
    if (loading || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, secondsRemaining]);

  // 3. Periodic Background Sync (every 15s) to check extra time granted by operator
  useEffect(() => {
    const syncStatus = async () => {
      try {
        const res = await apiRequest<{
          success: boolean;
          user: User;
          exam: Exam;
          secondsLeft: number;
        }>(`/api/exam/participant-status/${user.id}`);

        if (res.success) {
          if (res.user.extraTimeMinutes !== extraTimeMinutes) {
            setExtraTimeMinutes(res.user.extraTimeMinutes);
            // Adjust timer with new remaining seconds
            setSecondsRemaining(res.secondsLeft);
          }
          if (res.exam.status === 'completed') {
            // Exam ended by Admin
            handleAutoSubmit();
          }
        }
      } catch (e) {
        // Silent background sync
      }
    };

    const syncInterval = setInterval(syncStatus, 15000);
    return () => clearInterval(syncInterval);
  }, [user.id, extraTimeMinutes]);

  // Save answer to PostgreSQL
  const saveAnswerToDb = async (
    qId: number,
    patch: Partial<ParticipantAnswer>
  ) => {
    if (!exam) return;
    setSavingState('saving');

    const currentAnswer = answersMap[qId] || {
      userId: user.id,
      examId: exam.id,
      questionId: qId,
      isDoubtful: false,
    };

    const updatedAnswer = {
      ...currentAnswer,
      ...patch,
      userId: user.id,
      examId: exam.id,
      questionId: qId,
    };

    // Update local state immediately for fast response
    setAnswersMap((prev) => ({
      ...prev,
      [qId]: updatedAnswer,
    }));

    try {
      await apiRequest('/api/exam/save-answer', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          examId: exam.id,
          questionId: qId,
          selectedOption: updatedAnswer.selectedOption,
          essayAnswer: updatedAnswer.essayAnswer,
          isDoubtful: updatedAnswer.isDoubtful,
        }),
      });
      setSavingState('saved');
    } catch (err) {
      console.error('Failed to auto-save answer:', err);
      setSavingState('error');
    }
  };

  // Multiple Choice Option Click
  const handleSelectOption = (qId: number, originalKey: string) => {
    saveAnswerToDb(qId, { selectedOption: originalKey });
  };

  // Essay Textarea Change (with debounce)
  const handleEssayChange = (qId: number, text: string) => {
    // Update local immediately
    setAnswersMap((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || { userId: user.id, examId: exam!.id, questionId: qId, isDoubtful: false }),
        essayAnswer: text,
      },
    }));
    setSavingState('saving');

    if (essayDebounceTimer.current) {
      clearTimeout(essayDebounceTimer.current);
    }

    essayDebounceTimer.current = setTimeout(() => {
      saveAnswerToDb(qId, { essayAnswer: text });
    }, 700);
  };

  // Toggle Ragu-Ragu
  const handleToggleDoubtful = (qId: number) => {
    const current = answersMap[qId]?.isDoubtful ?? false;
    saveAnswerToDb(qId, { isDoubtful: !current });
  };

  // Submit Exam handler
  const executeSubmit = async () => {
    if (!exam || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        result: ExamResult;
        exam: Exam;
        error?: string;
      }>('/api/exam/finish', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          examId: exam.id,
        }),
      });

      if (res.success && res.result) {
        onFinishExam(res.result, res.exam);
      } else {
        alert(res.error || 'Gagal mengirimkan ujian. Silakan coba kembali.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat submit.');
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const handleAutoSubmit = () => {
    executeSubmit();
  };

  // Time formatter HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-700">Menyiapkan Lembar Soal Ujian CAT...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Belum Ada Soal Pada Ujian Ini</h2>
        <p className="text-sm text-slate-600 mt-1">
          Admin belum mengunggah butir soal untuk jadwal ujian ini.
        </p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAns = answersMap[currentQ.id];

  // Answer statistics
  const answeredCount = questions.filter((q) => {
    const a = answersMap[q.id];
    if (q.questionType === 'multiple_choice') return Boolean(a?.selectedOption);
    return Boolean(a?.essayAnswer && a.essayAnswer.trim() !== '');
  }).length;

  const doubtfulCount = questions.filter((q) => answersMap[q.id]?.isDoubtful).length;
  const unansweredCount = questions.length - answeredCount;

  // Warning colors for timer
  const isUrgent = secondsRemaining < 300; // < 5 mins
  const isCritical = secondsRemaining < 60; // < 1 min

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 pb-12">
      {/* Top Test Navigation Bar */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-3 sm:p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#d1e7dd] bg-[#0f5132]/60 px-2.5 py-0.5 rounded border border-[#0f5132]">
            {exam?.title}
          </span>
          <div className="flex items-center space-x-3 text-xs text-slate-300 mt-1">
            <span>
              Peserta: <strong className="text-white">{user.name}</strong> ({user.username})
            </span>
            <span>&bull;</span>
            <span>
              Ruangan: <strong className="text-white">{user.room?.name || 'Lab CBT'}</strong>
            </span>
          </div>
        </div>

        {/* Realtime Countdown Timer Card */}
        <div className="flex items-center space-x-3">
          {extraTimeMinutes > 0 && (
            <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-800 animate-pulse">
              +{extraTimeMinutes} Menit Kompensasi
            </span>
          )}

          <div
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-mono text-lg font-black tracking-wider shadow-inner ${
              isCritical
                ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/50'
                : isUrgent
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-[#d1e7dd] border border-slate-700'
            }`}
          >
            <Clock className="w-5 h-5 flex-shrink-0 text-[#FF006E]" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Question Workspace, Right is Question Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Kolom Soal (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 relative min-h-[460px] flex flex-col justify-between">
            {/* Header Soal */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm sm:text-base font-extrabold text-slate-900">
                    Soal Nomor {currentIndex + 1}
                  </span>
                  <span className="text-xs text-slate-400">dari {questions.length}</span>

                  <span
                    className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      currentQ.questionType === 'essay'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]'
                    }`}
                  >
                    {currentQ.questionType === 'essay' ? 'Soal Essay' : 'Pilihan Ganda'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 font-semibold rounded-md">
                    Bobot: {currentQ.points} Poin
                  </span>

                  {/* Auto-Save Indicator */}
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Database className="w-3.5 h-3.5" />
                    {savingState === 'saving' && (
                      <span className="text-amber-600 font-medium flex items-center">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Menyimpan...
                      </span>
                    )}
                    {savingState === 'saved' && (
                      <span className="text-[#0f5132] bg-[#d1e7dd] px-2 py-0.5 rounded text-[11px] font-bold flex items-center border border-[#badbcc]">
                        <Check className="w-3 h-3 mr-1" /> Tersimpan di PostgreSQL
                      </span>
                    )}
                    {savingState === 'error' && (
                      <span className="text-rose-600 font-medium">Gagal simpan</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Isi Soal */}
              <div className="text-slate-800 text-base sm:text-lg leading-relaxed whitespace-pre-wrap font-medium select-none mb-6">
                {currentQ.content}
              </div>

              {/* Input Jawaban */}
              {currentQ.questionType === 'multiple_choice' ? (
                <div className="space-y-3">
                  {currentQ.options?.map((opt) => {
                    const isSelected = currentAns?.selectedOption === opt.originalKey;
                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleSelectOption(currentQ.id, opt.originalKey)}
                        className={`p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base font-medium flex items-start space-x-3.5 cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'bg-pink-50 border-[#FF006E] text-slate-900 shadow-sm ring-1 ring-[#FF006E]'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs sm:text-sm transition-colors ${
                            isSelected
                              ? 'bg-[#FF006E] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {opt.key}
                        </div>
                        <div className="flex-1 pt-0.5 leading-snug">{opt.text}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Essay Question Input */
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Ketik Lembar Jawaban Essay Anda:
                  </label>
                  <textarea
                    rows={8}
                    value={currentAns?.essayAnswer || ''}
                    onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                    placeholder="Tuliskan uraian dan analisis jawaban Anda secara terstruktur dan jelas di sini..."
                    className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF006E] focus:bg-white text-sm sm:text-base leading-relaxed transition"
                  />
                  <div className="flex justify-between text-xs text-slate-400 px-1">
                    <span>Otomatis disimpan seketika ke database PostgreSQL.</span>
                    <span>
                      {(currentAns?.essayAnswer || '').trim().split(/\s+/).filter(Boolean).length} Kata
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation Buttons */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Sebelumnya</span>
              </button>

              {/* Ragu-Ragu Toggle Button */}
              <button
                type="button"
                onClick={() => handleToggleDoubtful(currentQ.id)}
                className={`inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  currentAns?.isDoubtful
                    ? 'bg-amber-400 text-amber-950 shadow-sm border border-amber-500'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Flag className="w-4 h-4 mr-1.5" />
                <span>{currentAns?.isDoubtful ? 'Ditandai Ragu-Ragu' : 'Ragu-Ragu'}</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-md shadow-[#FF006E]/20 transition cursor-pointer"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0f5132] hover:bg-[#146c43] shadow-md transition cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4 mr-1.5" />
                  <span>Selesai & Kumpulkan</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Navigasi Kisi Nomor Soal (1 col on lg) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 sticky top-20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-3">
              Nomor Soal Ujian
            </h3>

            {/* Grid Butir Soal */}
            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const ans = answersMap[q.id];
                const isSelected =
                  q.questionType === 'multiple_choice'
                    ? Boolean(ans?.selectedOption)
                    : Boolean(ans?.essayAnswer && ans.essayAnswer.trim() !== '');
                const isDoubt = Boolean(ans?.isDoubtful);
                const isCurrent = idx === currentIndex;

                let colorClasses = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                if (isDoubt) {
                  colorClasses = 'bg-amber-400 text-amber-950 font-bold border-amber-500 shadow-sm';
                } else if (isSelected) {
                  colorClasses = 'bg-[#0f5132] text-white font-bold border-[#0f5132] shadow-sm';
                }

                if (isCurrent) {
                  colorClasses += ' ring-2 ring-[#FF006E] ring-offset-2';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-xs flex items-center justify-center border transition-all cursor-pointer ${colorClasses}`}
                    title={`Nomor ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legenda Warna */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-[#0f5132] flex-shrink-0" />
                <span>Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 flex-shrink-0" />
                <span>Ragu-Ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 flex-shrink-0" />
                <span>Belum Dijawab ({unansweredCount})</span>
              </div>
            </div>

            {/* Tombol Kumpulkan Ujian */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="mt-5 w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-md shadow-[#FF006E]/20 transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Selesai Ujian</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Selesai Ujian */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Konfirmasi Selesai Ujian</h3>
            <p className="text-sm text-slate-600 mt-1">
              Apakah Anda yakin ingin mengakhiri dan mengumpulkan lembar jawaban ujian ini sekarang?
            </p>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Butir Soal:</span>
                <span className="font-bold text-slate-900">{questions.length} Butir</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soal Terjawab:</span>
                <span className="font-bold text-emerald-600">{answeredCount} Soal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soal Ragu-ragu:</span>
                <span className="font-bold text-amber-600">{doubtfulCount} Soal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soal Belum Terjawab:</span>
                <span className="font-bold text-rose-600">{unansweredCount} Soal</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="mt-3 text-xs text-rose-600 font-semibold flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                Masih ada {unansweredCount} butir soal yang belum Anda jawab!
              </p>
            )}

            <div className="mt-6 flex space-x-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Batal, Lanjutkan Soal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={executeSubmit}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center space-x-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    <span>Menghitung Nilai...</span>
                  </>
                ) : (
                  <span>Ya, Selesai & Kirim</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
