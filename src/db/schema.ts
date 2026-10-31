import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Rooms (Ruangan CAT)
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(30),
  location: text('location').notNull().default(''),
  operatorName: text('operator_name').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Exams (Ujian - Hanya 'multiple_choice' atau 'essay')
export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  examType: text('exam_type').notNull().default('multiple_choice'), // 'multiple_choice' atau 'essay'
  description: text('description').notNull().default(''),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  scoringCorrect: integer('scoring_correct').notNull().default(4), // Poin benar (khusus PG)
  scoringWrong: integer('scoring_wrong').notNull().default(0), // Poin salah (khusus PG)
  scoringEmpty: integer('scoring_empty').notNull().default(0), // Poin kosong (khusus PG)
  passingGrade: integer('passing_grade').notNull().default(65),
  randomizeQuestions: boolean('randomize_questions').notNull().default(true),
  randomizeOptions: boolean('randomize_options').notNull().default(true),
  status: text('status').notNull().default('draft'), // 'draft', 'scheduled', 'ongoing', 'completed'
  bankName: text('bank_name').default('Bank Soal Utama'),
  roomId: integer('room_id').references(() => rooms.id),
  roomIds: text('room_ids').default('[]'), // Multi-ruangan JSON array of IDs: "[1, 2]"
  roomNames: text('room_names').default(''), // Multi-ruangan string: "Lab CBT 01, Lab CBT 02"
  roomOperators: text('room_operators').default('[]'), // JSON array of [{ roomId, roomName, operatorUsername, operatorName }]
  operatorId: integer('operator_id'),
  operatorName: text('operator_name').default(''),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2.5. Question Banks (Kelompok Bank Soal)
export const questionBanks = pgTable('question_banks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  category: text('category').default('Umum'),
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Users (Peserta, Operator Ruangan, Admin Keseluruhan)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(), // Nomor Peserta atau ID Login
  passwordHash: text('password_hash').notNull(), // SHA-1 hash of password
  name: text('name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('peserta'), // 'admin', 'operator', 'peserta'
  roomId: integer('room_id').references(() => rooms.id),
  examId: integer('exam_id').references(() => exams.id),
  extraTimeMinutes: integer('extra_time_minutes').notNull().default(0), // Penambahan waktu dari operator
  examStatus: text('exam_status').notNull().default('registered'), // 'registered', 'ready', 'testing', 'finished'
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Questions (Bank Soal)
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id').references(() => exams.id).notNull(),
  bankName: text('bank_name').notNull().default('Bank Soal Utama'), // Kelompok Bank Soal
  questionOrder: integer('question_order').notNull().default(1),
  questionType: text('question_type').notNull().default('multiple_choice'), // 'multiple_choice', 'essay'
  content: text('content').notNull(),
  optionA: text('option_a'),
  optionB: text('option_b'),
  optionC: text('option_c'),
  optionD: text('option_d'),
  optionE: text('option_e'),
  correctAnswer: text('correct_answer'), // 'A', 'B', 'C', 'D', 'E' (untuk PG) atau pedoman nilai (untuk essay)
  points: integer('points').notNull().default(5),
  explanation: text('explanation'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Participant Answers (Lembar Jawaban Peserta)
export const participantAnswers = pgTable('participant_answers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  examId: integer('exam_id').references(() => exams.id).notNull(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  selectedOption: text('selected_option'), // 'A' | 'B' | 'C' | 'D' | 'E'
  essayAnswer: text('essay_answer'),
  isDoubtful: boolean('is_doubtful').notNull().default(false), // ragu-ragu
  score: integer('score').notNull().default(0),
  isCorrect: boolean('is_correct'),
  essayFeedback: text('essay_feedback'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Exam Results (Hasil Akhir Ujian)
export const examResults = pgTable('exam_results', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  examId: integer('exam_id').references(() => exams.id).notNull(),
  totalQuestions: integer('total_questions').notNull().default(0),
  answeredCount: integer('answered_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  wrongCount: integer('wrong_count').notNull().default(0),
  emptyCount: integer('empty_count').notNull().default(0),
  mcqScore: integer('mcq_score').notNull().default(0),
  essayScore: integer('essay_score').notNull().default(0),
  totalScore: integer('total_score').notNull().default(0),
  isPassed: boolean('is_passed').notNull().default(false),
  submittedAt: timestamp('submitted_at').defaultNow(),
});

// Relations
export const roomsRelations = relations(rooms, ({ many }) => ({
  users: many(users),
  exams: many(exams),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  room: one(rooms, {
    fields: [exams.roomId],
    references: [rooms.id],
  }),
  questions: many(questions),
  users: many(users),
  results: many(examResults),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  room: one(rooms, {
    fields: [users.roomId],
    references: [rooms.id],
  }),
  exam: one(exams, {
    fields: [users.examId],
    references: [exams.id],
  }),
  answers: many(participantAnswers),
  results: many(examResults),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [questions.examId],
    references: [exams.id],
  }),
  answers: many(participantAnswers),
}));

export const participantAnswersRelations = relations(participantAnswers, ({ one }) => ({
  user: one(users, {
    fields: [participantAnswers.userId],
    references: [users.id],
  }),
  question: one(questions, {
    fields: [participantAnswers.questionId],
    references: [questions.id],
  }),
  exam: one(exams, {
    fields: [participantAnswers.examId],
    references: [exams.id],
  }),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  user: one(users, {
    fields: [examResults.userId],
    references: [users.id],
  }),
  exam: one(exams, {
    fields: [examResults.examId],
    references: [exams.id],
  }),
}));
