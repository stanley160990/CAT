import React, { useState, useEffect } from 'react';
import { User, Exam, Room, Question } from '../../types/cat.ts';
import { apiRequest } from '../../lib/api.ts';
import {
  downloadCSV,
  downloadParticipantTemplate,
  downloadOperatorTemplate,
  downloadQuestionTemplate,
  parseCSVFile,
} from '../../lib/csvHelper.ts';
import { PrintableAnswerSheet } from '../common/PrintableAnswerSheet.tsx';
import {
  ShieldCheck,
  Play,
  Square,
  BookOpen,
  Building2,
  Users,
  FileQuestion,
  Award,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  Upload,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Check,
  X,
  UserCheck,
  FolderOpen,
  Sparkles,
  Layers,
  Save,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
}

type AdminTab =
  | 'overview'
  | 'exams'
  | 'rooms'
  | 'operators'
  | 'participants'
  | 'questions'
  | 'essay_grading'
  | 'reports';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Core Data
  const [examsList, setExamsList] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [operatorsList, setOperatorsList] = useState<any[]>([]);
  const [participantsList, setParticipantsList] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [bankNamesList, setBankNamesList] = useState<string[]>([]);
  const [bankGroupsList, setBankGroupsList] = useState<any[]>([]);
  const [selectedBankGroup, setSelectedBankGroup] = useState<string | null>(null);
  const [bankQuestionsList, setBankQuestionsList] = useState<Question[]>([]);
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);
  const [bankGroupForm, setBankGroupForm] = useState({
    name: '',
    category: 'Umum',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  // Modals & Forms
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [examForm, setExamForm] = useState<any>({
    title: '',
    examType: 'multiple_choice', // Only 'multiple_choice' or 'essay'
    description: '',
    durationMinutes: 60,
    scoringCorrect: 4,
    scoringWrong: 0,
    scoringEmpty: 0,
    passingGrade: 65,
    randomizeQuestions: true,
    randomizeOptions: true,
    bankName: 'Bank Soal Utama',
    roomIds: [] as number[],
    roomOperators: {} as Record<number, string>, // roomId -> operatorUsername
    operatorName: '',
  });

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState<any>({
    roomCode: '',
    name: '',
    capacity: 30,
    location: '',
  });

  // Operator Modals
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operatorForm, setOperatorForm] = useState<any>({
    username: '',
    password: 'operator123',
    email: '',
  });
  const [showBulkOperatorModal, setShowBulkOperatorModal] = useState(false);
  const [bulkOperatorFile, setBulkOperatorFile] = useState<File | null>(null);
  const [bulkOperatorLoading, setBulkOperatorLoading] = useState(false);
  const [bulkOperatorResult, setBulkOperatorResult] = useState<any | null>(null);

  // Participant Modals
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [participantForm, setParticipantForm] = useState<any>({
    username: '',
    name: '',
    password: 'peserta123',
    email: '',
    role: 'peserta',
    roomId: '',
    examId: '',
  });

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionForm, setQuestionForm] = useState<any>({
    bankName: 'Bank Soal Utama',
    questionType: 'multiple_choice',
    content: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    correctAnswer: 'A',
    points: 5,
    explanation: '',
  });

  // Bulk Upload state
  const [showBulkParticipantModal, setShowBulkParticipantModal] = useState(false);
  const [bulkParticipantFile, setBulkParticipantFile] = useState<File | null>(null);
  const [bulkParticipantLoading, setBulkParticipantLoading] = useState(false);
  const [bulkParticipantResult, setBulkParticipantResult] = useState<any | null>(null);

  const [showBulkQuestionModal, setShowBulkQuestionModal] = useState(false);
  const [bulkQuestionFile, setBulkQuestionFile] = useState<File | null>(null);
  const [bulkQuestionLoading, setBulkQuestionLoading] = useState(false);
  const [bulkQuestionResult, setBulkQuestionResult] = useState<any | null>(null);

  // Essay Grading State
  const [essayExamsList, setEssayExamsList] = useState<Exam[]>([]);
  const [selectedEssayExamId, setSelectedEssayExamId] = useState<number | null>(null);
  const [essaySubmissions, setEssaySubmissions] = useState<any[]>([]);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [gradingFeedbacks, setGradingFeedbacks] = useState<Record<string, string>>({});
  const [gradingSaving, setGradingSaving] = useState<Record<string, boolean>>({});

  // Printable Answer Sheet Modal
  const [selectedUserForSheet, setSelectedUserForSheet] = useState<{
    userId: number;
    examId: number;
  } | null>(null);

  // Fetch all initial data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [eRes, rRes, oRes, pRes, bRes, gRes] = await Promise.all([
        apiRequest<{ success: boolean; exams: Exam[] }>('/api/exams'),
        apiRequest<{ success: boolean; rooms: Room[] }>('/api/rooms'),
        apiRequest<{ success: boolean; operators: any[] }>('/api/operators'),
        apiRequest<{ success: boolean; participants: any[] }>('/api/participants'),
        apiRequest<{ success: boolean; banks: any[] }>('/api/bank-soal'),
        apiRequest<{ success: boolean; groups: any[] }>('/api/bank-soal/groups'),
      ]);

      if (eRes.success) {
        setExamsList(eRes.exams);
        if (!selectedExamId && eRes.exams.length > 0) {
          setSelectedExamId(eRes.exams[0].id);
        }
        // Filter exams that are essay
        const essays = eRes.exams.filter((ex) => ex.examType === 'essay');
        setEssayExamsList(essays);
        if (essays.length > 0 && !selectedEssayExamId) {
          setSelectedEssayExamId(essays[0].id);
        }
      }
      if (rRes.success) setRoomsList(rRes.rooms);
      if (oRes.success) setOperatorsList(oRes.operators);
      if (pRes.success) setParticipantsList(pRes.participants);
      if (gRes.success && Array.isArray(gRes.groups)) {
        setBankGroupsList(gRes.groups);
        const groupNames = gRes.groups.map((g: any) => g.name);
        setBankNamesList(Array.from(new Set(groupNames)));
      } else if (bRes.success) {
        const names = bRes.banks.map((b: any) => b.bankName);
        setBankNamesList(Array.from(new Set(names)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch questions for selected bank group
  const fetchQuestionsForBank = async (bName: string) => {
    try {
      const res = await apiRequest<{ success: boolean; questions: Question[] }>(
        `/api/bank-soal/questions/${encodeURIComponent(bName)}`
      );
      if (res.success) {
        setBankQuestionsList(res.questions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedBankGroup) {
      fetchQuestionsForBank(selectedBankGroup);
    }
  }, [selectedBankGroup]);

  // Fetch Essay Submissions when selectedEssayExamId changes
  useEffect(() => {
    if (!selectedEssayExamId) return;
    const fetchEssaySubmissions = async () => {
      try {
        const res = await apiRequest(`/api/grading/exam-submissions/${selectedEssayExamId}`);
        if (res.success) {
          setEssaySubmissions(res.submissions || []);
          // Populate initial scores
          const scores: Record<string, number> = {};
          const feedbacks: Record<string, string> = {};
          res.submissions?.forEach((sub: any) => {
            sub.questionDetails?.forEach((qd: any) => {
              const key = `${sub.userId}_${qd.questionId}`;
              scores[key] = qd.score ?? 0;
              feedbacks[key] = qd.feedback ?? '';
            });
          });
          setGradingScores(scores);
          setGradingFeedbacks(feedbacks);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchEssaySubmissions();
  }, [selectedEssayExamId, activeTab]);

  const selectedExam = examsList.find((e) => e.id === selectedExamId) || examsList[0];

  // Exam Controls
  const handleStartExam = async (examId: number) => {
    if (!confirm('Apakah Anda yakin ingin MEMULAI ujian ini secara serentak? Peserta yang berada di ruang tunggu akan dapat langsung mengerjakan.')) return;
    try {
      const res = await apiRequest(`/api/exams/${examId}/start`, { method: 'POST' });
      if (res.success) {
        alert(res.message);
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memulai ujian.');
    }
  };

  const handleEndExam = async (examId: number) => {
    if (!confirm('Apakah Anda yakin ingin MENGAKHIRI keseluruhan ujian ini? Seluruh sesi peserta akan diselesaikan otomatis.')) return;
    try {
      const res = await apiRequest(`/api/exams/${examId}/end`, { method: 'POST' });
      if (res.success) {
        alert(res.message);
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengakhiri ujian.');
    }
  };

  // Exam Create/Edit/Delete
  const handleOpenCreateExam = () => {
    setEditingExamId(null);
    setExamForm({
      title: '',
      examType: 'multiple_choice',
      description: '',
      durationMinutes: 60,
      scoringCorrect: 4,
      scoringWrong: 0,
      scoringEmpty: 0,
      passingGrade: 65,
      randomizeQuestions: true,
      randomizeOptions: true,
      bankName: bankNamesList[0] || 'Bank Soal Utama',
      roomIds: [],
      roomOperators: {},
      operatorName: '',
    });
    setShowExamModal(true);
  };

  const handleOpenEditExam = (ex: Exam) => {
    setEditingExamId(ex.id);
    const roMap: Record<number, string> = {};
    if (Array.isArray(ex.roomOperators)) {
      ex.roomOperators.forEach((ro: any) => {
        if (ro.roomId) {
          roMap[ro.roomId] = ro.operatorUsername || '';
        }
      });
    }

    setExamForm({
      title: ex.title || '',
      examType: ex.examType || 'multiple_choice',
      description: ex.description || '',
      durationMinutes: ex.durationMinutes || 60,
      scoringCorrect: ex.scoringCorrect ?? 4,
      scoringWrong: ex.scoringWrong ?? 0,
      scoringEmpty: ex.scoringEmpty ?? 0,
      passingGrade: ex.passingGrade ?? 65,
      randomizeQuestions: ex.randomizeQuestions ?? true,
      randomizeOptions: ex.randomizeOptions ?? true,
      bankName: ex.bankName || bankNamesList[0] || 'Bank Soal Utama',
      roomIds: Array.isArray(ex.roomIds) ? ex.roomIds : (ex.roomId ? [ex.roomId] : []),
      roomOperators: roMap,
      operatorName: ex.operatorName || '',
    });
    setShowExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomOperatorsPayload = (examForm.roomIds || []).map((rId: number) => {
      const room = roomsList.find((r) => r.id === rId);
      const opUsername = examForm.roomOperators?.[rId] || '';
      const op = operatorsList.find((o) => o.username === opUsername);
      return {
        roomId: rId,
        roomName: room?.name || '',
        roomCode: room?.roomCode || '',
        operatorId: op?.id || null,
        operatorUsername: opUsername,
        operatorName: op?.name || opUsername,
      };
    });

    try {
      const url = editingExamId ? `/api/exams/${editingExamId}` : '/api/exams';
      const method = editingExamId ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify({
          ...examForm,
          roomIds: examForm.roomIds || [],
          roomId: (examForm.roomIds && examForm.roomIds[0]) ? Number(examForm.roomIds[0]) : null,
          roomOperators: roomOperatorsPayload,
        }),
      });
      if (res.success) {
        setShowExamModal(false);
        setEditingExamId(null);
        setExamForm({
          title: '',
          examType: 'multiple_choice',
          description: '',
          durationMinutes: 60,
          scoringCorrect: 4,
          scoringWrong: 0,
          scoringEmpty: 0,
          passingGrade: 65,
          randomizeQuestions: true,
          randomizeOptions: true,
          bankName: bankNamesList[0] || 'Bank Soal Utama',
          roomIds: [],
          roomOperators: {},
          operatorName: '',
        });
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan ujian');
    }
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm('Hapus ujian ini beserta seluruh butir soal dan nilainya?')) return;
    try {
      await apiRequest(`/api/exams/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Rooms CRUD
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          roomCode: roomForm.roomCode,
          name: roomForm.name,
          capacity: roomForm.capacity,
          location: roomForm.location,
        }),
      });
      if (res.success) {
        setShowRoomModal(false);
        setRoomForm({ roomCode: '', name: '', capacity: 30, location: '' });
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('Hapus ruangan ini?')) return;
    try {
      await apiRequest(`/api/rooms/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Operators CRUD
  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/operators', {
        method: 'POST',
        body: JSON.stringify({
          username: operatorForm.username.trim(),
          name: operatorForm.username.trim(),
          password: operatorForm.password,
          email: operatorForm.email ? operatorForm.email.trim() : null,
        }),
      });
      if (res.success) {
        setShowOperatorModal(false);
        setOperatorForm({ username: '', password: 'operator123', email: '' });
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Bank Soal Groups CRUD
  const handleCreateBankGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankGroupForm.name.trim()) return;
    try {
      const res = await apiRequest<{ success: boolean; group: any; error?: string }>('/api/bank-soal/groups', {
        method: 'POST',
        body: JSON.stringify(bankGroupForm),
      });
      if (res.success) {
        setShowCreateBankModal(false);
        const createdName = res.group.name;
        setBankGroupForm({ name: '', category: 'Umum', description: '' });
        await loadAllData();
        setSelectedBankGroup(createdName);
      } else {
        alert(res.error || 'Gagal membuat kelompok bank soal');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat kelompok bank soal');
    }
  };

  const handleDeleteBankGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`Hapus kelompok bank soal "${groupName}"?`)) return;
    try {
      await apiRequest(`/api/bank-soal/groups/${groupId}`, { method: 'DELETE' });
      if (selectedBankGroup === groupName) {
        setSelectedBankGroup(null);
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kelompok bank soal');
    }
  };

  const handleDeleteOperator = async (id: number) => {
    if (!confirm('Hapus operator ini?')) return;
    try {
      await apiRequest(`/api/operators/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkUploadOperators = async () => {
    if (!bulkOperatorFile) return;
    setBulkOperatorLoading(true);
    setBulkOperatorResult(null);
    try {
      const rows = await parseCSVFile(bulkOperatorFile);
      const res = await apiRequest('/api/operators/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({ rows, defaultRoomId: roomsList[0]?.id }),
      });
      setBulkOperatorResult(res);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses CSV operator.');
    } finally {
      setBulkOperatorLoading(false);
    }
  };

  // Participants CRUD & Bulk
  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/participants', {
        method: 'POST',
        body: JSON.stringify({
          ...participantForm,
          roomId: participantForm.roomId ? Number(participantForm.roomId) : null,
          examId: participantForm.examId ? Number(participantForm.examId) : null,
        }),
      });
      if (res.success) {
        setShowParticipantModal(false);
        setParticipantForm({
          username: '',
          name: '',
          password: 'peserta123',
          email: '',
          role: 'peserta',
          roomId: '',
          examId: '',
        });
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteParticipant = async (id: number) => {
    if (!confirm('Hapus peserta ini beserta seluruh riwayat ujiannya?')) return;
    try {
      await apiRequest(`/api/participants/${id}`, { method: 'DELETE' });
      loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkUploadParticipants = async () => {
    if (!bulkParticipantFile) return;
    setBulkParticipantLoading(true);
    setBulkParticipantResult(null);
    try {
      const rows = await parseCSVFile(bulkParticipantFile);
      const res = await apiRequest('/api/participants/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({
          rows,
          defaultRoomId: roomsList[0]?.id,
          defaultExamId: selectedExamId,
        }),
      });
      setBulkParticipantResult(res);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses file CSV peserta.');
    } finally {
      setBulkParticipantLoading(false);
    }
  };

  // Questions CRUD & Bulk
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const bankToUse = selectedBankGroup || questionForm.bankName;
    if (!bankToUse) return alert('Pilih atau buat kelompok bank soal terlebih dahulu.');
    try {
      const res = await apiRequest('/api/bank-soal/questions', {
        method: 'POST',
        body: JSON.stringify({
          ...questionForm,
          bankName: bankToUse,
        }),
      });
      if (res.success) {
        setShowQuestionModal(false);
        setQuestionForm({
          bankName: bankToUse,
          questionType: 'multiple_choice',
          content: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          optionE: '',
          correctAnswer: 'A',
          points: 5,
          explanation: '',
        });
        if (selectedBankGroup) {
          fetchQuestionsForBank(selectedBankGroup);
        }
        loadAllData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('Hapus butir soal ini?')) return;
    try {
      await apiRequest(`/api/questions/${id}`, { method: 'DELETE' });
      if (selectedBankGroup) {
        fetchQuestionsForBank(selectedBankGroup);
      }
      loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkUploadQuestions = async () => {
    const bankToUse = selectedBankGroup || selectedExam?.bankName || 'Bank Soal Utama';
    if (!bulkQuestionFile) return;
    setBulkQuestionLoading(true);
    setBulkQuestionResult(null);
    try {
      const rows = await parseCSVFile(bulkQuestionFile);
      const targetExamId = selectedExamId || examsList[0]?.id || 1;
      const res = await apiRequest(`/api/exams/${targetExamId}/questions/bulk-upload`, {
        method: 'POST',
        body: JSON.stringify({ rows, defaultBankName: bankToUse }),
      });
      setBulkQuestionResult(res);
      if (selectedBankGroup) {
        fetchQuestionsForBank(selectedBankGroup);
      }
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengunggah file soal.');
    } finally {
      setBulkQuestionLoading(false);
    }
  };

  // Grade Single Essay Question
  const handleSaveGradeEssay = async (userId: number, questionId: number) => {
    const key = `${userId}_${questionId}`;
    setGradingSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const score = gradingScores[key] ?? 0;
      const feedback = gradingFeedbacks[key] ?? '';
      const res = await apiRequest('/api/grading/grade-essay', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          examId: selectedEssayExamId,
          questionId,
          score,
          feedback,
        }),
      });
      if (res.success) {
        alert('Nilai essay berhasil disimpan!');
        // Refresh submissions
        if (selectedEssayExamId) {
          const subRes = await apiRequest(`/api/grading/exam-submissions/${selectedEssayExamId}`);
          if (subRes.success) setEssaySubmissions(subRes.submissions || []);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan nilai essay.');
    } finally {
      setGradingSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Export Complete Exam Results to CSV
  const exportAllResultsCSV = async () => {
    if (!selectedExamId) return;
    try {
      const res = await apiRequest(`/api/reports/exam-results/${selectedExamId}`);
      if (!res.success || !res.results) return;

      const headers = [
        'nomor_peserta',
        'nama_lengkap',
        'ruangan',
        'status',
        'total_soal',
        'terjawab',
        'benar',
        'salah',
        'kosong',
        'nilai_pg',
        'nilai_essay',
        'total_skor',
        'status_kelulusan',
      ];

      const rows = res.results.map((r: any) => [
        r.username,
        `"${r.name}"`,
        r.roomName,
        r.status,
        r.totalQuestions,
        r.answeredCount,
        r.correctCount,
        r.wrongCount,
        r.emptyCount,
        r.mcqScore,
        r.essayScore,
        r.totalScore,
        r.isPassed ? 'LULUS' : 'TIDAK LULUS',
      ]);

      const csv = [headers.join(','), ...rows.map((row: any) => row.join(','))].join('\n');
      downloadCSV(`rekapitulasi_nilai_cat_${selectedExam?.title || 'ujian'}.csv`, csv);
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh rekap nilai.');
    }
  };

  // Filter questions by Bank Name
  const filteredQuestions = selectedBankGroup
    ? questionsList.filter((q) => q.bankName === selectedBankGroup)
    : questionsList;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Hero & Exam Controller with #FF006E and #d1e7dd */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc] flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Pusat Kendali Administrator
              </span>
              <span className="text-xs text-slate-400">PostgreSQL Cloud SQL</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
              Sistem Seleksi Komprehensif CAT 2026
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Kelola jadwal ujian, alokasi ruangan, operator ruangan, bank soal pilihan ganda & essay,
              serta kendali serentak mulai/selesai ujian secara realtime.
            </p>
          </div>

          {/* Quick Active Exam Control Widget */}
          {selectedExam && (
            <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-slate-700/80 flex flex-col sm:flex-row items-center gap-4">
              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase block">
                  Status Ujian Terpilih:
                </span>
                <span className="text-base font-extrabold text-white block">
                  {selectedExam.title}
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  <span
                    className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                      selectedExam.status === 'ongoing'
                        ? 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc] animate-pulse'
                        : selectedExam.status === 'completed'
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {selectedExam.status === 'ongoing' && 'Sedang Berlangsung (Ongoing)'}
                    {selectedExam.status === 'completed' && 'Selesai (Completed)'}
                    {selectedExam.status === 'draft' && 'Draft / Belum Dimulai'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Durasi: {selectedExam.durationMinutes}m
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                {selectedExam.status !== 'ongoing' && selectedExam.status !== 'completed' ? (
                  <button
                    onClick={() => handleStartExam(selectedExam.id)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-lg shadow-[#FF006E]/30 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 mr-1.5 fill-current" />
                    <span>Mulai Ujian</span>
                  </button>
                ) : selectedExam.status === 'ongoing' ? (
                  <button
                    onClick={() => handleEndExam(selectedExam.id)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 transition cursor-pointer"
                  >
                    <Square className="w-4 h-4 mr-1.5 fill-current" />
                    <span>Akhiri Ujian</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">Ujian telah ditutup</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Exam Selector Strip */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center space-x-3 overflow-x-auto text-xs">
          <span className="text-slate-400 font-bold uppercase whitespace-nowrap">Pilih Ujian Aktif:</span>
          {examsList.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setSelectedExamId(ex.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                selectedExamId === ex.id
                  ? 'bg-[#FF006E] text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ex.title} ({ex.examType === 'essay' ? 'ESSAY' : 'PG'})
            </button>
          ))}
        </div>
      </div>

      {/* Admin Navigation Tabs - NO NUMBERS IN PARENTHESES */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'overview'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Ringkasan</span>
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'exams'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Manajemen Ujian</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'rooms'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Ruangan</span>
        </button>

        <button
          onClick={() => setActiveTab('operators')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'operators'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Operator</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'participants'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Peserta Ujian</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'questions'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Bank Soal</span>
        </button>

        <button
          onClick={() => setActiveTab('essay_grading')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'essay_grading'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>Koreksi Essay</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-t-xl transition cursor-pointer flex items-center space-x-1.5 ${
            activeTab === 'reports'
              ? 'bg-white text-[#FF006E] border-t-2 border-[#FF006E] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rekapitulasi Nilai</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">Total Jadwal Ujian</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">{examsList.length}</span>
                <BookOpen className="w-5 h-5 text-[#FF006E]" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Pilihan Ganda & Essay</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">Total Ruang Ujian</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">{roomsList.length}</span>
                <Building2 className="w-5 h-5 text-[#0f5132]" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Dilengkapi Operator Ruang</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">Total Operator</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">{operatorsList.length}</span>
                <UserCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Pengawas Ruangan</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">Total Peserta Ujian</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">{participantsList.length}</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Akun Terdaftar</span>
            </div>
          </div>

          {/* Live Leaderboard */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF006E]">
                  Live Ranking & Realtime Skor
                </span>
                <h2 className="text-base font-extrabold text-slate-900">
                  Peringkat Nilai Peserta - {selectedExam?.title}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={loadAllData}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  <span>Refresh Skor</span>
                </button>
                <button
                  onClick={exportAllResultsCSV}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] transition flex items-center cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d1e7dd]/50 border-b border-[#badbcc] text-[#0f5132] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Peringkat</th>
                    <th className="py-3 px-4">No. Peserta</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Ruangan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nilai Akhir</th>
                    <th className="py-3 px-4">Hasil KKM</th>
                    <th className="py-3 px-4 text-center">Lembar Jawaban</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participantsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada peserta terdaftar.
                      </td>
                    </tr>
                  ) : (
                    participantsList.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500">#{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.username}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-3 px-4 text-slate-600">{p.roomName || '-'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              p.examStatus === 'finished'
                                ? 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]'
                                : p.examStatus === 'testing'
                                ? 'bg-[#fff0f6] text-[#FF006E] border border-[#ffccd8]'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.examStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-sm text-[#FF006E]">
                          {p.score !== null ? `${p.score} Poin` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {p.score !== null ? (
                            p.score >= (selectedExam?.passingGrade || 65) ? (
                              <span className="text-[#0f5132] bg-[#d1e7dd] px-2 py-0.5 rounded-full font-bold flex items-center w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Lulus
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">Tidak Lulus</span>
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {selectedExamId && (
                            <button
                              onClick={() =>
                                setSelectedUserForSheet({
                                  userId: p.id,
                                  examId: selectedExamId,
                                })
                              }
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-[#d1e7dd] text-slate-700 hover:text-[#0f5132] text-[11px] font-semibold transition cursor-pointer"
                            >
                              Detail Jawaban
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MANAJEMEN UJIAN */}
      {/* ======================================================== */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Daftar Jadwal Ujian CAT</h2>
              <p className="text-xs text-slate-500">
                Pilih jenis ujian (Pilihan Ganda atau Essay), pilih bank soal, ruangan, serta operator penanggung jawab.
              </p>
            </div>
            <button
              onClick={handleOpenCreateExam}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Buat Ujian Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examsList.map((ex) => (
              <div
                key={ex.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        ex.status === 'ongoing'
                          ? 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc] animate-pulse'
                          : ex.status === 'completed'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ex.status}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ex.examType === 'essay'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]'
                      }`}
                    >
                      {ex.examType === 'essay' ? 'SOAL ESSAY' : 'PILIHAN GANDA'}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{ex.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ex.description}</p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">Bank Soal Digunakan:</span>
                      <span className="font-bold text-[#FF006E]">{ex.bankName || 'Bank Soal Utama'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">
                        Alokasi Ruangan & Operator Penanggung Jawab:
                      </span>
                      {ex.roomOperators && ex.roomOperators.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ex.roomOperators.map((ro: any) => (
                            <span
                              key={ro.roomId}
                              className="inline-flex items-center text-[10px] bg-white text-slate-800 px-2 py-1 rounded-lg border border-slate-300 shadow-xs"
                            >
                              <strong className="text-slate-900 mr-1.5">{ro.roomName}:</strong>
                              <span className="text-[#FF006E] font-bold">
                                {ro.operatorUsername ? `@${ro.operatorUsername}` : 'Belum ditentukan'}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex justify-between text-slate-700">
                          <span className="font-medium text-slate-900">{ex.roomNames || 'Semua Ruangan'}</span>
                          <span className="text-slate-500 font-mono text-[11px]">{ex.operatorName || '-'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">Durasi Pengerjaan:</span>
                      <span className="font-medium">{ex.durationMinutes} Menit</span>
                    </div>

                    {ex.examType === 'multiple_choice' ? (
                      <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200">
                        <span className="font-semibold">Formula Nilai PG:</span>
                        <span className="font-mono text-[#0f5132] font-bold">
                          Benar: +{ex.scoringCorrect} | Salah: {ex.scoringWrong} | Kosong: {ex.scoringEmpty}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200">
                        <span className="font-semibold">Kriteria Nilai:</span>
                        <span className="text-purple-700 font-semibold">Penilaian Manual Rubrik Essay</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">Nilai KKM (Passing Grade):</span>
                      <span className="font-bold text-slate-900">{ex.passingGrade} Poin</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {ex.questionCount ?? 0} Butir Soal &bull; {ex.participantCount ?? 0} Peserta
                  </span>

                  <div className="flex items-center space-x-2">
                    {ex.status !== 'ongoing' ? (
                      <button
                        onClick={() => handleStartExam(ex.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0f5132] hover:bg-[#0b3d26] transition cursor-pointer flex items-center"
                      >
                        <Play className="w-3.5 h-3.5 mr-1" /> Mulai
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEndExam(ex.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer flex items-center"
                      >
                        <Square className="w-3.5 h-3.5 mr-1" /> Akhiri
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditExam(ex)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer flex items-center"
                      title="Edit Jadwal & Konfigurasi Ujian"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1 text-[#FF006E]" /> Edit
                    </button>

                    <button
                      onClick={() => handleDeleteExam(ex.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                      title="Hapus Ujian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: RUANGAN */}
      {/* ======================================================== */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Manajemen Ruangan CBT</h2>
              <p className="text-xs text-slate-500">
                Kelola data ruangan pelaksanaan ujian dan kapasitas peserta.
              </p>
            </div>
            <button
              onClick={() => setShowRoomModal(true)}
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Tambah Ruangan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roomsList.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {r.roomCode}
                    </span>
                    <span className="text-xs font-bold text-[#0f5132] bg-[#d1e7dd] px-2 py-0.5 rounded border border-[#badbcc]">
                      Kapasitas: {r.capacity} Kursi
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{r.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Lokasi: {r.location || '-'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{r.participantCount ?? 0} Peserta Terdaftar</span>
                  <button
                    onClick={() => handleDeleteRoom(r.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                    title="Hapus Ruangan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: OPERATOR (ADD & IMPORT OPERATOR) */}
      {/* ======================================================== */}
      {activeTab === 'operators' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Manajemen Operator Ruangan
              </h2>
              <p className="text-xs text-slate-500">
                Kelola akun operator. Penugasan operator dilakukan saat membuat atau mengedit jadwal Ujian CAT.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadOperatorTemplate}
                className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Unduh Template CSV</span>
              </button>

              <button
                onClick={() => setShowBulkOperatorModal(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-[#0f5132] bg-[#d1e7dd] hover:bg-[#c2ded3] border border-[#badbcc] shadow-sm transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                <span>Import Operator (CSV)</span>
              </button>

              <button
                onClick={() => setShowOperatorModal(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Tambah Operator</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d1e7dd]/50 border-b border-[#badbcc] text-[#0f5132] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Username Operator</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Status Akun</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operatorsList.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{op.username}</td>
                      <td className="py-3.5 px-4 text-slate-600">{op.email || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]">
                          Operator Aktif
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteOperator(op.id)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus Operator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: PESERTA UJIAN */}
      {/* ======================================================== */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Manajemen Data Peserta Seleksi
              </h2>
              <p className="text-xs text-slate-500">
                Unggah massal peserta menggunakan template CSV atau tambahkan data peserta secara manual.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadParticipantTemplate}
                className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Unduh Template CSV</span>
              </button>

              <button
                onClick={() => setShowBulkParticipantModal(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-[#0f5132] bg-[#d1e7dd] hover:bg-[#c2ded3] border border-[#badbcc] shadow-sm transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                <span>Upload CSV Peserta</span>
              </button>

              <button
                onClick={() => setShowParticipantModal(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Tambah Peserta</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d1e7dd]/50 border-b border-[#badbcc] text-[#0f5132] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">No. Peserta</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Ruangan</th>
                    <th className="py-3 px-4">Ujian</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participantsList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.username}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.roomName || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{p.examTitle || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff0f6] text-[#FF006E] border border-[#ffccd8]">
                          {p.examStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteParticipant(p.id)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: BANK SOAL (GROUPED BY NAME) */}
      {/* ======================================================== */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {!selectedBankGroup ? (
            /* STEP 1: DAFTAR KELOMPOK BANK SOAL */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Kelompok Bank Soal CAT
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tambahkan kelompok bank soal terlebih dahulu. Setelah kelompok dibuat, Anda dapat membuka kelompok tersebut untuk menambahkan butir soal atau mengunggah CSV.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCreateBankModal(true)}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm shadow-[#FF006E]/20 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>Tambah Kelompok Bank Soal</span>
                  </button>
                </div>
              </div>

              {/* Grid of Bank Soal Groups */}
              {bankGroupsList.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
                  <FolderOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">Belum Ada Kelompok Bank Soal</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Buat kelompok bank soal baru terlebih dahulu untuk dapat menambahkan dan mengelola butir soal.
                  </p>
                  <button
                    onClick={() => setShowCreateBankModal(true)}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    <span>Buat Kelompok Sekarang</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankGroupsList.map((bg) => (
                    <div
                      key={bg.id || bg.name}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-[#FF006E]/40 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-8 h-8 rounded-xl bg-[#fff0f6] text-[#FF006E] flex items-center justify-center font-bold">
                            <FolderOpen className="w-4 h-4" />
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]">
                            {bg.category || 'Umum'}
                          </span>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900 mt-2">{bg.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {bg.description || 'Kumpulan butir soal Computer Assisted Test.'}
                        </p>

                        <div className="mt-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">Total Butir Soal:</span>
                          <span className="font-mono font-black text-[#FF006E] text-sm">
                            {bg.questionCount ?? 0} Soal
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedBankGroup(bg.name)}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm shadow-[#FF006E]/20 transition cursor-pointer flex items-center justify-center"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                          <span>Kelola & Buka Soal</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBankGroup(bg.id, bg.name)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                          title="Hapus Kelompok Bank Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: KELOLA BUTIR SOAL DI KELOMPOK YANG DIPILIH */
            <div className="space-y-4">
              {/* Header Navigation Back & Bank Info */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedBankGroup(null)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    title="Kembali ke Daftar Kelompok"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f5132] bg-[#d1e7dd] px-2 py-0.5 rounded border border-[#badbcc]">
                        Kelompok Bank Soal Terpilih
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        {bankQuestionsList.length} Butir Soal
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5">{selectedBankGroup}</h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={downloadQuestionTemplate}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    <span>Unduh Template CSV</span>
                  </button>

                  <button
                    onClick={() => setShowBulkQuestionModal(true)}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-[#0f5132] bg-[#d1e7dd] hover:bg-[#c2ded3] border border-[#badbcc] shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    <span>Upload CSV Soal</span>
                  </button>

                  <button
                    onClick={() => {
                      setQuestionForm({
                        ...questionForm,
                        bankName: selectedBankGroup,
                      });
                      setShowQuestionModal(true);
                    }}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm shadow-[#FF006E]/20 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>Tambah Butir Soal</span>
                  </button>
                </div>
              </div>

              {/* List of Questions inside selectedBankGroup */}
              {bankQuestionsList.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
                  <FileQuestion className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Kelompok Ini Belum Memiliki Butir Soal
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Silakan klik tombol di bawah untuk menambahkan butir soal baru atau mengimpor file CSV ke kelompok ini.
                  </p>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => {
                        setQuestionForm({ ...questionForm, bankName: selectedBankGroup });
                        setShowQuestionModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span>Tambah Butir Soal Baru</span>
                    </button>
                    <button
                      onClick={() => setShowBulkQuestionModal(true)}
                      className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-[#0f5132] bg-[#d1e7dd] hover:bg-[#badbcc] border border-[#badbcc] transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      <span>Import CSV</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankQuestionsList.map((q, idx) => (
                    <div
                      key={q.id}
                      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span
                            className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                              q.questionType === 'essay'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]'
                            }`}
                          >
                            {q.questionType === 'essay' ? 'Soal Essay' : 'Pilihan Ganda'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            Bobot: {q.points} Poin
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                          title="Hapus Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">
                        {q.content}
                      </p>

                      {q.questionType === 'multiple_choice' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {['A', 'B', 'C', 'D', 'E'].map((optKey) => {
                            const text = (q as any)[`option${optKey}`];
                            if (!text) return null;
                            const isCorrect = q.correctAnswer === optKey;
                            return (
                              <div
                                key={optKey}
                                className={`p-2 rounded-lg border flex items-center justify-between ${
                                  isCorrect
                                    ? 'bg-[#d1e7dd] border-[#badbcc] text-[#0f5132] font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span>
                                  <strong>{optKey}.</strong> {text}
                                </span>
                                {isCorrect && (
                                  <span className="text-[10px] bg-[#0f5132] text-white px-1.5 py-0.5 rounded">
                                    Kunci
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-purple-50 text-purple-900 text-xs">
                          <span className="font-bold block">Pedoman Penilaian / Rubrik:</span>
                          <p>{q.correctAnswer || '-'}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: KOREKSI ESSAY (GROUPED BY EXAM) */}
      {/* ======================================================== */}
      {activeTab === 'essay_grading' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Koreksi & Penilaian Soal Essay
              </h2>
              <p className="text-xs text-slate-500">
                Pilih jadwal ujian essay, periksa lembar jawaban essay tiap peserta, dan berikan skor nilai secara interaktif.
              </p>
            </div>

            {/* Select Essay Exam */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Pilih Ujian Essay:</span>
              <select
                value={selectedEssayExamId || ''}
                onChange={(e) => setSelectedEssayExamId(Number(e.target.value))}
                className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF006E]"
              >
                {essayExamsList.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} (KKM: {ex.passingGrade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {essaySubmissions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <p className="text-sm text-slate-500">Belum ada peserta yang mengumpulkan ujian essay ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {essaySubmissions.map((sub) => (
                <div
                  key={sub.userId}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Examinee Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2 text-sm">{sub.username}</span>
                      <span className="font-bold text-slate-800 text-sm">{sub.name}</span>
                      <span className="ml-3 text-xs text-slate-500">Ruangan: {sub.roomName}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="font-semibold text-slate-600">
                        Total Nilai Essay:{' '}
                        <strong className="text-[#FF006E] font-mono text-sm">{sub.essayScore} Poin</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          sub.isPassed ? 'bg-[#d1e7dd] text-[#0f5132]' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sub.isPassed ? 'LULUS KKM' : 'BELUM KKM'}
                      </span>
                    </div>
                  </div>

                  {/* Questions & Answer Rubric Grading */}
                  <div className="p-5 space-y-5">
                    {sub.questionDetails?.map((qd: any) => {
                      const key = `${sub.userId}_${qd.questionId}`;
                      return (
                        <div
                          key={qd.questionId}
                          className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-900 text-xs">
                              Nomor {qd.order} (Maksimal: {qd.maxPoints} Poin)
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap">
                            {qd.content}
                          </p>

                          {/* Student's Essay Answer */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <span className="font-bold text-slate-600 block mb-1">
                              Jawaban Essay Peserta:
                            </span>
                            <p className="italic text-slate-800 whitespace-pre-wrap">
                              {qd.essayAnswer || '(Peserta tidak menulis jawaban)'}
                            </p>
                          </div>

                          {/* Rubric */}
                          {qd.rubric && (
                            <div className="p-2.5 bg-[#d1e7dd]/60 border border-[#badbcc] rounded-lg text-xs text-[#0f5132]">
                              <span className="font-bold block mb-0.5">Pedoman Penilaian / Rubrik:</span>
                              <p>{qd.rubric}</p>
                            </div>
                          )}

                          {/* Score Input & Feedback */}
                          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                            <div className="flex items-center space-x-2 w-full sm:w-auto">
                              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                                Input Nilai:
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={qd.maxPoints}
                                value={gradingScores[key] ?? qd.score}
                                onChange={(e) =>
                                  setGradingScores({
                                    ...gradingScores,
                                    [key]: Number(e.target.value),
                                  })
                                }
                                className="w-20 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#FF006E]"
                              />
                              <span className="text-xs text-slate-400">/ {qd.maxPoints}</span>
                            </div>

                            <div className="flex-1 w-full">
                              <input
                                type="text"
                                placeholder="Tuliskan catatan evaluasi / feedback korektor..."
                                value={gradingFeedbacks[key] ?? qd.feedback}
                                onChange={(e) =>
                                  setGradingFeedbacks({
                                    ...gradingFeedbacks,
                                    [key]: e.target.value,
                                  })
                                }
                                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF006E]"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={gradingSaving[key]}
                              onClick={() => handleSaveGradeEssay(sub.userId, qd.questionId)}
                              className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-sm transition flex items-center justify-center cursor-pointer"
                            >
                              {gradingSaving[key] ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5 mr-1" />
                                  <span>Simpan Nilai</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 8: REKAPITULASI NILAI */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Rekapitulasi Nilai & Laporan Hasil Ujian
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Unduh rekapitulasi nilai lengkap seluruh peserta dalam format CSV untuk diolah lebih lanjut.
              </p>
            </div>

            <button
              onClick={exportAllResultsCSV}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] shadow-md transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              <span>Download Seluruh Nilai (CSV)</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: BUAT UJIAN BARU (PILIHAN GANDA ATAU ESSAY SAJA) */}
      {/* ======================================================== */}
      {showExamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">
              {editingExamId ? 'Edit Jadwal & Pengaturan Ujian CAT' : 'Buat Jadwal Ujian CAT Baru'}
            </h3>
            <form onSubmit={handleSaveExam} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Ujian:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Seleksi Kompetensi Dasar 2026"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Ujian:</label>
                  <select
                    value={examForm.examType}
                    onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="multiple_choice">Pilihan Ganda Saja</option>
                    <option value="essay">Essay Saja</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Durasi (Menit):</label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={examForm.durationMinutes}
                    onChange={(e) =>
                      setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Pemilihan Bank Soal */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Bank Soal yang Digunakan:
                </label>
                <select
                  value={examForm.bankName}
                  onChange={(e) => setExamForm({ ...examForm, bankName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                >
                  <option value="Bank Soal Utama">Bank Soal Utama</option>
                  {bankNamesList.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pemilihan Ruangan & Penentuan Operator per Ruangan */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-semibold text-slate-700">
                    Pilih Ruangan & Tentukan Operator Ruangan:
                  </label>
                  <span className="text-[11px] font-bold text-[#FF006E]">
                    {examForm.roomIds?.length || 0} Ruangan Dipilih
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Centang ruangan yang digunakan, kemudian tentukan operator penanggung jawab khusus untuk setiap ruangan tersebut.
                </p>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-2">
                  {roomsList.length === 0 ? (
                    <p className="text-xs text-slate-400">Belum ada data ruangan CBT.</p>
                  ) : (
                    roomsList.map((r) => {
                      const isChecked = examForm.roomIds?.includes(r.id);
                      return (
                        <div
                          key={r.id}
                          className={`p-2.5 rounded-xl transition text-xs border ${
                            isChecked
                              ? 'bg-white border-[#FF006E] shadow-xs'
                              : 'bg-slate-100/60 border-slate-200 hover:bg-slate-200/50'
                          }`}
                        >
                          <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={!!isChecked}
                                onChange={(e) => {
                                  const current: number[] = examForm.roomIds || [];
                                  const updated = e.target.checked
                                    ? [...current, r.id]
                                    : current.filter((id) => id !== r.id);
                                  setExamForm({ ...examForm, roomIds: updated });
                                }}
                                className="w-4 h-4 text-[#FF006E] rounded focus:ring-[#FF006E]"
                              />
                              <span className="font-bold text-slate-800">
                                {r.name} <span className="text-slate-400 font-mono">({r.roomCode})</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              Kapasitas: {r.capacity} Kursi
                            </span>
                          </label>

                          {isChecked && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-600">
                                Operator Penanggung Jawab Ruang {r.roomCode}:
                              </span>
                              <select
                                value={examForm.roomOperators?.[r.id] || ''}
                                onChange={(e) => {
                                  setExamForm({
                                    ...examForm,
                                    roomOperators: {
                                      ...(examForm.roomOperators || {}),
                                      [r.id]: e.target.value,
                                    },
                                  });
                                }}
                                className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold text-xs w-full sm:w-auto min-w-[200px] focus:outline-none focus:ring-1 focus:ring-[#FF006E]"
                              >
                                <option value="">-- Pilih Operator Ruang --</option>
                                {operatorsList.map((op) => (
                                  <option key={op.id} value={op.username}>
                                    {op.username} ({op.name})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Formula Perhitungan Nilai HANYA MUNCUL JIKA multiple_choice */}
              {examForm.examType === 'multiple_choice' ? (
                <div className="p-3 bg-[#d1e7dd]/50 rounded-xl border border-[#badbcc] space-y-2">
                  <span className="font-bold text-[#0f5132] block">
                    Formula Perhitungan Nilai Pilihan Ganda:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-600 block">Poin Benar:</span>
                      <input
                        type="number"
                        value={examForm.scoringCorrect}
                        onChange={(e) =>
                          setExamForm({ ...examForm, scoringCorrect: Number(e.target.value) })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 block">Poin Salah:</span>
                      <input
                        type="number"
                        value={examForm.scoringWrong}
                        onChange={(e) =>
                          setExamForm({ ...examForm, scoringWrong: Number(e.target.value) })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 block">Poin Kosong:</span>
                      <input
                        type="number"
                        value={examForm.scoringEmpty}
                        onChange={(e) =>
                          setExamForm({ ...examForm, scoringEmpty: Number(e.target.value) })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded text-center font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-xs">
                  <span className="font-bold block">Ujian Jenis Essay:</span>
                  <p>Tidak memerlukan formula perhitungan poin otomatis. Penilaian dilakukan manual oleh korektor berdasarkan rubrik butir soal.</p>
                </div>
              )}

              {/* Passing Grade KKM */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Passing Grade / KKM (Ambang Batas Kelulusan):
                </label>
                <input
                  type="number"
                  value={examForm.passingGrade}
                  onChange={(e) =>
                    setExamForm({ ...examForm, passingGrade: Number(e.target.value) })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              {examForm.examType === 'multiple_choice' && (
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.randomizeQuestions}
                      onChange={(e) =>
                        setExamForm({ ...examForm, randomizeQuestions: e.target.checked })
                      }
                    />
                    <span>Acak Nomor Soal untuk Tiap Peserta</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.randomizeOptions}
                      onChange={(e) =>
                        setExamForm({ ...examForm, randomizeOptions: e.target.checked })
                      }
                    />
                    <span>Acak Urutan Pilihan Opsi Jawaban (A-E)</span>
                  </label>
                </div>
              )}

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowExamModal(false);
                    setEditingExamId(null);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  {editingExamId ? 'Simpan Perubahan Ujian' : 'Simpan Ujian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH RUANGAN */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Tambah Ruangan CBT Baru</h3>
            <form onSubmit={handleSaveRoom} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Ruangan:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: LAB-03"
                  value={roomForm.roomCode}
                  onChange={(e) => setRoomForm({ ...roomForm, roomCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Ruangan:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Lab Komputer Jaringan 03"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kapasitas Kursi:</label>
                  <input
                    type="number"
                    min={1}
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Gedung:</label>
                  <input
                    type="text"
                    placeholder="Gedung C Lt. 1"
                    value={roomForm.location}
                    onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  Simpan Ruangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH OPERATOR */}
      {showOperatorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Tambah Operator Ruangan Baru</h3>
            <form onSubmit={handleSaveOperator} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username Operator:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: operator3"
                  value={operatorForm.username}
                  onChange={(e) => setOperatorForm({ ...operatorForm, username: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi (SHA-1):</label>
                <input
                  type="password"
                  required
                  value={operatorForm.password}
                  onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email (Opsional):</label>
                <input
                  type="email"
                  placeholder="operator@instansi.go.id"
                  value={operatorForm.email || ''}
                  onChange={(e) => setOperatorForm({ ...operatorForm, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOperatorModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  Simpan Operator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BULK UPLOAD OPERATOR */}
      {showBulkOperatorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Import Operator Massal (CSV)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan file CSV sesuai template standar operator.
            </p>

            <div className="mt-4 space-y-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkOperatorFile(e.target.files?.[0] || null)}
                className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer"
              />

              {bulkOperatorResult && (
                <div className="p-3 bg-[#d1e7dd] border border-[#badbcc] rounded-xl text-xs text-[#0f5132]">
                  {bulkOperatorResult.message}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkOperatorModal(false);
                    setBulkOperatorFile(null);
                    setBulkOperatorResult(null);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={!bulkOperatorFile || bulkOperatorLoading}
                  onClick={handleBulkUploadOperators}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  {bulkOperatorLoading ? 'Mengimpor...' : 'Mulai Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TAMBAH PESERTA */}
      {showParticipantModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Tambah Peserta Seleksi</h3>
            <form onSubmit={handleSaveParticipant} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Peserta (Username):</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2026010"
                  value={participantForm.username}
                  onChange={(e) =>
                    setParticipantForm({ ...participantForm, username: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap peserta"
                  value={participantForm.name}
                  onChange={(e) => setParticipantForm({ ...participantForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi (SHA-1):</label>
                <input
                  type="password"
                  required
                  value={participantForm.password}
                  onChange={(e) =>
                    setParticipantForm({ ...participantForm, password: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ruangan:</label>
                  <select
                    value={participantForm.roomId}
                    onChange={(e) =>
                      setParticipantForm({ ...participantForm, roomId: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="">-- Pilih Ruangan --</option>
                    {roomsList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jadwal Ujian:</label>
                  <select
                    value={participantForm.examId}
                    onChange={(e) =>
                      setParticipantForm({ ...participantForm, examId: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="">-- Pilih Ujian --</option>
                    {examsList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowParticipantModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  Simpan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: BULK UPLOAD PARTICIPANTS */}
      {showBulkParticipantModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Upload Data Peserta Massal (CSV)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan file CSV sesuai template standar CAT.
            </p>

            <div className="mt-4 space-y-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkParticipantFile(e.target.files?.[0] || null)}
                className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer"
              />

              {bulkParticipantResult && (
                <div className="p-3 bg-[#d1e7dd] border border-[#badbcc] rounded-xl text-xs text-[#0f5132]">
                  {bulkParticipantResult.message}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkParticipantModal(false);
                    setBulkParticipantFile(null);
                    setBulkParticipantResult(null);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={!bulkParticipantFile || bulkParticipantLoading}
                  onClick={handleBulkUploadParticipants}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  {bulkParticipantLoading ? 'Mengimpor...' : 'Mulai Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: TAMBAH BUTIR SOAL */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Tambah Butir Soal Baru</h3>
            <form onSubmit={handleSaveQuestion} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Bank Soal (Kelompok):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bank Soal SKD TWK"
                  value={questionForm.bankName}
                  onChange={(e) => setQuestionForm({ ...questionForm, bankName: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Soal:</label>
                  <select
                    value={questionForm.questionType}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, questionType: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="multiple_choice">Pilihan Ganda (A-E)</option>
                    <option value="essay">Soal Essay / Uraian</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bobot Nilai (Poin):</label>
                  <input
                    type="number"
                    min={1}
                    value={questionForm.points}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, points: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Teks Pertanyaan:</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ketik teks pertanyaan soal..."
                  value={questionForm.content}
                  onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {questionForm.questionType === 'multiple_choice' ? (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">Pilihan Jawaban (A s/d E):</span>
                  {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                    <div key={opt} className="flex items-center space-x-2">
                      <span className="font-bold w-5">{opt}.</span>
                      <input
                        type="text"
                        placeholder={`Teks pilihan opsi ${opt}`}
                        value={questionForm[`option${opt}`]}
                        onChange={(e) =>
                          setQuestionForm({
                            ...questionForm,
                            [`option${opt}`]: e.target.value,
                          })
                        }
                        className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  ))}

                  <div className="pt-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kunci Jawaban Benar:
                    </label>
                    <select
                      value={questionForm.correctAnswer}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, correctAnswer: e.target.value })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                    >
                      <option value="A">Pilihan A</option>
                      <option value="B">Pilihan B</option>
                      <option value="C">Pilihan C</option>
                      <option value="D">Pilihan D</option>
                      <option value="E">Pilihan E</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pedoman Penilaian / Rubrik Kata Kunci:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan pedoman rubrik penskoran essay..."
                    value={questionForm.correctAnswer}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, correctAnswer: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pembahasan Soal (Opsional):</label>
                <input
                  type="text"
                  placeholder="Penjelasan pembahasan..."
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: BULK UPLOAD QUESTIONS */}
      {showBulkQuestionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Upload Bank Soal Massal (CSV)</h3>
            <p className="text-xs text-slate-500 mt-1">
              File CSV dapat menyertakan kolom <code>nama_bank_soal</code> untuk mengelompokkan ke bank soal terkait.
            </p>

            <div className="mt-4 space-y-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkQuestionFile(e.target.files?.[0] || null)}
                className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer"
              />

              {bulkQuestionResult && (
                <div className="p-3 bg-[#d1e7dd] border border-[#badbcc] rounded-xl text-xs text-[#0f5132]">
                  {bulkQuestionResult.message}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkQuestionModal(false);
                    setBulkQuestionFile(null);
                    setBulkQuestionResult(null);
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={!bulkQuestionFile || bulkQuestionLoading}
                  onClick={handleBulkUploadQuestions}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  {bulkQuestionLoading ? 'Mengimpor...' : 'Mulai Upload Soal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: TAMBAH KELOMPOK BANK SOAL */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Tambah Kelompok Bank Soal Baru</h3>
            <p className="text-xs text-slate-500 mt-1">
              Buat kelompok bank soal terlebih dahulu sebelum menambahkan butir soal atau import CSV.
            </p>
            <form onSubmit={handleCreateBankGroup} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Kelompok Bank Soal:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bank Soal SKD TWK 2026"
                  value={bankGroupForm.name}
                  onChange={(e) => setBankGroupForm({ ...bankGroupForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kategori / Rumpun Mata Uji:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: SKD / Wawasan Kebangsaan"
                  value={bankGroupForm.category}
                  onChange={(e) => setBankGroupForm({ ...bankGroupForm, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Keterangan:
                </label>
                <textarea
                  rows={3}
                  placeholder="Keterangan singkat mengenai cakupan materi atau peruntukan bank soal..."
                  value={bankGroupForm.description}
                  onChange={(e) => setBankGroupForm({ ...bankGroupForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="mt-6 flex space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF006E] hover:bg-[#e00062] rounded-xl shadow transition cursor-pointer"
                >
                  Simpan Kelompok
                </button>
              </div>
            </form>
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
