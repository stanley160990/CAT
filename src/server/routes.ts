import { Router } from 'express';
import { db } from '../db/index.ts';
import { users, rooms, exams, questions, participantAnswers, examResults, questionBanks } from '../db/schema.ts';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './crypto.ts';
import { checkAndAutoInitIfEmpty } from './seed.ts';

const router = Router();

// ==========================================
// SYSTEM & SEED ENDPOINTS
// ==========================================
router.get('/system/status', async (_req, res) => {
  try {
    const [uCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [rCount] = await db.select({ count: sql<number>`count(*)` }).from(rooms);
    const [eCount] = await db.select({ count: sql<number>`count(*)` }).from(exams);
    const [qCount] = await db.select({ count: sql<number>`count(*)` }).from(questions);
    const [resCount] = await db.select({ count: sql<number>`count(*)` }).from(examResults);

    res.json({
      success: true,
      userCount: Number(uCount?.count ?? 0),
      roomCount: Number(rCount?.count ?? 0),
      examCount: Number(eCount?.count ?? 0),
      questionCount: Number(qCount?.count ?? 0),
      resultCount: Number(resCount?.count ?? 0),
    });
  } catch (error: any) {
    console.error('System status error:', error);
    res.status(500).json({ success: false, error: error.message || 'Database error' });
  }
});

router.post('/system/init-seed', async (req, res) => {
  try {
    const force = Boolean(req.body.force);
    const result = await checkAndAutoInitIfEmpty(force);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AUTHENTICATION
// ==========================================
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan password wajib diisi' });
    }

    const trimmedUser = String(username).trim();
    const foundUsers = await db.select().from(users).where(eq(users.username, trimmedUser)).limit(1);

    if (foundUsers.length === 0) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    const user = foundUsers[0];
    const isMatch = verifyPassword(String(password), user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    let activeRoomId = user.roomId;
    let activeExamId = user.examId;

    if (user.role === 'operator') {
      const allExams = await db.select().from(exams).orderBy(desc(exams.id));
      for (const ex of allExams) {
        if (ex.roomOperators) {
          try {
            const parsed = JSON.parse(ex.roomOperators);
            const match = parsed.find(
              (p: any) =>
                (p.operatorUsername && p.operatorUsername === user.username) ||
                (p.operatorId && p.operatorId === user.id)
            );
            if (match && match.roomId) {
              activeRoomId = match.roomId;
              activeExamId = ex.id;
              // Keep users record in sync
              await db
                .update(users)
                .set({ roomId: match.roomId, examId: ex.id })
                .where(eq(users.id, user.id));
              break;
            }
          } catch {}
        }
      }
    }

    let roomInfo = null;
    let examInfo = null;
    if (activeRoomId) {
      const roomRes = await db.select().from(rooms).where(eq(rooms.id, activeRoomId)).limit(1);
      if (roomRes.length > 0) roomInfo = roomRes[0];
    }
    if (activeExamId) {
      const examRes = await db.select().from(exams).where(eq(exams.id, activeExamId)).limit(1);
      if (examRes.length > 0) examInfo = examRes[0];
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        roomId: activeRoomId,
        examId: activeExamId,
        extraTimeMinutes: user.extraTimeMinutes,
        examStatus: user.examStatus,
        room: roomInfo,
        exam: examInfo,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message || 'Login failed' });
  }
});

