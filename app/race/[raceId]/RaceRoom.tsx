"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ViewGrid from "@/components/ViewGrid";
import { Voxels, ViewMask, ViewName } from "@/lib/voxel";
import IdentityGate from "@/components/IdentityGate";

const CubeBuilder = dynamic(() => import("@/components/CubeBuilder"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-slate-400">
      載入 3D 場景…
    </div>
  ),
});

type Phase = "waiting" | "playing" | "done";

type CurrentRound = {
  index: number;
  difficulty: number;
  views: Record<ViewName, ViewMask>;
  youForfeited: boolean;
  opponentForfeited: boolean;
};

type HistoryRound = {
  index: number;
  difficulty: number;
  winner: "A" | "B" | "tie" | null;
  targetVoxels: [number, number, number][] | null;
};

type RaceData = {
  id: string;
  phase: Phase;
  players: { A: boolean; B: boolean };
  yourSlot: "A" | "B" | null;
  currentRoundIndex: number;
  totalRounds: number;
  scores: { A: number; B: number };
  currentRound: CurrentRound | null;
  history: HistoryRound[];
};

export default function RaceRoomWrapper({ raceId }: { raceId: string }) {
  return (
    <IdentityGate>
      {(studentId) => <RaceRoom raceId={raceId} studentId={studentId} />}
    </IdentityGate>
  );
}

