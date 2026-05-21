import { Redis } from "@upstash/redis";
import {
  projectAll,
  viewsEqual,
  voxelsFromArray,
  ViewMask,
  ViewName,
} from "./voxel";
import { generatePuzzle } from "./puzzleGen";
import { recordRaceFinish } from "./stats";

// ── 速度賽資料結構 ─────────────────────────────────────────────────────
// 流程：waiting (建房等加入) → playing (打 10 題，每題第一個答對拿分) → done

export const TOTAL_ROUNDS = 10;
type Slot = "A" | "B";
type RacePhase = "waiting" | "playing" | "done";

export type RaceRound = {
  index: number;        // 0..TOTAL_ROUNDS-1
  difficulty: number;   // 1..10
  // target voxels 不直接送 client（避免作弊），只送 views
  targetVoxels: [number, number, number][];
  views: Record<ViewName, ViewMask>;
  // 本回合勝者；null = 仍在打；"tie" = 雙方放棄
  winner: Slot | "tie" | null;
  forfeits: { A: boolean; B: boolean };
  startedAt: number;
  endedAt: number | null;
};

export type RaceRoom = {
  id: string;
  createdAt: number;
  players: { A: string | null; B: string | null };
  phase: RacePhase;
  rounds: RaceRound[];
  currentRoundIndex: number;
  scores: { A: number; B: number };
  // 已記入排行榜了沒（避免重複加分）
  recorded: boolean;
};

// ── Store ────────────────────────────────────────────────────────────
interface RaceStore {
  get(id: string): Promise<RaceRoom | null>;
  save(r: RaceRoom): Promise<void>;
  exists(id: string): Promise<boolean>;
}

class MemoryRaceStore implements RaceStore {
  private map: Map<string, RaceRoom>;
  constructor() {
    const g = globalThis as unknown as { __memRaces?: Map<string, RaceRoom> };
    if (!g.__memRaces) g.__memRaces = new Map();
    this.map = g.__memRaces;
  }
  async get(id: string) {
    return this.map.get(id) ?? null;
  }
  async save(r: RaceRoom) {
    this.map.set(r.id, r);
  }
  async exists(id: string) {
    return this.map.has(id);
  }
}

class RedisRaceStore implements RaceStore {
  private redis: Redis;
  private ttlSeconds = 60 * 60 * 24;
  constructor(redis: Redis) {
    this.redis = redis;
  }
  private k(id: string) {
    return `tvg:race:v1:${id}`;
  }
  async get(id: string) {
    const r = await this.redis.get<RaceRoom>(this.k(id));
    return r ?? null;
  }
  async save(r: RaceRoom) {
    await this.redis.set(this.k(r.id), r, { ex: this.ttlSeconds });
  }
  async exists(id: string) {
    return (await this.redis.exists(this.k(id))) === 1;
  }
}

function buildRaceStore(): RaceStore {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_REDIS_TOKEN;
  if (url && token) return new RedisRaceStore(new Redis({ url, token }));
  return new MemoryRaceStore();
}

const g = globalThis as unknown as { __raceStore?: RaceStore };
const store: RaceStore = g.__raceStore ?? buildRaceStore();
g.__raceStore = store;

// ── 工具 ─────────────────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return id;
}

function buildRound(index: number): RaceRound {
  // 階梯難度：第 1 題 d=1，第 10 題 d=10
  const difficulty = index + 1;
  const { voxels, views } = generatePuzzle(difficulty);
  return {
    index,
    difficulty,
    targetVoxels: voxels,
    views,
    winner: null,
    forfeits: { A: false, B: false },
    startedAt: Date.now(),
    endedAt: null,
  };
}

function advanceRound(room: RaceRoom) {
  room.currentRoundIndex++;
  if (room.currentRoundIndex >= TOTAL_ROUNDS) {
    room.phase = "done";
    return;
  }
  room.rounds.push(buildRound(room.currentRoundIndex));
}

const opposite = (s: Slot): Slot => (s === "A" ? "B" : "A");

// ── 對外 API ─────────────────────────────────────────────────────────
export async function createRace(playerId: string): Promise<RaceRoom> {
  let id = makeId();
  while (await store.exists(id)) id = makeId();
  const room: RaceRoom = {
    id,
    createdAt: Date.now(),
    players: { A: playerId, B: null },
    phase: "waiting",
    rounds: [],
    currentRoundIndex: 0,
    scores: { A: 0, B: 0 },
    recorded: false,
  };
  await store.save(room);
  return room;
}

export async function getRace(id: string): Promise<RaceRoom | null> {
  return store.get(id.toUpperCase());
}

export async function joinRace(
  id: string,
  playerId: string
): Promise<RaceRoom | null> {
  const room = await getRace(id);
  if (!room) return null;
  if (room.players.A === playerId || room.players.B === playerId) return room;
  if (!room.players.B) {
    room.players.B = playerId;
    room.phase = "playing";
    // 雙方就位 → 產生第一題
    room.rounds.push(buildRound(0));
    await store.save(room);
    return room;
  }
  return null;
}

export function raceSlotOf(room: RaceRoom, playerId: string): Slot | null {
  if (room.players.A === playerId) return "A";
  if (room.players.B === playerId) return "B";
  return null;
}

async function recordFinishIfNeeded(room: RaceRoom) {
  if (room.phase !== "done" || room.recorded) return;
  if (room.players.A && room.players.B) {
    try {
      await Promise.all([
        recordRaceFinish({
          studentId: room.players.A,
          wonRounds: room.scores.A,
          totalRounds: TOTAL_ROUNDS,
        }),
        recordRaceFinish({
          studentId: room.players.B,
          wonRounds: room.scores.B,
          totalRounds: TOTAL_ROUNDS,
        }),
      ]);
      room.recorded = true;
    } catch (e) {
      console.error("[race stats] recordRaceFinish failed:", e);
    }
  }
}

