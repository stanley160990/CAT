export type UserRole = 'admin' | 'operator' | 'peserta';
export type ExamType = 'multiple_choice' | 'essay';
export type ExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed';
export type ParticipantStatus = 'registered' | 'ready' | 'testing' | 'finished';
export type QuestionType = 'multiple_choice' | 'essay';

export interface Room {
  id: number;
  roomCode: string;
  name: string;
  capacity: number;
  location: string;
  operatorName: string;
  participantCount?: number;
  createdAt?: string;
}

export interface QuestionBank {
  id: number;
  name: string;
  category?: string;
  description?: string;
  questionCount?: number;
  createdAt?: string;
}

export interface RoomOperatorAssignment {
  roomId: number;
  roomName: string;
  roomCode?: string;
  operatorId?: number | null;
  operatorUsername: string;
  operatorName: string;
}

export interface Exam {
  id: number;
  title: string;
  examType: ExamType;
  description: string;
  durationMinutes: number;
  scoringCorrect: number;
  scoringWrong: number;
  scoringEmpty: number;
  passingGrade: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  status: ExamStatus;
  bankName?: string;
  roomId?: number | null;
  roomIds?: number[];
  roomNames?: string;
  roomOperators?: RoomOperatorAssignment[];
  operatorId?: number | null;
  operatorName?: string;
  roomName?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  questionCount?: number;
  participantCount?: number;
  finishedCount?: number;
  createdAt?: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string | null;
  role: UserRole;
  roomId?: number | null;
  examId?: number | null;
  extraTimeMinutes: number;
  examStatus: ParticipantStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  roomName?: string;
  examTitle?: string;
  score?: number | null;
  room?: Room | null;
  exam?: Exam | null;
  createdAt?: string;
}

export interface QuestionOption {
  key: string; // 'A', 'B', 'C', 'D', 'E'
  originalKey: string;
  text: string;
}

export interface Question {
  id: number;
  examId: number;
  bankName: string;
  questionOrder: number;
  displayNumber?: number;
  questionType: QuestionType;
  content: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  correctAnswer?: string | null;
  points: number;
  explanation?: string | null;
  options?: QuestionOption[];
}

export interface ParticipantAnswer {
  id?: number;
  userId: number;
  examId: number;
  questionId: number;
  selectedOption?: string | null;
  essayAnswer?: string | null;
  isDoubtful: boolean;
  score?: number;
  isCorrect?: boolean | null;
  essayFeedback?: string | null;
  updatedAt?: string;
}

export interface ExamResult {
  id: number;
  userId: number;
  examId: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  mcqScore: number;
  essayScore: number;
  totalScore: number;
  isPassed: boolean;
  submittedAt: string;
}

export interface SystemStatus {
  success: boolean;
  userCount: number;
  roomCount: number;
  examCount: number;
  questionCount: number;
  resultCount: number;
}
