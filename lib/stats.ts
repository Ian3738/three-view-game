import { Redis } from "@upstash/redis";

// 學生數據紀錄：
//   tvg:student:{id}      → hash {classCode, seatNo, wins, losses, total, lastSeen}
//   tvg:students          → set 所有 student id（用於後台列出全部）
//   tvg:leaderboard:wins  → zset score=wins，member=id（取 top-N 用）
//
// 沒設 Redis 環境變數時所有操作為 no-op（單機 dev 不需要排行榜）。

type StudentRecord = {
  id: string;
  classCode: string;
  seatNo: number;
  wins: number;
  losses: number;
  total: number;
  lastSeen: number; // epoch ms
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

// 從 id 解析回 classCode + seatNo。id 格式為 "{classCode}-{padded seat}"。
// classCode 本身可能含 "-"（雖然不鼓勵），所以從右邊找最後一個 "-"。
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
};

// 對戰一輪結束時呼叫。會同時 upsert solver 與 setter 兩位學生的 lastSeen。
// 計分規則：solver 答對 → solver 勝場 +1；答錯 → solver 負場 +1。
// setter 不直接得分（出題只是配合）。total = wins + losses。
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

  // upsert solver
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
    // 確保 solver 一定在 leaderboard 上（即使 0 分也要看得到）
    pipe.zincrby(KEY.lbWins, 0, params.solverId);
  }
  pipe.sadd(KEY.studentsSet, params.solverId);

  // upsert setter（不影響勝負，只記 lastSeen）
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

// 排行榜：取前 N 名（依勝場降序）。可選擇班級篩選（在記憶體做，全表 < 1000 人沒問題）。
export async function getLeaderboard(opts?: {
  limit?: number;
  classCode?: string;
}): Promise<StudentRecord[]> {
  if (!redis) return [];
  const limit = opts?.limit ?? 50;
  const classFilter = opts?.classCode?.trim();

  // 先全部撈出來，再過濾。Upstash zrange 支援 REV + WITHSCORES。
  // 如果未來資料量大可改 zscan + 分頁。
  const all = (await redis.zrange<string[]>(KEY.lbWins, 0, -1, {
    rev: true,
    withScores: true,
  })) as Array<string | number>;
  // 形如 [id1, score1, id2, score2, ...]
  const pairs: Array<{ id: string; wins: number }> = [];
  for (let i = 0; i < all.length; i += 2) {
    pairs.push({
      id: String(all[i]),
      wins: Number(all[i + 1]) || 0,
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