export async function submitRaceAnswer(
  raceId: string,
  playerId: string,
  voxelsArr: [number, number, number][]
): Promise<
  | { ok: true; correct: boolean; room: RaceRoom }
  | { ok: false; error: string }
> {
  const room = await getRace(raceId);
  if (!room) return { ok: false, error: "房間不存在" };
  const slot = raceSlotOf(room, playerId);
  if (!slot) return { ok: false, error: "你不在這個房間裡" };
  if (room.phase !== "playing") return { ok: false, error: "對戰未開始或已結束" };

  const round = room.rounds[room.currentRoundIndex];
  if (!round) return { ok: false, error: "找不到當前回合" };
  if (round.winner) return { ok: false, error: "這題已經結束了" };
  if (round.forfeits[slot])
    return { ok: false, error: "你已放棄這題了" };

  const myViews = projectAll(voxelsFromArray(voxelsArr));
  const { ok } = viewsEqual(myViews, round.views);

  if (!ok) {
    // 答錯 — 不寫 DB，只回報結果，玩家可以繼續嘗試
    return { ok: true, correct: false, room };
  }

  // 答對：搶下這題
  round.winner = slot;
  round.endedAt = Date.now();
  room.scores[slot]++;
  advanceRound(room);
  await store.save(room);
  await recordFinishIfNeeded(room);
  return { ok: true, correct: true, room };
}

export async function forfeitRound(
  raceId: string,
  playerId: string
): Promise<{ ok: true; room: RaceRoom } | { ok: false; error: string }> {
  const room = await getRace(raceId);
  if (!room) return { ok: false, error: "房間不存在" };
  const slot = raceSlotOf(room, playerId);
  if (!slot) return { ok: false, error: "你不在這個房間裡" };
  if (room.phase !== "playing") return { ok: false, error: "對戰未開始或已結束" };

  const round = room.rounds[room.currentRoundIndex];
  if (!round) return { ok: false, error: "找不到當前回合" };
  if (round.winner) return { ok: false, error: "這題已經結束了" };

  round.forfeits[slot] = true;

  // 雙方都放棄 → 本題流局
  if (round.forfeits.A && round.forfeits.B) {
    round.winner = "tie";
    round.endedAt = Date.now();
    advanceRound(room);
  }

  await store.save(room);
  await recordFinishIfNeeded(room);
  return { ok: true, room };
}

// 重啟一場：保留雙方玩家身分，清掉所有題目/比分/紀錄，重抽第一題。
// 任一玩家在 done 階段都可觸發。
export async function restartRace(
  raceId: string,
  playerId: string
): Promise<{ ok: true; room: RaceRoom } | { ok: false; error: string }> {
  const room = await getRace(raceId);
  if (!room) return { ok: false, error: "房間不存在" };
  const slot = raceSlotOf(room, playerId);
  if (!slot) return { ok: false, error: "你不在這個房間裡" };
  if (room.phase !== "done")
    return { ok: false, error: "目前不是結束階段，無法重啟" };
  room.phase = "playing";
  room.rounds = [buildRound(0)];
  room.currentRoundIndex = 0;
  room.scores = { A: 0, B: 0 };
  room.recorded = false;
  await store.save(room);
  return { ok: true, room };
}

// 對外 view：隱藏未來的 targetVoxels，但回傳當前題目的 views。
// 結束後可以揭露所有 targetVoxels 供回顧。
export function publicRaceView(
  room: RaceRoom,
  viewerSlot: Slot | null
): {
  id: string;
  phase: RacePhase;
  players: { A: boolean; B: boolean };
  yourSlot: Slot | null;
  currentRoundIndex: number;
  totalRounds: number;
  scores: { A: number; B: number };
  currentRound: {
    index: number;
    difficulty: number;
    views: Record<ViewName, ViewMask>;
    youForfeited: boolean;
    opponentForfeited: boolean;
  } | null;
  history: Array<{
    index: number;
    difficulty: number;
    winner: Slot | "tie" | null;
    targetVoxels: [number, number, number][] | null; // 結束後揭露
  }>;
} {
  const oppSlot: Slot | null =
    viewerSlot === "A" ? "B" : viewerSlot === "B" ? "A" : null;

  let currentRound: ReturnType<typeof publicRaceView>["currentRound"] = null;
  if (room.phase === "playing") {
    const r = room.rounds[room.currentRoundIndex];
    if (r) {
      currentRound = {
        index: r.index,
        difficulty: r.difficulty,
        views: r.views,
        youForfeited: viewerSlot ? r.forfeits[viewerSlot] : false,
        opponentForfeited: oppSlot ? r.forfeits[oppSlot] : false,
      };
    }
  }

  const history = room.rounds.map((r) => ({
    index: r.index,
    difficulty: r.difficulty,
    winner: r.winner,
    targetVoxels: room.phase === "done" ? r.targetVoxels : null,
  }));

  return {
    id: room.id,
    phase: room.phase,
    players: { A: !!room.players.A, B: !!room.players.B },
    yourSlot: viewerSlot,
    currentRoundIndex: room.currentRoundIndex,
    totalRounds: TOTAL_ROUNDS,
    scores: room.scores,
    currentRound,
    history,
  };
}

export type PublicRace = ReturnType<typeof publicRaceView>;
