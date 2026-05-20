import { Redis } from "@upstash/redis";
import {
  projectAll,
  viewsEqual,
  Voxels,
  voxelsFromArray,
  ViewMask,
  ViewName,
} from "./voxel";
import { recordBattleRound } from "./stats";

// ── 房間資料結構（同步對戰版） ─────────────────────────────────────────────
//   waiting  → 已建房，等 B 加入
//   setting  → 雙方同時出題（A 和 B 各蓋自己的秘密形狀）
//   solving  → 雙方同時解對方的題目
//   done     → 比賽結束，公布雙方結果與秘密形狀

type Slot = "A" | "B";
type Phase = "waiting" | "setting" | "solving" | "done";

type Secret = {
  voxels: [number, number, number][];
  views: Record<ViewName, ViewMask>;
};

type Answer = {
  voxels: [number, number, number][];
};

type RoundResult = {
  solver: Slot;
  setter: Slot;
  cubesUsed: number;
  correct: boolean;
  mismatches: ViewName[];
};

export type Room = {
  id: string;
  createdAt: number;
  players: { A: string | null; B: string | null };
  phase: Phase;
  secrets: { A: Secret | null; B: Secret | null };
  answers: { A: Answer | null; B: Answer | null };
  results: { A: RoundResult | null; B: RoundResult | null };
};

// ── Store 抽象 ──────────────────────────────────────────────────────────────
interface Store {
  get(id: string): Promise<Room | null>;
  save(room: Room): Promise<void>;
  exists(id: string): Promise<boolean>;
}

class MemoryStore implements Store {
  private map: Map<string, Room>;
  constructor() {
    const g = globalThis as unknown as { __memRooms?: Map<string, Room> };
    if (!g.__memRooms) g.__memRooms = new Map();
    this.map = g.__memRooms;
  }
  async get(id: string): Promise<Room | null> {
    return this.map.get(id) ?? null;
  }
  async save(room: Room): Promise<void> {
    this.map.set(room.id, room);
  }
  async exists(id: string): Promise<boolean> {
    return this.map.has(id);
  }
}

class RedisStore implements Store {
  private redis: Redis;
  private ttlSeconds = 60 * 60 * 24; // 24 小時自動過期
  constructor(redis: Redis) {
    this.redis = redis;
  }
  private k(id: string) {
    return `tvg:room:v2:${id}`; // v2 命名避開舊版資料
  }
  async get(id: string): Promise<Room | null> {
    const r = await this.redis.get<Room>(this.k(id));
    return r ?? null;
  }
  async save(room: Room): Promise<void> {
    await this.redis.set(this.k(room.id), room, { ex: this.ttlSeconds });
  }
  async exists(id: string): Promise<boolean> {
    return (await this.redis.exists(this.k(id))) === 1;
  }
}

function buildStore(): Store {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_REDIS_TOKEN;
  if (url && token) {
    return new RedisStore(new Redis({ url, token }));
  }
  return new MemoryStore();
}

const g = globalThis as unknown as { __roomStore?: Store };
const store: Store = g.__roomStore ?? buildStore();
g.__roomStore = store;

// ── 工具 ─────────────────────────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeRoomId(): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return id;
}

const opposite = (s: Slot): Slot => (s === "A" ? "B" : "A");

// ── 對外 API ─────────────────────────────────────────────────────────────────
export async function createRoom(playerId: string): Promise<Room> {
  let id = makeRoomId();
  while (await store.exists(id)) id = makeRoomId();
  const room: Room = {
    id,
    createdAt: Date.now(),
    players: { A: playerId, B: null },
    phase: "waiting",
    secrets: { A: null, B: null },
    answers: { A: null, B: null },
    results: { A: null, B: null },
  };
  await store.save(room);
  return room;
}

export async function getRoom(id: string): Promise<Room | null> {
  return store.get(id.toUpperCase());
}

export async function joinRoom(
  id: string,
  playerId: string
): Promise<Room | null> {
  const room = await getRoom(id);
  if (!room) return null;
  if (room.players.A === playerId || room.players.B === playerId) return room;
  if (!room.players.B) {
    room.players.B = playerId;
    room.phase = "setting"; // 雙方就位 → 進入同步出題
    await store.save(room);
    return room;
  }
  return null;
}

export function slotOf(room: Room, playerId: string): Slot | null {
  if (room.players.A === playerId) return "A";
  if (room.players.B === playerId) return "B";
  return null;
}