// ==========================================
// OPERATOR MANAGEMENT (ADMIN ROOM OPERATORS)
// ==========================================
router.get('/operators', async (_req, res) => {
  try {
    const ops = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        roomId: users.roomId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, 'operator'))
      .orderBy(asc(users.id));

    const enriched = await Promise.all(
      ops.map(async (op) => {
        let roomName = '-';
        if (op.roomId) {
          const [r] = await db.select().from(rooms).where(eq(rooms.id, op.roomId));
          if (r) roomName = r.name;
        }
        return { ...op, roomName };
      })
    );

    res.json({ success: true, operators: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/operators', async (req, res) => {
  try {
    const { username, password, name, email, roomId } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, error: 'Username, password, dan nama wajib diisi' });
    }

    const cleanUsername = String(username).trim();
    const hash = hashPassword(String(password));

    const [created] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        passwordHash: hash,
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        role: 'operator',
        roomId: roomId ? Number(roomId) : null,
      })
      .returning();

    // If roomId provided, update operatorName in room
    if (roomId) {
      await db
        .update(rooms)
        .set({ operatorName: created.name })
        .where(eq(rooms.id, Number(roomId)));
    }

    res.json({ success: true, operator: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/operators/bulk-upload', async (req, res) => {
  try {
    const { rows, defaultRoomId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Data file operator kosong' });
    }

    let insertedCount = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const username = String(row.username || row.nomor_operator || row.id || '').trim();
      const name = String(row.nama || row.nama_lengkap || row.name || '').trim();
      const rawPass = String(row.password || 'operator123').trim();
      const email = String(row.email || '').trim();
      const roomId = row.room_id ? Number(row.room_id) : (defaultRoomId ? Number(defaultRoomId) : null);

      if (!username || !name) {
        errors.push(`Baris ${i + 1}: username atau nama kosong.`);
        continue;
      }

      try {
        const hash = hashPassword(rawPass);
        await db
          .insert(users)
          .values({
            username,
            passwordHash: hash,
            name,
            email: email || null,
            role: 'operator',
            roomId,
          })
          .onConflictDoUpdate({
            target: users.username,
            set: {
              name,
              passwordHash: hash,
              email: email || null,
              roomId,
            },
          });
        insertedCount++;
      } catch (err: any) {
        errors.push(`Baris ${i + 1} (${username}): ${err.message}`);
      }
    }

    res.json({
      success: true,
      insertedCount,
      errors,
      message: `Berhasil mengimpor ${insertedCount} operator ruangan.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/operators/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, password, name, email, roomId } = req.body;

    const updateData: any = {};
    if (username) updateData.username = String(username).trim();
    if (password) updateData.passwordHash = hashPassword(String(password));
    if (name) updateData.name = String(name).trim();
    if (email !== undefined) updateData.email = email ? String(email).trim() : null;
    if (roomId !== undefined) updateData.roomId = roomId ? Number(roomId) : null;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    res.json({ success: true, operator: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/operators/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ROOMS (RUANGAN) MANAGEMENT
// ==========================================
router.get('/rooms', async (_req, res) => {
  try {
    const allRooms = await db.select().from(rooms).orderBy(asc(rooms.id));
    const enriched = await Promise.all(
      allRooms.map(async (r) => {
        const [pCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.roomId, r.id), eq(users.role, 'peserta')));
        return {
          ...r,
          participantCount: Number(pCount?.count ?? 0),
        };
      })
    );
    res.json({ success: true, rooms: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { roomCode, name, capacity, location, operatorName } = req.body;
    if (!roomCode || !name) {
      return res.status(400).json({ success: false, error: 'Kode ruangan dan Nama ruangan wajib diisi' });
    }

    const [created] = await db
      .insert(rooms)
      .values({
        roomCode: String(roomCode).trim().toUpperCase(),
        name: String(name).trim(),
        capacity: Number(capacity) || 30,
        location: String(location || ''),
        operatorName: String(operatorName || ''),
      })
      .returning();

    res.json({ success: true, room: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { roomCode, name, capacity, location, operatorName } = req.body;

    const [updated] = await db
      .update(rooms)
      .set({
        roomCode: roomCode ? String(roomCode).trim().toUpperCase() : undefined,
        name: name ? String(name).trim() : undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        location: location !== undefined ? String(location) : undefined,
        operatorName: operatorName !== undefined ? String(operatorName) : undefined,
      })
      .where(eq(rooms.id, id))
      .returning();

    res.json({ success: true, room: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(users).set({ roomId: null }).where(eq(users.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// BANK SOAL (QUESTION BANK GROUPS & LISTING)
// ==========================================
router.get('/bank-soal/groups', async (_req, res) => {
  try {
    const groups = await db.select().from(questionBanks).orderBy(asc(questionBanks.name));
    const enriched = await Promise.all(
      groups.map(async (g) => {
        const [qCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.bankName, g.name));
        return {
          ...g,
          questionCount: Number(qCount?.count ?? 0),
        };
      })
    );
    res.json({ success: true, groups: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bank-soal/groups', async (req, res) => {
  try {
    const { name, category, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Nama kelompok bank soal wajib diisi' });
    }

    const cleanName = String(name).trim();
    // Check if exists
    const [existing] = await db
      .select()
      .from(questionBanks)
      .where(eq(questionBanks.name, cleanName))
      .limit(1);

    if (existing) {
      return res.status(400).json({ success: false, error: `Kelompok bank soal "${cleanName}" sudah ada` });
    }

    const [created] = await db
      .insert(questionBanks)
      .values({
        name: cleanName,
        category: category ? String(category).trim() : 'Umum',
        description: description ? String(description).trim() : '',
      })
      .returning();

    res.json({ success: true, group: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/bank-soal/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [group] = await db.select().from(questionBanks).where(eq(questionBanks.id, id)).limit(1);
    if (!group) return res.status(404).json({ success: false, error: 'Kelompok bank soal tidak ditemukan' });

    // Delete group
    await db.delete(questionBanks).where(eq(questionBanks.id, id));
    res.json({ success: true, message: `Kelompok bank soal "${group.name}" berhasil dihapus.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bank-soal', async (_req, res) => {
  try {
    // List distinct bank names from questionBanks table as well as questions
    const allGroups = await db.select().from(questionBanks).orderBy(asc(questionBanks.name));
    const bankStats = await db
      .select({
        bankName: questions.bankName,
        count: sql<number>`count(*)`,
      })
      .from(questions)
      .groupBy(questions.bankName);

    const map = new Map<string, any>();

    // First populate from questionBanks table
    for (const g of allGroups) {
      map.set(g.name, {
        id: g.id,
        bankName: g.name,
        category: g.category || 'Umum',
        description: g.description || '',
        totalQuestions: 0,
      });
    }

    // Merge counts from questions
    for (const b of bankStats) {
      const name = b.bankName || 'Bank Soal Utama';
      if (!map.has(name)) {
        map.set(name, {
          bankName: name,
          category: 'Umum',
          description: '',
          totalQuestions: Number(b.count),
        });
      } else {
        const entry = map.get(name);
        entry.totalQuestions = Number(b.count);
      }
    }

    res.json({ success: true, banks: Array.from(map.values()) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bank-soal/questions/:bankName', async (req, res) => {
  try {
    const bankName = decodeURIComponent(req.params.bankName);
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.bankName, bankName))
      .orderBy(asc(questions.questionOrder), asc(questions.id));
    res.json({ success: true, questions: qs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bank-soal/questions', async (req, res) => {
  try {
    const {
      bankName,
      questionType,
      content,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctAnswer,
      points,
      explanation,
    } = req.body;

    if (!content) return res.status(400).json({ success: false, error: 'Isi butir soal wajib diisi' });
    if (!bankName) return res.status(400).json({ success: false, error: 'Kelompok bank soal wajib ditentukan' });

    // Find any exam associated with this bank, or default to 1
    const [matchingExam] = await db.select().from(exams).where(eq(exams.bankName, String(bankName).trim())).limit(1);
    const examId = matchingExam ? matchingExam.id : 1;

    const [qCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.bankName, String(bankName).trim()));
    const nextOrder = Number(qCount?.count ?? 0) + 1;

    const [created] = await db
      .insert(questions)
      .values({
        examId,
        bankName: String(bankName).trim(),
        questionOrder: nextOrder,
        questionType: questionType === 'essay' ? 'essay' : 'multiple_choice',
        content: String(content).trim(),
        optionA: optionA ? String(optionA).trim() : null,
        optionB: optionB ? String(optionB).trim() : null,
        optionC: optionC ? String(optionC).trim() : null,
        optionD: optionD ? String(optionD).trim() : null,
        optionE: optionE ? String(optionE).trim() : null,
        correctAnswer: correctAnswer ? String(correctAnswer).trim() : 'A',
        points: Number(points) || 5,
        explanation: explanation ? String(explanation).trim() : null,
      })
      .returning();

    res.json({ success: true, question: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// EXAMS (UJIAN) MANAGEMENT
// ==========================================
router.get('/exams', async (_req, res) => {
  try {
    const allExams = await db.select().from(exams).orderBy(desc(exams.id));
    const enriched = await Promise.all(
      allExams.map(async (e) => {
        const [qCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.examId, e.id));
        const [pCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.examId, e.id), eq(users.role, 'peserta')));
        const [finCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.examId, e.id), eq(users.role, 'peserta'), eq(users.examStatus, 'finished')));

        let parsedRoomIds: number[] = [];
        try {
          parsedRoomIds = e.roomIds ? JSON.parse(e.roomIds) : (e.roomId ? [e.roomId] : []);
        } catch {
          parsedRoomIds = e.roomId ? [e.roomId] : [];
        }

        let parsedRoomOperators: any[] = [];
        try {
          parsedRoomOperators = e.roomOperators ? JSON.parse(e.roomOperators) : [];
        } catch {
          parsedRoomOperators = [];
        }

        let roomNames = e.roomNames || '';
        if (!roomNames && parsedRoomIds.length > 0) {
          const matched = await db.select().from(rooms).where(inArray(rooms.id, parsedRoomIds));
          roomNames = matched.map((r) => r.name).join(', ');
        } else if (!roomNames && e.roomId) {
          const [r] = await db.select().from(rooms).where(eq(rooms.id, e.roomId)).limit(1);
          if (r) roomNames = r.name;
        }

        return {
          ...e,
          roomIds: parsedRoomIds,
          roomOperators: parsedRoomOperators,
          roomNames: roomNames || 'Semua Ruangan',
          roomName: roomNames || '-',
          questionCount: Number(qCount?.count ?? 0),
          participantCount: Number(pCount?.count ?? 0),
          finishedCount: Number(finCount?.count ?? 0),
        };
      })
    );
    res.json({ success: true, exams: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exams/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [exam] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    let parsedRoomIds: number[] = [];
    try {
      parsedRoomIds = exam.roomIds ? JSON.parse(exam.roomIds) : (exam.roomId ? [exam.roomId] : []);
    } catch {
      parsedRoomIds = exam.roomId ? [exam.roomId] : [];
    }

    let parsedRoomOperators: any[] = [];
    try {
      parsedRoomOperators = exam.roomOperators ? JSON.parse(exam.roomOperators) : [];
    } catch {
      parsedRoomOperators = [];
    }

    const [qCount] = await db.select({ count: sql<number>`count(*)` }).from(questions).where(eq(questions.examId, id));
    res.json({
      success: true,
      exam: {
        ...exam,
        roomIds: parsedRoomIds,
        roomOperators: parsedRoomOperators,
        questionCount: Number(qCount?.count ?? 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exams', async (req, res) => {
  try {
    const {
      title,
      examType, // 'multiple_choice' or 'essay'
      description,
      durationMinutes,
      scoringCorrect,
      scoringWrong,
      scoringEmpty,
      passingGrade,
      randomizeQuestions,
      randomizeOptions,
      bankName,
      roomId,
      roomIds, // array of room IDs
      roomOperators, // array of { roomId, roomName, operatorUsername, operatorName }
      operatorName,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Judul ujian wajib diisi' });
    }

    const cleanExamType = examType === 'essay' ? 'essay' : 'multiple_choice';

    // Parse multiple room IDs
    let cleanRoomIds: number[] = [];
    if (Array.isArray(roomIds)) {
      cleanRoomIds = roomIds.map(Number).filter((id) => !isNaN(id) && id > 0);
    } else if (roomId) {
      cleanRoomIds = [Number(roomId)];
    }

    // Parse room operator assignments
    let cleanRoomOperators: any[] = [];
    if (Array.isArray(roomOperators)) {
      cleanRoomOperators = roomOperators.map((ro) => ({
        roomId: Number(ro.roomId),
        roomName: String(ro.roomName || ''),
        roomCode: String(ro.roomCode || ''),
        operatorId: ro.operatorId ? Number(ro.operatorId) : null,
        operatorUsername: String(ro.operatorUsername || '').trim(),
        operatorName: String(ro.operatorName || ro.operatorUsername || '').trim(),
      }));
    }

    // Resolve room names for display
    let roomNames = '';
    if (cleanRoomIds.length > 0) {
      const matched = await db.select().from(rooms).where(inArray(rooms.id, cleanRoomIds));
      roomNames = matched.map((r) => r.name).join(', ');
    }

    const [created] = await db
      .insert(exams)
      .values({
        title: String(title).trim(),
        examType: cleanExamType,
        description: String(description || ''),
        durationMinutes: Number(durationMinutes) || 60,
        scoringCorrect: cleanExamType === 'multiple_choice' ? (scoringCorrect !== undefined ? Number(scoringCorrect) : 4) : 0,
        scoringWrong: cleanExamType === 'multiple_choice' ? (scoringWrong !== undefined ? Number(scoringWrong) : 0) : 0,
        scoringEmpty: cleanExamType === 'multiple_choice' ? (scoringEmpty !== undefined ? Number(scoringEmpty) : 0) : 0,
        passingGrade: passingGrade !== undefined ? Number(passingGrade) : 65,
        randomizeQuestions: randomizeQuestions !== undefined ? Boolean(randomizeQuestions) : true,
        randomizeOptions: randomizeOptions !== undefined ? Boolean(randomizeOptions) : true,
        bankName: bankName ? String(bankName).trim() : 'Bank Soal Utama',
        roomId: cleanRoomIds[0] || null,
        roomIds: JSON.stringify(cleanRoomIds),
        roomNames,
        roomOperators: JSON.stringify(cleanRoomOperators),
        operatorName: operatorName ? String(operatorName).trim() : '',
        status: 'draft',
      })
      .returning();

    // Assign operators specifically to their selected rooms
    for (const ro of cleanRoomOperators) {
      if (ro.operatorUsername) {
        await db
          .update(users)
          .set({ roomId: ro.roomId, examId: created.id })
          .where(and(eq(users.username, ro.operatorUsername), eq(users.role, 'operator')));
      }
    }

    // If a bankName was chosen, associate questions from that bank to this exam
    if (bankName) {
      await db
        .update(questions)
        .set({ examId: created.id })
        .where(eq(questions.bankName, String(bankName).trim()));
    }

    res.json({
      success: true,
      exam: {
        ...created,
        roomIds: cleanRoomIds,
        roomNames,
        roomOperators: cleanRoomOperators,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/exams/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title,
      examType,
      description,
      durationMinutes,
      scoringCorrect,
      scoringWrong,
      scoringEmpty,
      passingGrade,
      randomizeQuestions,
      randomizeOptions,
      bankName,
      roomId,
      roomIds,
      roomOperators,
      operatorName,
      status,
    } = req.body;

    const isEssay = examType === 'essay';

    const updateFields: any = {};
    if (title) updateFields.title = String(title).trim();
    if (examType) updateFields.examType = isEssay ? 'essay' : 'multiple_choice';
    if (description !== undefined) updateFields.description = String(description);
    if (durationMinutes !== undefined) updateFields.durationMinutes = Number(durationMinutes);
    if (isEssay) {
      updateFields.scoringCorrect = 0;
      updateFields.scoringWrong = 0;
      updateFields.scoringEmpty = 0;
    } else {
      if (scoringCorrect !== undefined) updateFields.scoringCorrect = Number(scoringCorrect);
      if (scoringWrong !== undefined) updateFields.scoringWrong = Number(scoringWrong);
      if (scoringEmpty !== undefined) updateFields.scoringEmpty = Number(scoringEmpty);
    }
    if (passingGrade !== undefined) updateFields.passingGrade = Number(passingGrade);
    if (randomizeQuestions !== undefined) updateFields.randomizeQuestions = Boolean(randomizeQuestions);
    if (randomizeOptions !== undefined) updateFields.randomizeOptions = Boolean(randomizeOptions);
    if (bankName) updateFields.bankName = String(bankName).trim();
    if (operatorName !== undefined) updateFields.operatorName = String(operatorName).trim();
    if (status) updateFields.status = String(status);

    if (roomIds !== undefined) {
      let cleanIds: number[] = [];
      if (Array.isArray(roomIds)) {
        cleanIds = roomIds.map(Number).filter((id) => !isNaN(id) && id > 0);
      } else if (roomIds) {
        cleanIds = [Number(roomIds)];
      }
      updateFields.roomIds = JSON.stringify(cleanIds);
      updateFields.roomId = cleanIds[0] || null;

      if (cleanIds.length > 0) {
        const matched = await db.select().from(rooms).where(inArray(rooms.id, cleanIds));
        updateFields.roomNames = matched.map((r) => r.name).join(', ');
      } else {
        updateFields.roomNames = '';
      }
    } else if (roomId !== undefined) {
      updateFields.roomId = roomId ? Number(roomId) : null;
    }

    if (roomOperators !== undefined) {
      let cleanRoomOperators: any[] = [];
      if (Array.isArray(roomOperators)) {
        cleanRoomOperators = roomOperators.map((ro) => ({
          roomId: Number(ro.roomId),
          roomName: String(ro.roomName || ''),
          roomCode: String(ro.roomCode || ''),
          operatorId: ro.operatorId ? Number(ro.operatorId) : null,
          operatorUsername: String(ro.operatorUsername || '').trim(),
          operatorName: String(ro.operatorName || ro.operatorUsername || '').trim(),
        }));
      }
      updateFields.roomOperators = JSON.stringify(cleanRoomOperators);

      // Update operator user accounts to point to this room and exam
      for (const ro of cleanRoomOperators) {
        if (ro.operatorUsername) {
          await db
            .update(users)
            .set({ roomId: ro.roomId, examId: id })
            .where(and(eq(users.username, ro.operatorUsername), eq(users.role, 'operator')));
        }
      }
    }

    const [updated] = await db
      .update(exams)
      .set(updateFields)
      .where(eq(exams.id, id))
      .returning();

    if (bankName) {
      await db
        .update(questions)
        .set({ examId: id })
        .where(eq(questions.bankName, String(bankName).trim()));
    }

    res.json({ success: true, exam: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exams/:id/start', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(exams)
      .set({
        status: 'ongoing',
        startedAt: new Date(),
      })
      .where(eq(exams.id, id))
      .returning();

    await db
      .update(users)
      .set({ examStatus: 'ready' })
      .where(and(eq(users.examId, id), eq(users.examStatus, 'registered')));

    res.json({ success: true, exam: updated, message: 'Ujian berhasil dimulai oleh Admin Utama!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exams/:id/end', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(exams)
      .set({
        status: 'completed',
        endedAt: new Date(),
      })
      .where(eq(exams.id, id))
      .returning();

    await db
      .update(users)
      .set({ examStatus: 'finished', finishedAt: new Date() })
      .where(and(eq(users.examId, id), eq(users.role, 'peserta')));

    res.json({ success: true, exam: updated, message: 'Ujian berhasil diakhiri secara keseluruhan!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/exams/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(examResults).where(eq(examResults.examId, id));
    await db.delete(participantAnswers).where(eq(participantAnswers.examId, id));
    await db.delete(questions).where(eq(questions.examId, id));
    await db.update(users).set({ examId: null }).where(eq(users.examId, id));
    await db.delete(exams).where(eq(exams.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PARTICIPANTS (PESERTA) MANAGEMENT
// ==========================================
router.get('/participants', async (req, res) => {
  try {
    const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;
    const examId = req.query.examId ? Number(req.query.examId) : undefined;
    const role = req.query.role ? String(req.query.role) : undefined;

    let conditions = [];
    if (roomId) conditions.push(eq(users.roomId, roomId));
    if (examId) conditions.push(eq(users.examId, examId));
    if (role) {
      conditions.push(eq(users.role, role));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        roomId: users.roomId,
        examId: users.examId,
        extraTimeMinutes: users.extraTimeMinutes,
        examStatus: users.examStatus,
        startedAt: users.startedAt,
        finishedAt: users.finishedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(asc(users.id));

    const enriched = await Promise.all(
      allUsers.map(async (u) => {
        let roomName = '-';
        let examTitle = '-';
        let score = null;
        if (u.roomId) {
          const [r] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, u.roomId));
          if (r) roomName = r.name;
        }
        if (u.examId) {
          const [e] = await db.select({ title: exams.title }).from(exams).where(eq(exams.id, u.examId));
          if (e) examTitle = e.title;

          const [resRecord] = await db
            .select()
            .from(examResults)
            .where(and(eq(examResults.userId, u.id), eq(examResults.examId, u.examId)))
            .limit(1);
          if (resRecord) score = resRecord.totalScore;
        }

        return {
          ...u,
          roomName,
          examTitle,
          score,
        };
      })
    );

    res.json({ success: true, participants: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/participants', async (req, res) => {
  try {
    const { username, password, name, email, role, roomId, examId } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, error: 'Username, password, dan nama wajib diisi' });
    }

    const cleanUsername = String(username).trim();
    const hash = hashPassword(String(password));

    const [created] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        passwordHash: hash,
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        role: role || 'peserta',
        roomId: roomId ? Number(roomId) : null,
        examId: examId ? Number(examId) : null,
        examStatus: 'registered',
      })
      .returning();

    res.json({ success: true, participant: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/participants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, password, name, email, roomId, examId, role } = req.body;

    const updateData: any = {};
    if (username) updateData.username = String(username).trim();
    if (password) updateData.passwordHash = hashPassword(String(password));
    if (name) updateData.name = String(name).trim();
    if (email !== undefined) updateData.email = email ? String(email).trim() : null;
    if (roomId !== undefined) updateData.roomId = roomId ? Number(roomId) : null;
    if (examId !== undefined) updateData.examId = examId ? Number(examId) : null;
    if (role) updateData.role = String(role);

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    res.json({ success: true, participant: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/participants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(examResults).where(eq(examResults.userId, id));
    await db.delete(participantAnswers).where(eq(participantAnswers.userId, id));
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/participants/bulk-upload', async (req, res) => {
  try {
    const { rows, defaultRoomId, defaultExamId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Data baris peserta kosong atau tidak valid' });
    }

    let insertedCount = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const username = String(row.nomor_peserta || row.username || row.no_peserta || '').trim();
      const name = String(row.nama_lengkap || row.nama || row.name || '').trim();
      const rawPass = String(row.password || 'peserta123').trim();
      const email = String(row.email || '').trim();
      const roomId = row.room_id ? Number(row.room_id) : (defaultRoomId ? Number(defaultRoomId) : null);
      const examId = row.exam_id ? Number(row.exam_id) : (defaultExamId ? Number(defaultExamId) : null);

      if (!username || !name) {
        errors.push(`Baris ${i + 1}: username atau nama kosong.`);
        continue;
      }

      try {
        const hash = hashPassword(rawPass);
        await db
          .insert(users)
          .values({
            username,
            passwordHash: hash,
            name,
            email: email || null,
            role: 'peserta',
            roomId,
            examId,
            examStatus: 'registered',
          })
          .onConflictDoUpdate({
            target: users.username,
            set: {
              name,
              passwordHash: hash,
              email: email || null,
              roomId,
              examId,
            },
          });
        insertedCount++;
      } catch (err: any) {
        errors.push(`Baris ${i + 1} (${username}): ${err.message}`);
      }
    }

    res.json({
      success: true,
      insertedCount,
      errors,
      message: `Berhasil memproses ${insertedCount} peserta ke database.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/participants/:id/extra-time', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const minutes = Number(req.body.minutes) || 0;

    const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!current) return res.status(404).json({ success: false, error: 'Peserta tidak ditemukan' });

    const newExtra = (current.extraTimeMinutes || 0) + minutes;

    const [updated] = await db
      .update(users)
      .set({ extraTimeMinutes: Math.max(0, newExtra) })
      .where(eq(users.id, id))
      .returning();

    res.json({
      success: true,
      participant: updated,
      message: `Penambahan waktu +${minutes} menit berhasil diberikan. Total waktu tambahan: ${updated.extraTimeMinutes} menit.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/participants/:id/reset-status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, resetTime } = req.body;

    const updateFields: any = {
      examStatus: status || 'ready',
    };
    if (resetTime) {
      updateFields.startedAt = null;
      updateFields.finishedAt = null;
    }

    const [updated] = await db.update(users).set(updateFields).where(eq(users.id, id)).returning();

    res.json({
      success: true,
      participant: updated,
      message: `Status ujian peserta berhasil diatur ulang menjadi '${updateFields.examStatus}'.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// QUESTIONS (SOAL) & BANK SOAL
// ==========================================
router.get('/exams/:id/questions', async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, examId))
      .orderBy(asc(questions.questionOrder));
    res.json({ success: true, questions: qs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exams/:id/questions', async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const {
      bankName,
      questionOrder,
      questionType,
      content,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctAnswer,
      points,
      explanation,
    } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Isi pertanyaan soal wajib diisi' });
    }

    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);

    const [created] = await db
      .insert(questions)
      .values({
        examId,
        bankName: bankName ? String(bankName).trim() : (exam?.bankName || 'Bank Soal Utama'),
        questionOrder: Number(questionOrder) || 1,
        questionType: questionType === 'essay' ? 'essay' : 'multiple_choice',
        content: String(content).trim(),
        optionA: optionA ? String(optionA).trim() : null,
        optionB: optionB ? String(optionB).trim() : null,
        optionC: optionC ? String(optionC).trim() : null,
        optionD: optionD ? String(optionD).trim() : null,
        optionE: optionE ? String(optionE).trim() : null,
        correctAnswer: correctAnswer ? String(correctAnswer).trim() : null,
        points: Number(points) || (questionType === 'essay' ? 15 : 5),
        explanation: explanation ? String(explanation).trim() : null,
      })
      .returning();

    res.json({ success: true, question: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/questions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      bankName,
      questionOrder,
      questionType,
      content,
      optionA,
      optionB,
      optionC,
      optionD,
      optionE,
      correctAnswer,
      points,
      explanation,
    } = req.body;

    const [updated] = await db
      .update(questions)
      .set({
        bankName: bankName ? String(bankName).trim() : undefined,
        questionOrder: questionOrder !== undefined ? Number(questionOrder) : undefined,
        questionType: questionType ? String(questionType) : undefined,
        content: content ? String(content).trim() : undefined,
        optionA: optionA !== undefined ? (optionA ? String(optionA).trim() : null) : undefined,
        optionB: optionB !== undefined ? (optionB ? String(optionB).trim() : null) : undefined,
        optionC: optionC !== undefined ? (optionC ? String(optionC).trim() : null) : undefined,
        optionD: optionD !== undefined ? (optionD ? String(optionD).trim() : null) : undefined,
        optionE: optionE !== undefined ? (optionE ? String(optionE).trim() : null) : undefined,
        correctAnswer: correctAnswer !== undefined ? (correctAnswer ? String(correctAnswer).trim() : null) : undefined,
        points: points !== undefined ? Number(points) : undefined,
        explanation: explanation !== undefined ? (explanation ? String(explanation).trim() : null) : undefined,
      })
      .where(eq(questions.id, id))
      .returning();

    res.json({ success: true, question: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(participantAnswers).where(eq(participantAnswers.questionId, id));
    await db.delete(questions).where(eq(questions.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exams/:id/questions/bulk-upload', async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const { rows, defaultBankName } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Data soal tidak boleh kosong' });
    }

    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);

    let insertedCount = 0;
    let errors: string[] = [];

    const [maxOrderRes] = await db
      .select({ max: sql<number>`max(${questions.questionOrder})` })
      .from(questions)
      .where(eq(questions.examId, examId));
    let nextOrder = (maxOrderRes?.max ?? 0) + 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const content = String(row.soal || row.pertanyaan || row.content || '').trim();
      const qType = String(row.jenis || row.type || row.question_type || 'multiple_choice').toLowerCase();
      const isEssay = qType.includes('essay') || qType.includes('esai');
      const bankName = String(row.nama_bank_soal || row.bank_name || defaultBankName || exam?.bankName || 'Bank Soal Utama').trim();

      if (!content) {
        errors.push(`Baris ${i + 1}: Pertanyaan kosong.`);
        continue;
      }

      const optA = isEssay ? null : String(row.pilihan_a || row.option_a || row.A || '').trim();
      const optB = isEssay ? null : String(row.pilihan_b || row.option_b || row.B || '').trim();
      const optC = isEssay ? null : String(row.pilihan_c || row.option_c || row.C || '').trim();
      const optD = isEssay ? null : String(row.pilihan_d || row.option_d || row.D || '').trim();
      const optE = isEssay ? null : String(row.pilihan_e || row.option_e || row.E || '').trim();
      const answer = String(row.kunci || row.jawaban || row.correct_answer || '').trim();
      const points = Number(row.bobot || row.points || (isEssay ? 15 : 5)) || (isEssay ? 15 : 5);
      const explanation = String(row.pembahasan || row.explanation || '').trim();

      try {
        await db.insert(questions).values({
          examId,
          bankName,
          questionOrder: nextOrder++,
          questionType: isEssay ? 'essay' : 'multiple_choice',
          content,
          optionA: optA || null,
          optionB: optB || null,
          optionC: optC || null,
          optionD: optD || null,
          optionE: optE || null,
          correctAnswer: answer || null,
          points,
          explanation: explanation || null,
        });
        insertedCount++;
      } catch (err: any) {
        errors.push(`Baris ${i + 1}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      insertedCount,
      errors,
      message: `Berhasil mengunggah ${insertedCount} butir soal ke ${exam?.bankName || 'bank soal'}.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// EXAM TAKING WORKFLOW (FOR PESERTA)
// ==========================================
router.get('/exam/participant-status/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) return res.status(404).json({ success: false, error: 'Peserta tidak ditemukan' });
    if (!user.examId) return res.status(400).json({ success: false, error: 'Peserta belum didaftarkan pada ujian manapun' });

    const [exam] = await db.select().from(exams).where(eq(exams.id, user.examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    let room = null;
    if (user.roomId) {
      const [r] = await db.select().from(rooms).where(eq(rooms.id, user.roomId)).limit(1);
      if (r) room = r;
    }

    const [result] = await db
      .select()
      .from(examResults)
      .where(and(eq(examResults.userId, userId), eq(examResults.examId, exam.id)))
      .limit(1);

    const totalDurationMinutes = exam.durationMinutes + (user.extraTimeMinutes || 0);
    let secondsLeft = totalDurationMinutes * 60;

    if (user.startedAt) {
      const startMs = new Date(user.startedAt).getTime();
      const nowMs = Date.now();
      const elapsedSeconds = Math.floor((nowMs - startMs) / 1000);
      secondsLeft = Math.max(0, totalDurationMinutes * 60 - elapsedSeconds);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        examStatus: user.examStatus,
        startedAt: user.startedAt,
        finishedAt: user.finishedAt,
        extraTimeMinutes: user.extraTimeMinutes,
      },
      exam,
      room,
      result,
      secondsLeft,
      totalDurationMinutes,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exam/start-attempt', async (req, res) => {
  try {
    const { userId } = req.body;
    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (!user) return res.status(404).json({ success: false, error: 'Peserta tidak ditemukan' });
    if (!user.examId) return res.status(400).json({ success: false, error: 'Peserta belum memiliki jadwal ujian' });

    const [exam] = await db.select().from(exams).where(eq(exams.id, user.examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    if (exam.status !== 'ongoing') {
      return res.status(400).json({
        success: false,
        error: 'Ujian belum dimulai oleh Admin Utama. Harap menunggu di ruang tunggu.',
      });
    }

    const startedAt = user.startedAt || new Date();
    const [updated] = await db
      .update(users)
      .set({
        examStatus: 'testing',
        startedAt,
      })
      .where(eq(users.id, user.id))
      .returning();

    res.json({ success: true, user: updated, message: 'Selamat mengerjakan ujian!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let m = result.length, t, i;
  let currentSeed = seed;

  while (m) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    i = Math.floor((currentSeed / 233280) * m--);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
}

router.get('/exam/questions-for-student/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.examId) return res.status(404).json({ success: false, error: 'Data ujian peserta tidak valid' });

    const [exam] = await db.select().from(exams).where(eq(exams.id, user.examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    let rawQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, exam.id))
      .orderBy(asc(questions.questionOrder));

    if (exam.randomizeQuestions) {
      rawQuestions = deterministicShuffle(rawQuestions, userId * 31 + 17);
    }

    const preparedQuestions = rawQuestions.map((q, idx) => {
      let optionsList: { key: string; originalKey: string; text: string }[] = [];

      if (q.questionType === 'multiple_choice') {
        const rawOpts = [
          { originalKey: 'A', text: q.optionA },
          { originalKey: 'B', text: q.optionB },
          { originalKey: 'C', text: q.optionC },
          { originalKey: 'D', text: q.optionD },
          { originalKey: 'E', text: q.optionE },
        ].filter((o) => o.text && o.text.trim() !== '');

        if (exam.randomizeOptions) {
          const shuffled = deterministicShuffle(rawOpts, userId * 13 + q.id * 7);
          const labels = ['A', 'B', 'C', 'D', 'E'];
          optionsList = shuffled.map((item, optIdx) => ({
            key: labels[optIdx] || item.originalKey,
            originalKey: item.originalKey,
            text: item.text || '',
          }));
        } else {
          optionsList = rawOpts.map((item) => ({
            key: item.originalKey,
            originalKey: item.originalKey,
            text: item.text || '',
          }));
        }
      }

      return {
        id: q.id,
        displayNumber: idx + 1,
        questionOrder: q.questionOrder,
        questionType: q.questionType,
        content: q.content,
        points: q.points,
        options: optionsList,
      };
    });

    res.json({ success: true, questions: preparedQuestions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exam/save-answer', async (req, res) => {
  try {
    const { userId, examId, questionId, selectedOption, essayAnswer, isDoubtful } = req.body;

    if (!userId || !examId || !questionId) {
      return res.status(400).json({ success: false, error: 'Parameter jawaban tidak lengkap' });
    }

    const existing = await db
      .select()
      .from(participantAnswers)
      .where(
        and(
          eq(participantAnswers.userId, Number(userId)),
          eq(participantAnswers.examId, Number(examId)),
          eq(participantAnswers.questionId, Number(questionId))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(participantAnswers)
        .set({
          selectedOption: selectedOption !== undefined ? selectedOption : existing[0].selectedOption,
          essayAnswer: essayAnswer !== undefined ? essayAnswer : existing[0].essayAnswer,
          isDoubtful: isDoubtful !== undefined ? Boolean(isDoubtful) : existing[0].isDoubtful,
          updatedAt: new Date(),
        })
        .where(eq(participantAnswers.id, existing[0].id))
        .returning();

      return res.json({ success: true, answer: updated });
    } else {
      const [inserted] = await db
        .insert(participantAnswers)
        .values({
          userId: Number(userId),
          examId: Number(examId),
          questionId: Number(questionId),
          selectedOption: selectedOption || null,
          essayAnswer: essayAnswer || null,
          isDoubtful: Boolean(isDoubtful),
          updatedAt: new Date(),
        })
        .returning();

      return res.json({ success: true, answer: inserted });
    }
  } catch (error: any) {
    console.error('Error saving answer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exam/my-answers/:userId/:examId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);

    const answers = await db
      .select()
      .from(participantAnswers)
      .where(and(eq(participantAnswers.userId, userId), eq(participantAnswers.examId, examId)));

    res.json({ success: true, answers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exam/finish', async (req, res) => {
  try {
    const { userId, examId } = req.body;
    if (!userId || !examId) {
      return res.status(400).json({ success: false, error: 'User ID dan Exam ID wajib diisi' });
    }

    const uId = Number(userId);
    const eId = Number(examId);

    const [user] = await db.select().from(users).where(eq(users.id, uId)).limit(1);
    const [exam] = await db.select().from(exams).where(eq(exams.id, eId)).limit(1);
    if (!user || !exam) {
      return res.status(404).json({ success: false, error: 'Data peserta atau ujian tidak valid' });
    }

    const allQuestions = await db.select().from(questions).where(eq(questions.examId, eId));
    const studentAnswers = await db
      .select()
      .from(participantAnswers)
      .where(and(eq(participantAnswers.userId, uId), eq(participantAnswers.examId, eId)));

    const answerMap = new Map<number, typeof studentAnswers[0]>();
    studentAnswers.forEach((a) => answerMap.set(a.questionId, a));

    let answeredCount = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let emptyCount = 0;
    let mcqScore = 0;
    let existingEssayScore = 0;

    for (const q of allQuestions) {
      const ans = answerMap.get(q.id);

      if (q.questionType === 'multiple_choice') {
        const selected = ans?.selectedOption;
        if (!selected) {
          emptyCount++;
          mcqScore += exam.scoringEmpty;
          if (ans) {
            await db.update(participantAnswers).set({ isCorrect: false, score: exam.scoringEmpty }).where(eq(participantAnswers.id, ans.id));
          }
        } else {
          answeredCount++;
          const isCorrect = selected.toUpperCase() === (q.correctAnswer || '').toUpperCase();
          if (isCorrect) {
            correctCount++;
            const pointsEarned = exam.scoringCorrect || q.points || 4;
            mcqScore += pointsEarned;
            await db.update(participantAnswers).set({ isCorrect: true, score: pointsEarned }).where(eq(participantAnswers.id, ans.id));
          } else {
            wrongCount++;
            mcqScore += exam.scoringWrong;
            await db.update(participantAnswers).set({ isCorrect: false, score: exam.scoringWrong }).where(eq(participantAnswers.id, ans.id));
          }
        }
      } else if (q.questionType === 'essay') {
        if (ans && ans.essayAnswer && ans.essayAnswer.trim() !== '') {
          answeredCount++;
        } else {
          emptyCount++;
        }
        if (ans && ans.score) {
          existingEssayScore += ans.score;
        }
      }
    }

    const totalScore = exam.examType === 'multiple_choice' ? mcqScore : existingEssayScore;
    const isPassed = totalScore >= exam.passingGrade;

    const [existingResult] = await db
      .select()
      .from(examResults)
      .where(and(eq(examResults.userId, uId), eq(examResults.examId, eId)))
      .limit(1);

    let finalResult;
    if (existingResult) {
      const [up] = await db
        .update(examResults)
        .set({
          totalQuestions: allQuestions.length,
          answeredCount,
          correctCount,
          wrongCount,
          emptyCount,
          mcqScore,
          essayScore: existingEssayScore,
          totalScore,
          isPassed,
          submittedAt: new Date(),
        })
        .where(eq(examResults.id, existingResult.id))
        .returning();
      finalResult = up;
    } else {
      const [ins] = await db
        .insert(examResults)
        .values({
          userId: uId,
          examId: eId,
          totalQuestions: allQuestions.length,
          answeredCount,
          correctCount,
          wrongCount,
          emptyCount,
          mcqScore,
          essayScore: existingEssayScore,
          totalScore,
          isPassed,
          submittedAt: new Date(),
        })
        .returning();
      finalResult = ins;
    }

    await db
      .update(users)
      .set({
        examStatus: 'finished',
        finishedAt: new Date(),
      })
      .where(eq(users.id, uId));

    res.json({
      success: true,
      result: finalResult,
      exam,
      message: 'Ujian selesai dan lembar jawaban berhasil dikirim!',
    });
  } catch (error: any) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ESSAY GRADING API (GROUPED BY EXAM)
// ==========================================
router.get('/grading/essay-exams', async (_req, res) => {
  try {
    const essayExams = await db
      .select()
      .from(exams)
      .where(eq(exams.examType, 'essay'))
      .orderBy(desc(exams.id));
    res.json({ success: true, exams: essayExams });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/grading/exam-submissions/:examId', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    // Get participants registered or finished for this exam
    const participants = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        roomId: users.roomId,
        examStatus: users.examStatus,
      })
      .from(users)
      .where(and(eq(users.examId, examId), eq(users.role, 'peserta')))
      .orderBy(asc(users.username));

    // Get all essay questions for this exam
    const essayQs = await db
      .select()
      .from(questions)
      .where(and(eq(questions.examId, examId), eq(questions.questionType, 'essay')))
      .orderBy(asc(questions.questionOrder));

    const submissions = await Promise.all(
      participants.map(async (p) => {
        let roomName = '-';
        if (p.roomId) {
          const [r] = await db.select().from(rooms).where(eq(rooms.id, p.roomId)).limit(1);
          if (r) roomName = r.name;
        }

        const [resRecord] = await db
          .select()
          .from(examResults)
          .where(and(eq(examResults.userId, p.id), eq(examResults.examId, examId)))
          .limit(1);

        // Fetch student's answers to all essay questions
        const answers = await db
          .select()
          .from(participantAnswers)
          .where(and(eq(participantAnswers.userId, p.id), eq(participantAnswers.examId, examId)));

        const ansMap = new Map<number, typeof answers[0]>();
        answers.forEach((a) => ansMap.set(a.questionId, a));

        const questionDetails = essayQs.map((q) => {
          const ans = ansMap.get(q.id);
          return {
            questionId: q.id,
            order: q.questionOrder,
            content: q.content,
            maxPoints: q.points,
            rubric: q.correctAnswer,
            essayAnswer: ans?.essayAnswer || '',
            score: ans?.score || 0,
            feedback: ans?.essayFeedback || '',
          };
        });

        return {
          userId: p.id,
          username: p.username,
          name: p.name,
          roomName,
          status: p.examStatus,
          essayScore: resRecord?.essayScore ?? 0,
          totalScore: resRecord?.totalScore ?? 0,
          isPassed: resRecord?.isPassed ?? false,
          questionDetails,
        };
      })
    );

    res.json({ success: true, exam, submissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/grading/grade-essay', async (req, res) => {
  try {
    const { userId, examId, questionId, score, feedback } = req.body;
    const uId = Number(userId);
    const eId = Number(examId);
    const qId = Number(questionId);
    const earnedScore = Number(score) || 0;

    const existingAns = await db
      .select()
      .from(participantAnswers)
      .where(
        and(
          eq(participantAnswers.userId, uId),
          eq(participantAnswers.examId, eId),
          eq(participantAnswers.questionId, qId)
        )
      )
      .limit(1);

    if (existingAns.length > 0) {
      await db
        .update(participantAnswers)
        .set({
          score: earnedScore,
          essayFeedback: feedback ? String(feedback).trim() : null,
          updatedAt: new Date(),
        })
        .where(eq(participantAnswers.id, existingAns[0].id));
    } else {
      await db.insert(participantAnswers).values({
        userId: uId,
        examId: eId,
        questionId: qId,
        score: earnedScore,
        essayFeedback: feedback ? String(feedback).trim() : null,
      });
    }

    // Recalculate total essay score in exam_results
    const allEssayAnswers = await db
      .select()
      .from(participantAnswers)
      .innerJoin(questions, eq(participantAnswers.questionId, questions.id))
      .where(
        and(
          eq(participantAnswers.userId, uId),
          eq(participantAnswers.examId, eId),
          eq(questions.questionType, 'essay')
        )
      );

    const totalEssayScore = allEssayAnswers.reduce((acc, curr) => acc + (curr.participant_answers.score || 0), 0);

    const [currentResult] = await db
      .select()
      .from(examResults)
      .where(and(eq(examResults.userId, uId), eq(examResults.examId, eId)))
      .limit(1);

    const [exam] = await db.select().from(exams).where(eq(exams.id, eId)).limit(1);

    if (currentResult) {
      const newTotal = totalEssayScore;
      const isPassed = exam ? newTotal >= exam.passingGrade : false;

      await db
        .update(examResults)
        .set({
          essayScore: totalEssayScore,
          totalScore: newTotal,
          isPassed,
        })
        .where(eq(examResults.id, currentResult.id));
    } else {
      const newTotal = totalEssayScore;
      const isPassed = exam ? newTotal >= exam.passingGrade : false;

      await db.insert(examResults).values({
        userId: uId,
        examId: eId,
        totalQuestions: allEssayAnswers.length,
        answeredCount: allEssayAnswers.length,
        correctCount: 0,
        wrongCount: 0,
        emptyCount: 0,
        mcqScore: 0,
        essayScore: totalEssayScore,
        totalScore: newTotal,
        isPassed,
      });
    }

    res.json({ success: true, totalScore: totalEssayScore, message: 'Nilai essay berhasil disimpan!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// OPERATOR & REPORTS
// ==========================================
router.get('/operator/my-rooms/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ success: false, error: 'User operator tidak ditemukan' });

    const allExams = await db.select().from(exams).orderBy(desc(exams.id));
    const assignments: any[] = [];
    const seenRooms = new Set<number>();

    for (const ex of allExams) {
      if (ex.roomOperators) {
        try {
          const parsed = JSON.parse(ex.roomOperators);
          for (const item of parsed) {
            if (
              (item.operatorUsername && item.operatorUsername === user.username) ||
              (item.operatorId && item.operatorId === user.id)
            ) {
              if (!seenRooms.has(item.roomId)) {
                seenRooms.add(item.roomId);
                const [r] = await db.select().from(rooms).where(eq(rooms.id, item.roomId)).limit(1);
                assignments.push({
                  roomId: item.roomId,
                  roomName: r?.name || item.roomName,
                  roomCode: r?.roomCode || '',
                  capacity: r?.capacity || 30,
                  location: r?.location || '',
                  examId: ex.id,
                  examTitle: ex.title,
                  examStatus: ex.status,
                });
              }
            }
          }
        } catch {}
      }
    }

    if (user.roomId && !seenRooms.has(user.roomId)) {
      const [r] = await db.select().from(rooms).where(eq(rooms.id, user.roomId)).limit(1);
      if (r) {
        assignments.push({
          roomId: r.id,
          roomName: r.name,
          roomCode: r.roomCode,
          capacity: r.capacity,
          location: r.location,
          examId: user.examId,
          examTitle: 'Ujian Terjadwal',
          examStatus: 'scheduled',
        });
      }
    }

    res.json({ success: true, assignments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/operator/room-monitoring/:roomId', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) return res.status(404).json({ success: false, error: 'Ruangan tidak ditemukan' });

    const participants = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        examId: users.examId,
        extraTimeMinutes: users.extraTimeMinutes,
        examStatus: users.examStatus,
        startedAt: users.startedAt,
        finishedAt: users.finishedAt,
      })
      .from(users)
      .where(and(eq(users.roomId, roomId), eq(users.role, 'peserta')))
      .orderBy(asc(users.username));

    const enriched = await Promise.all(
      participants.map(async (p) => {
        let answered = 0;
        let score = null;
        let isPassed = null;
        let examTitle = '-';
        let totalDuration = 60;

        if (p.examId) {
          const [exam] = await db.select().from(exams).where(eq(exams.id, p.examId)).limit(1);
          if (exam) {
            examTitle = exam.title;
            totalDuration = exam.durationMinutes + (p.extraTimeMinutes || 0);
          }

          const [ansCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(participantAnswers)
            .where(and(eq(participantAnswers.userId, p.id), eq(participantAnswers.examId, p.examId)));
          answered = Number(ansCount?.count ?? 0);

          const [resRecord] = await db
            .select()
            .from(examResults)
            .where(and(eq(examResults.userId, p.id), eq(examResults.examId, p.examId)))
            .limit(1);

          if (resRecord) {
            score = resRecord.totalScore;
            isPassed = resRecord.isPassed;
          }
        }

        let secondsLeft = null;
        if (p.examStatus === 'testing' && p.startedAt) {
          const startMs = new Date(p.startedAt).getTime();
          const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
          secondsLeft = Math.max(0, totalDuration * 60 - elapsedSec);
        }

        return {
          ...p,
          examTitle,
          answered,
          score,
          isPassed,
          secondsLeft,
        };
      })
    );

    res.json({ success: true, room, participants: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/exam-results/:examId', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;

    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) return res.status(404).json({ success: false, error: 'Ujian tidak ditemukan' });

    let conditions = [eq(users.examId, examId), eq(users.role, 'peserta')];
    if (roomId) conditions.push(eq(users.roomId, roomId));

    const participants = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        roomId: users.roomId,
        extraTimeMinutes: users.extraTimeMinutes,
        examStatus: users.examStatus,
        startedAt: users.startedAt,
        finishedAt: users.finishedAt,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.username));

    const results = await Promise.all(
      participants.map(async (p) => {
        let roomName = '-';
        if (p.roomId) {
          const [r] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, p.roomId));
          if (r) roomName = r.name;
        }

        const [resRecord] = await db
          .select()
          .from(examResults)
          .where(and(eq(examResults.userId, p.id), eq(examResults.examId, examId)))
          .limit(1);

        return {
          userId: p.id,
          username: p.username,
          name: p.name,
          roomName,
          status: p.examStatus,
          startedAt: p.startedAt,
          finishedAt: p.finishedAt,
          totalQuestions: resRecord?.totalQuestions ?? 0,
          answeredCount: resRecord?.answeredCount ?? 0,
          correctCount: resRecord?.correctCount ?? 0,
          wrongCount: resRecord?.wrongCount ?? 0,
          emptyCount: resRecord?.emptyCount ?? 0,
          mcqScore: resRecord?.mcqScore ?? 0,
          essayScore: resRecord?.essayScore ?? 0,
          totalScore: resRecord?.totalScore ?? 0,
          isPassed: resRecord?.isPassed ?? false,
          hasResult: Boolean(resRecord),
        };
      })
    );

    results.sort((a, b) => b.totalScore - a.totalScore);
    res.json({ success: true, exam, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/participant-sheet/:userId/:examId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!user || !exam) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });

    let room = null;
    if (user.roomId) {
      const [r] = await db.select().from(rooms).where(eq(rooms.id, user.roomId)).limit(1);
      if (r) room = r;
    }

    const [result] = await db
      .select()
      .from(examResults)
      .where(and(eq(examResults.userId, userId), eq(examResults.examId, examId)))
      .limit(1);

    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.examId, examId))
      .orderBy(asc(questions.questionOrder));

    const answers = await db
      .select()
      .from(participantAnswers)
      .where(and(eq(participantAnswers.userId, userId), eq(participantAnswers.examId, examId)));

    const answerMap = new Map<number, typeof answers[0]>();
    answers.forEach((a) => answerMap.set(a.questionId, a));

    const sheetItems = qs.map((q) => {
      const ans = answerMap.get(q.id);
      return {
        questionId: q.id,
        order: q.questionOrder,
        type: q.questionType,
        content: q.content,
        options: {
          A: q.optionA,
          B: q.optionB,
          C: q.optionC,
          D: q.optionD,
          E: q.optionE,
        },
        correctAnswer: q.correctAnswer,
        points: q.points,
        explanation: q.explanation,
        studentSelected: ans?.selectedOption || null,
        studentEssay: ans?.essayAnswer || null,
        isCorrect: ans?.isCorrect ?? null,
        scoreEarned: ans?.score ?? 0,
        essayFeedback: ans?.essayFeedback || null,
      };
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
      room,
      exam,
      result,
      sheetItems,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