function RaceRoom({
  raceId,
  studentId,
}: {
  raceId: string;
  studentId: string;
}) {
  const playerIdRef = useRef<string>(studentId);
  const [room, setRoom] = useState<RaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voxels, setVoxels] = useState<Voxels>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [wrongHint, setWrongHint] = useState(false);
  const lastRoundRef = useRef<number>(-1);

  useEffect(() => {
    playerIdRef.current = studentId;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(
          `/api/races/${raceId}?playerId=${encodeURIComponent(playerIdRef.current)}`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `房間查無資料 (${r.status})`);
        }
        const data: RaceData = await r.json();
        if (alive && data.yourSlot === null && !data.players.B) {
          const j = await fetch(`/api/races/${raceId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              playerId: playerIdRef.current,
              action: "join",
            }),
          });
          if (j.ok) {
            const jd: RaceData = await j.json();
            if (alive) setRoom(jd);
          }
        } else if (alive) {
          setRoom(data);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) timer = setTimeout(tick, 1500);
      }
    }
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [raceId, studentId]);

  // 換題時清空 builder
  useEffect(() => {
    if (!room?.currentRound) return;
    if (lastRoundRef.current !== room.currentRound.index) {
      lastRoundRef.current = room.currentRound.index;
      setVoxels(new Set());
      setWrongHint(false);
      setError(null);
    }
  }, [room?.currentRound?.index, room?.currentRound]);

  const submit = useCallback(async () => {
    if (!room?.currentRound) return;
    setSubmitting(true);
    setError(null);
    setWrongHint(false);
    try {
      const arr: [number, number, number][] = Array.from(voxels, (k) => {
        const [x, y, z] = k.split(",").map(Number);
        return [x, y, z];
      });
      const r = await fetch(`/api/races/${raceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: playerIdRef.current,
          action: "submit_answer",
          voxels: arr,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "送出失敗");
      if (data.correct) {
        setRoom(data.room);
      } else {
        setWrongHint(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [voxels, raceId, room?.currentRound]);

  const forfeit = useCallback(async () => {
    if (!confirm("確定放棄這題？對手還有機會搶分。")) return;
    setError(null);
    try {
      const r = await fetch(`/api/races/${raceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: playerIdRef.current,
          action: "forfeit",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "放棄失敗");
      setRoom(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [raceId]);

  if (!room) {
    return (
      <div className="mt-8">
        {error ? (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-800">
            {error}
          </div>
        ) : (
          <div className="text-slate-500">連線房間中…</div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Header room={room} />
      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      <div className="mt-6">
        {room.phase === "waiting" && (
          <WaitingView roomId={room.id} amHost={room.yourSlot === "A"} />
        )}
        {room.phase === "playing" && room.currentRound && (
          <PlayView
            round={room.currentRound}
            voxels={voxels}
            setVoxels={setVoxels}
            onSubmit={submit}
            onForfeit={forfeit}
            submitting={submitting}
            wrongHint={wrongHint}
          />
        )}
        {room.phase === "done" && <DoneView room={room} />}
      </div>
    </div>
  );
}

function Header({ room }: { room: RaceData }) {
  const phaseLabel: Record<Phase, string> = {
    waiting: "等待對手加入",
    playing: `第 ${Math.min(room.currentRoundIndex + 1, room.totalRounds)} / ${room.totalRounds} 題`,
    done: "比賽結束",
  };
  const meLabel = room.yourSlot
    ? `${room.yourSlot}${room.yourSlot === "A" ? "（紅方）" : "（藍方）"}`
    : "觀戰";
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs text-slate-500">房間代碼</div>
        <div className="text-2xl font-mono font-bold tracking-widest">
          {room.id}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500">進度</div>
        <div className="font-semibold">{phaseLabel[room.phase]}</div>
        <div className="mt-1 text-sm">
          <span className="text-rose-600 font-semibold">A</span>:{" "}
          <span className="font-mono font-bold">{room.scores.A}</span> ·{" "}
          <span className="text-blue-600 font-semibold">B</span>:{" "}
          <span className="font-mono font-bold">{room.scores.B}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">你是：{meLabel}</div>
      </div>
    </div>
  );
}

function WaitingView({ roomId, amHost }: { roomId: string; amHost: boolean }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-5xl mb-3">⚡</div>
      {amHost ? (
        <>
          <p className="text-lg font-semibold">傳代碼給對手：</p>
          <div className="mt-4 inline-block rounded-lg bg-slate-900 px-6 py-3 text-3xl font-mono tracking-widest text-white">
            {roomId}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            他加入後比賽自動開始，總共 10 題、難度漸增。
          </p>
        </>
      ) : (
        <p className="text-slate-600">嘗試加入中…</p>
      )}
    </div>
  );
}

function PlayView({
  round,
  voxels,
  setVoxels,
  onSubmit,
  onForfeit,
  submitting,
  wrongHint,
}: {
  round: CurrentRound;
  voxels: Voxels;
  setVoxels: (v: Voxels) => void;
  onSubmit: () => void;
  onForfeit: () => void;
  submitting: boolean;
  wrongHint: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex items-center justify-between flex-wrap gap-2">
          <span>
            ⚡ 同題搶答 · 第 {round.index + 1} 題（難度 {round.difficulty}/10）
          </span>
          {round.youForfeited && (
            <span className="font-semibold text-slate-500">你已放棄此題</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="text-sm text-slate-600">
            方塊：<span className="font-semibold">{voxels.size}</span>
          </div>
          <button
            onClick={() => setVoxels(new Set())}
            className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            清空
          </button>
        </div>
        <div className="mt-3 h-[55vh] min-h-[360px] max-h-[560px] lg:h-[520px] rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          <CubeBuilder voxels={voxels} onChange={setVoxels} color="#f59e0b" />
        </div>
        <div className="mt-2 text-xs text-slate-500">
          👆 點透明格放方塊，點實心方塊移除。
        </div>
        {wrongHint && (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
            ✗ 答案不符，再檢查看看（答錯沒有懲罰，可以繼續調整）
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onSubmit}
            disabled={
              submitting || voxels.size === 0 || round.youForfeited
            }
            className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-white font-semibold disabled:bg-slate-300 hover:bg-amber-700"
          >
            {submitting ? "送出中…" : "送出答案"}
          </button>
          <button
            onClick={onForfeit}
            disabled={submitting || round.youForfeited}
            className="rounded-lg border-2 border-slate-300 px-4 py-3 text-slate-600 font-medium disabled:opacity-40 hover:bg-slate-100"
          >
            放棄這題
          </button>
        </div>
      </div>
      <aside>
        <h2 className="font-semibold">這題的三視圖</h2>
        <div className="mt-3 flex flex-wrap gap-3 lg:flex-col">
          {(["front", "top", "side"] as const).map((name) => (
            <ViewGrid key={name} name={name} mask={round.views[name]} />
          ))}
        </div>
        {round.opponentForfeited && !round.youForfeited && (
          <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            🎯 對手放棄了！你只要答對就拿這 1 分。
          </div>
        )}
      </aside>
    </div>
  );
}

function DoneView({ room }: { room: RaceData }) {
  const aWins = room.scores.A;
  const bWins = room.scores.B;
  const winnerLabel =
    aWins === bWins
      ? "平手！"
      : aWins > bWins
        ? "A 獲勝 🏆"
        : "B 獲勝 🏆";
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">比賽結束</h2>
        <div className="mt-2 text-lg">
          最終比分 — <span className="text-rose-600 font-semibold">A</span>:{" "}
          <span className="font-mono font-bold">{aWins}</span> ·{" "}
          <span className="text-blue-600 font-semibold">B</span>:{" "}
          <span className="font-mono font-bold">{bWins}</span>
        </div>
        <div className="mt-1 text-2xl font-bold text-amber-600">{winnerLabel}</div>
      </div>
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
        <h3 className="font-semibold mb-3">每題回顧</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          {room.history.map((h) => {
            const cls =
              h.winner === "A"
                ? "border-rose-300 bg-rose-50 text-rose-800"
                : h.winner === "B"
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : h.winner === "tie"
                    ? "border-slate-300 bg-slate-50 text-slate-500"
                    : "border-slate-200 bg-white text-slate-400";
            return (
              <div
                key={h.index}
                className={`rounded-lg border p-2 text-center ${cls}`}
              >
                <div className="text-xs text-slate-500">
                  第 {h.index + 1} 題 · 難 {h.difficulty}
                </div>
                <div className="font-semibold mt-1">
                  {h.winner === "tie"
                    ? "流局"
                    : h.winner === null
                      ? "—"
                      : `${h.winner} 拿分`}
                </div>
                {h.targetVoxels && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {h.targetVoxels.length} 塊
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-sm text-slate-500">
        想再來一場？回大廳建新房間即可。
      </div>
    </div>
  );
}