export async function submitSecret(
  roomId: string,
  playerId: string,
  voxelsArr: [number, number, number][]
): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { ok: false, error: "房間不存在" };
  const slot = slotOf(room, playerId);
  if (!slot) return { ok: false, error: "你不在這個房間裡" };
  if (room.phase !== "setting")
    return { ok: false, error: "現在不是出題階段" };
  if (room.secrets[slot])
    return { ok: false, error: "你已經出過題了，等對手就好" };
  if (voxelsArr.length === 0)
    return { ok: false, error: "至少要放一個方塊" };

  const voxels: Voxels = voxelsFromArray(voxelsArr);
  const views = projectAll(voxels);
  room.secrets[slot] = { voxels: voxelsArr, views };

  // 雙方都出題 → 進入解題階段
  if (room.secrets.A && room.secrets.B) {
    room.phase = "solving";
  }

  await store.save(room);
  return { ok: true, room };
}

export async function submitAnswer(
  roomId: string,
  playerId: string,
  voxelsArr: [number, number, number][]
): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  const room = await getRoom(roomId);
  if (!room) return { ok: false, error: "房間不存在" };
  const slot = slotOf(room, playerId);
  if (!slot) return { ok: false, error: "你不在這個房間裡" };
  if (room.phase !== "solving")
    return { ok: false, error: "現在不是解題階段" };
  if (room.answers[slot])
    return { ok: false, error: "你已經送出答案了" };

  const oppSlot = opposite(slot);
  const oppSecret = room.secrets[oppSlot];
  if (!oppSecret)
    return { ok: false, error: "對手還沒出題" };

  const myVoxels = voxelsFromArray(voxelsArr);
  const myViews = projectAll(myVoxels);
  const { ok, mismatches } = viewsEqual(myViews, oppSecret.views);

  room.answers[slot] = { voxels: voxelsArr };
  room.results[slot] = {
    solver: slot,
    setter: oppSlot,
    cubesUsed: voxelsArr.length,
    correct: ok,
    mismatches,
  };

  // 雙方都解完 → 結束
  if (room.answers.A && room.answers.B) {
    room.phase = "done";
  }

  await store.save(room);

  // 記錄學生統計（失敗不影響流程）
  const solverId = room.players[slot];
  const setterId = room.players[oppSlot];
  if (solverId && setterId) {
    try {
      await recordBattleRound({ solverId, setterId, correct: ok });
    } catch (e) {
      console.error("[stats] recordBattleRound failed:", e);
    }
  }

  return { ok: true, room };
}

// 對外回傳：根據觀看者身分過濾敏感資料（不讓 A 在 setting/solving 階段看到 B 的秘密）
export function publicView(
  room: Room,
  viewerSlot: Slot | null
): {
  id: string;
  phase: Phase;
  players: { A: boolean; B: boolean };
  yourSlot: Slot | null;
  mySubmittedSecret: boolean;
  opponentSubmittedSecret: boolean;
  mySubmittedAnswer: boolean;
  opponentSubmittedAnswer: boolean;
  // 解題階段，給對手秘密的視圖（不給 voxels）
  opponentSecretViews: Record<ViewName, ViewMask> | null;
  // 結束後公布雙方秘密（給雙方都看）
  reveal: {
    A: { voxels: [number, number, number][] } | null;
    B: { voxels: [number, number, number][] } | null;
  };
  results: { A: RoundResult | null; B: RoundResult | null };
} {
  const oppSlot: Slot | null =
    viewerSlot === "A" ? "B" : viewerSlot === "B" ? "A" : null;

  const mySubmittedSecret =
    !!(viewerSlot && room.secrets[viewerSlot]);
  const opponentSubmittedSecret =
    !!(oppSlot && room.secrets[oppSlot]);
  const mySubmittedAnswer =
    !!(viewerSlot && room.answers[viewerSlot]);
  const opponentSubmittedAnswer =
    !!(oppSlot && room.answers[oppSlot]);

  let opponentSecretViews: Record<ViewName, ViewMask> | null = null;
  if (room.phase === "solving" && oppSlot && room.secrets[oppSlot]) {
    opponentSecretViews = room.secrets[oppSlot]!.views;
  }

  const reveal: {
    A: { voxels: [number, number, number][] } | null;
    B: { voxels: [number, number, number][] } | null;
  } = { A: null, B: null };
  if (room.phase === "done") {
    if (room.secrets.A) reveal.A = { voxels: room.secrets.A.voxels };
    if (room.secrets.B) reveal.B = { voxels: room.secrets.B.voxels };
  }

  return {
    id: room.id,
    phase: room.phase,
    players: { A: !!room.players.A, B: !!room.players.B },
    yourSlot: viewerSlot,
    mySubmittedSecret,
    opponentSubmittedSecret,
    mySubmittedAnswer,
    opponentSubmittedAnswer,
    opponentSecretViews,
    reveal,
    results: room.results,
  };
}

export type PublicRoom = ReturnType<typeof publicView>;
