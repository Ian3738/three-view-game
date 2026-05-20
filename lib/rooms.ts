import { Redis } from "@upstash/redis";
import {
  projectAll,
  viewsEqual,
  Voxels,
  voxelsFromArray,
  ViewMask,
  ViewName,
} from "./voxel";

// ── 房間資料結構 ─────────────────────────────────────────────────────────────
type Slot = "A" | "B";
type Phase =
  | "waiting"
  | "setting1"
  | "solving1"
  | "setting2"
  | "solving2"
  | "done";

type RoundResult = {
  setter: Slot;
  solver: Slot;
  cubesUsed: number;
  correct: boolean;
  mismatches: ViewName[];
};

export type Room = {
  id: string;
  createdAt: number;
  players: { A: string | null; B: string | null };
  phase: Phase;
  secret: {
    voxels: [number, number, number][];
    views: Record<ViewName, ViewMask>;
  } | null;
  answer: { voxels: [number, number, number][] } | null;
  results: RoundResult[];
};

// ── Store 抽象 ──────────────────────────────────────────────────────────────
// 本機 dev：MemoryStore（process 內 Map）
// 部署到 serverless（Vercel）：RedisStore（Upstash REST API）
interface Store {
  get(id: string): Promise<Room | null>;
  save(room: Room): Promise<void>;
  exists(id: string): Promise<boolean>;
}

class MemoryStore implements Store {
  private map: Map<string, Room>;
  constructor() {
    // HMR 期間多次 import 仍只用同一份
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
  private ttlSeconds = 60 * 60 * 24; // 24 小時自動過期，避免房間無限累積
  constructor(redis: Redis) {
    this.redis = redis;
  }
  private k(id: string) {
    return `tvg:room:${id}`;
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
  // 同時接受 Upstash 原生命名與 Vercel KV/Marketplace 的命名
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

// ── 對外 API ─────────────────────────────────────────────────────────────────
export async function createRoom(playerId: string): Promise<Room> {
  let id = makeRoomId();
  while (await store.exists(id)) id = makeRoomId();
  const room: Room = {
    id,
    createdAt: Date.now(),
    players: { A: playerId, B: null },
    phase: "waiting",
    secret: null,
    answer: null,
    results: [],
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
    room.phase = "setting1";
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

function currentSetter(phase: Phase): Slot | null {
  if (phase === "setting1") return "A";
  if (phase === "setting2") return "B";
  return null;
}

function currentSolver(phase: Phase): Slot | null {
  if (phase === "solving1") return "B";
  if (phase === "solving2") return "A";
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
  const setter = currentSetter(room.phase);
  if (!setter || setter !== slot)
    return { ok: false, error: "現在不是你出題" };
  if (voxelsArr.length === 0)
    return { ok: false, error: "至少要放一個方塊" };
  const voxels: Voxels = voxelsFromArray(voxelsArr);
  const views = projectAll(voxels);
  room.secret = { voxels: voxelsArr, views };
  room.answer = null;
  room.phase = room.phase === "setting1" ? "solving1" : "solving2";
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
  const solver = currentSolver(room.phase);
  if (!solver || solver !== slot)
    return { ok: false, error: "現在不是你解題" };
  if (!room.secret) return { ok: false, error: "還沒有題目" };

  const myVoxels = voxelsFromArray(voxelsArr);
  const myViews = projectAll(myVoxels);
  const { ok, mismatches } = viewsEqual(myViews, room.secret.views);

  const setter: Slot = solver === "B" ? "A" : "B";
  room.results.push({
    setter,
    solver,
    cubesUsed: voxelsArr.length,
    correct: ok,
    mismatches,
  });
  room.answer = { voxels: voxelsArr };

  if (room.phase === "solving1") {
    room.phase = "setting2";
    room.secret = null;
    room.answer = null;
  } else {
    room.phase = "done";
  }
  await store.save(room);
  return { ok: true, room };
}

export function publicView(
  room: Room,
  viewerSlot: Slot | null
): {
  id: string;
  phase: Phase;
  players: { A: boolean; B: boolean };
  yourSlot: Slot | null;
  views: Record<ViewName, ViewMask> | null;
  secretVoxels: [number, number, number][] | null;
  lastAnswer: [number, number, number][] | null;
  results: RoundResult[];
} {
  const setter = currentSetter(room.phase);
  const showViewsToSolver =
    room.phase === "solving1" || room.phase === "solving2";
  const views = showViewsToSolver && room.secret ? room.secret.views : null;
  const isSetter = setter !== null && viewerSlot === setter;
  return {
    id: room.id,
    phase: room.phase,
    players: { A: !!room.players.A, B: !!room.players.B },
    yourSlot: viewerSlot,
    views,
    secretVoxels: isSetter && room.secret ? room.secret.voxels : null,
    lastAnswer:
      room.phase === "done" && room.answer ? room.answer.voxels : null,
    results: room.results,
  };
}

export type PublicRoom = ReturnType<typeof publicView>;
