import { Redis } from "@upstash/redis";

// 學生數據紀錄：
//   tvg:student:{id}           → hash {classCode, seatNo, wins, losses, total,
//                                       raceWins, raceLosses, raceTotal, lastSeen}
//   tvg:students               → set 所有 student id
//   tvg:leaderboard:wins       → zset 對戰勝場（A 出題 B 解 的那種）
//   tvg:leaderboard:race       → zset 速度賽勝場
//
// 沒設 Redis 環境變數時所有操作為 no-op。

type StudentRecord = {
  id: string;
  classCode: string;
  seatNo: number;
  // 對戰（出題互打）
  wins: number;
  losses: number;
  total: number;
  // 速度賽（同題比快）
  raceWins: number;
  raceLosses: number;
  raceTotal: number;
  lastSeen: number;
};

function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_REDIS_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const g = globalThis as unknown as { __statsRedis?: Redis | null };
const redis: Redis | null =
  g.__statsRedis === undefined ? getRedis() : g.__statsRedis;
g.__statsRedis = redis;

function parseId(id: string): { classCode: string; seatNo: number } | null {
  const idx = id.lastIndexOf("-");
  if (idx <= 0 || idx === id.length - 1) return null;
  const classCode = id.slice(0, idx);
  const n = parseInt(id.slice(idx + 1), 10);
  if (!Number.isFinite(n)) return null;
  return { classCode, seatNo: n };
}

const KEY = {
  student: (id: string) => `tvg:student:${id}`,
  studentsSet: "tvg:students",
  lbWins: "tvg:leaderboard:wins",
  lbRace: "tvg:leaderboard:race",
};

// ── 對戰（出題互打）─────────────────────────────────────────────────────
export async function recordBattleRound(params: {
  solverId: string;
  setterId: string;
  correct: boolean;
}): Promise<void> {
  if (!redis) return;
  const now = Date.now();
  const solverParsed = parseId(params.solverId);
  const setterParsed = parseId(params.setterId);
  if (!solverParsed) return;

  const pipe = redis.pipeline();

  pipe.hset(KEY.student(params.solverId), {
    classCode: solverParsed.classCode,
    seatNo: solverParsed.seatNo,
    lastSeen: now,
  });
  pipe.hincrby(KEY.student(params.solverId), "total", 1);
  if (params.correct) {
    pipe.hincrby(KEY.student(params.solverId), "wins", 1);
    pipe.zincrby(KEY.lbWins, 1, params.solverId);
  } else {
    pipe.hincrby(KEY.student(params.solverId), "losses", 1);
    pipe.zincrby(KEY.lbWins, 0, params.solverId);
  }
  pipe.sadd(KEY.studentsSet, params.solverId);

  if (setterParsed) {
    pipe.hset(KEY.student(params.setterId), {
      classCode: setterParsed.classCode,
      seatNo: setterParsed.seatNo,
      lastSeen: now,
    });
    pipe.zincrby(KEY.lbWins, 0, params.setterId);
    pipe.sadd(KEY.studentsSet, params.setterId);
  }

  await pipe.exec();
}

// ── 速度賽 ─────────────────────────────────────────────────────────────
// 一場結束時、針對每位玩家分別呼叫。total = 你打的回合數，wins = 你贏的回合數。
export async function recordRaceFinish(params: {
  studentId: string;
  wonRounds: number;
  totalRounds: number;
}): Promise<void> {
  if (!redis) return;
  const parsed = parseId(params.studentId);
  if (!parsed) return;
  const now = Date.now();
  const losses = Math.max(0, params.totalRounds - params.wonRounds);

  const pipe = redis.pipeline();
  pipe.hset(KEY.student(params.studentId), {
    classCode: parsed.classCode,
    seatNo: parsed.seatNo,
    lastSeen: now,
  });
  pipe.hincrby(KEY.student(params.studentId), "raceWins", params.wonRounds);
  pipe.hincrby(KEY.student(params.studentId), "raceLosses", losses);
  pipe.hincrby(KEY.student(params.studentId), "raceTotal", params.totalRounds);
  // 排行榜分數 = 累積 raceWins
  pipe.zincrby(KEY.lbRace, params.wonRounds, params.studentId);
  pipe.sadd(KEY.studentsSet, params.studentId);
  await pipe.exec();
}

// ── 讀取 ───────────────────────────────────────────────────────────────
export type LeaderboardKind = "battle" | "race";

export async function getLeaderboard(opts?: {
  limit?: number;
  classCode?: string;
  kind?: LeaderboardKind;
}): Promise<StudentRecord[]> {
  if (!redis) return [];
  const limit = opts?.limit ?? 50;
  const classFilter = opts?.classCode?.trim();
  const kind = opts?.kind ?? "battle";
  const zkey = kind === "race" ? KEY.lbRace : KEY.lbWins;

  const all = (await redis.zrange<string[]>(zkey, 0, -1, {
    rev: true,
    withScores: true,
  })) as Array<string | number>;
  const pairs: Array<{ id: string; score: number }> = [];
  for (let i = 0; i < all.length; i += 2) {
    pairs.push({
      id: String(all[i]),
      score: Number(all[i + 1]) || 0,
    });
  }

  const results: StudentRecord[] = [];
  for (const p of pairs) {
    const rec = await getStudentDetail(p.id);
    if (!rec) continue;
    if (classFilter && rec.classCode !== classFilter) continue;
    results.push(rec);
    if (results.length >= limit) break;
  }
  return results;
}

export async function getStudentDetail(id: string): Promise<StudentRecord | null> {
  if (!redis) return null;
  const h = await redis.hgetall<Record<string, string | number>>(KEY.student(id));
  if (!h || Object.keys(h).length === 0) return null;
  const parsed = parseId(id);
  return {
    id,
    classCode: typeof h.classCode === "string" ? h.classCode : parsed?.classCode ?? "?",
    seatNo: Number(h.seatNo) || parsed?.seatNo || 0,
    wins: Number(h.wins) || 0,
    losses: Number(h.losses) || 0,
    total: Number(h.total) || 0,
    raceWins: Number(h.raceWins) || 0,
    raceLosses: Number(h.raceLosses) || 0,
    raceTotal: Number(h.raceTotal) || 0,
    lastSeen: Number(h.lastSeen) || 0,
  };
}

export async function listAllStudents(): Promise<StudentRecord[]> {
  if (!redis) return [];
  const ids = (await redis.smembers(KEY.studentsSet)) as string[];
  const out: StudentRecord[] = [];
  for (const id of ids) {
    const r = await getStudentDetail(id);
    if (r) out.push(r);
  }
  return out;
}

export async function listAllClasses(): Promise<string[]> {
  const students = await listAllStudents();
  const set = new Set<string>();
  for (const s of students) set.add(s.classCode);
  return Array.from(set).sort();
}

export type { StudentRecord };
