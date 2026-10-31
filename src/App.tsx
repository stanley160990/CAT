/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Exam, ExamResult } from './types/cat.ts';
import { getAuthUser, saveAuthUser, clearAuthUser, apiRequest } from './lib/api.ts';
import { Navbar } from './components/Navbar.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { WaitingRoom } from './components/peserta/WaitingRoom.tsx';
import { ExamSheet } from './components/peserta/ExamSheet.tsx';
import { ExamResultView } from './components/peserta/ExamResultView.tsx';
import { OperatorDashboard } from './components/operator/OperatorDashboard.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Student workflow state: 'waiting' | 'taking_exam' | 'result'
  const [pesertaView, setPesertaView] = useState<'waiting' | 'taking_exam' | 'result'>('waiting');
  const [finishedResult, setFinishedResult] = useState<ExamResult | null>(null);
  const [finishedExam, setFinishedExam] = useState<Exam | null>(null);

  // Load existing session on mount
  useEffect(() => {
    const saved = getAuthUser();
    if (saved) {
      setCurrentUser(saved);
      if (saved.role === 'peserta') {
        if (saved.examStatus === 'finished') {
          setPesertaView('result');
          // Fetch existing result
          if (saved.id && saved.examId) {
            apiRequest(`/api/exam/participant-status/${saved.id}`).then((res) => {
              if (res.success && res.result) {
                setFinishedResult(res.result);
                setFinishedExam(res.exam);
              }
            });
          }
        } else if (saved.examStatus === 'testing') {
          setPesertaView('taking_exam');
        } else {
          setPesertaView('waiting');
        }
      }
    }
    setLoadingUser(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'peserta') {
      if (user.examStatus === 'finished') {
        setPesertaView('result');
        if (user.id && user.examId) {
          apiRequest(`/api/exam/participant-status/${user.id}`).then((res) => {
            if (res.success && res.result) {
              setFinishedResult(res.result);
              setFinishedExam(res.exam);
            }
          });
        }
      } else if (user.examStatus === 'testing') {
        setPesertaView('taking_exam');
      } else {
        setPesertaView('waiting');
      }
    }
  };

  const handleLogout = () => {
    clearAuthUser();
    setCurrentUser(null);
    setPesertaView('waiting');
    setFinishedResult(null);
    setFinishedExam(null);
  };


  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {/* Role 1: Super Admin */}
        {currentUser.role === 'admin' && <AdminDashboard currentUser={currentUser} />}

        {/* Role 2: Operator Ruangan */}
        {currentUser.role === 'operator' && <OperatorDashboard currentUser={currentUser} />}

        {/* Role 3: Peserta Ujian */}
        {currentUser.role === 'peserta' && (
          <>
            {pesertaView === 'waiting' && (
              <WaitingRoom
                user={currentUser}
                onStartExam={() => setPesertaView('taking_exam')}
              />
            )}

            {pesertaView === 'taking_exam' && (
              <ExamSheet
                user={currentUser}
                onFinishExam={(result, exam) => {
                  setFinishedResult(result);
                  setFinishedExam(exam);
                  setPesertaView('result');
                }}
              />
            )}

            {pesertaView === 'result' && (
              <ExamResultView
                user={currentUser}
                exam={finishedExam || (currentUser.exam as any) || { title: 'Ujian CAT', passingGrade: 65, examType: 'mix' }}
                result={
                  finishedResult || {
                    id: 0,
                    userId: currentUser.id,
                    examId: currentUser.examId || 0,
                    totalQuestions: 7,
                    answeredCount: 7,
                    correctCount: 5,
                    wrongCount: 0,
                    emptyCount: 0,
                    mcqScore: 25,
                    essayScore: 0,
                    totalScore: 25,
                    isPassed: false,
                    submittedAt: new Date().toISOString(),
                  }
                }
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
