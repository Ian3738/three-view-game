"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Phase =
  | "waiting"
  | "setting1"
  | "solving1"
  | "setting2"
  | "solving2"
  | "done";

type RoundResult = {
  setter: "A" | "B";
  solver: "A" | "B";
  cubesUsed: number;
  correct: boolean;
  mismatches: ViewName[];
};

type RoomData = {
  id: string;
  phase: Phase;
  players: { A: boolean; B: boolean };
  yourSlot: "A" | "B" | null;
  views: Record<ViewName, ViewMask> | null;
  secretVoxels: [number, number, number][] | null;
  lastAnswer: [number, number, number][] | null;
  results: RoundResult[];
};

export default function BattleRoomWrapper({ roomId }: { roomId: string }) {
  return (
    <IdentityGate>
      {(studentId) => <BattleRoom roomId={roomId} studentId={studentId} />}
    </IdentityGate>
  );
}

function BattleRoom({
  roomId,
  studentId,
}: {
  roomId: string;
  studentId: string;
}) {
  const playerIdRef = useRef<string>(studentId);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voxels, setVoxels] = useState<Voxels>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const lastPhaseRef = useRef<Phase | null>(null);

  // 嘗試加入、開始 polling
  useEffect(() => {
    playerIdRef.current = studentId;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(
          `/api/rooms/${roomId}?playerId=${encodeURIComponent(playerIdRef.current)}`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `房間查無資料 (${r.status})`);
        }
        const data: RoomData = await r.json();
        // 如果我還沒被認到任何 slot，且還有空位，嘗試加入
        if (alive && data.yourSlot === null && !data.players.B) {
          const j = await fetch(`/api/rooms/${roomId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              playerId: playerIdRef.current,
              action: "join",
            }),
          });
          if (j.ok) {
            const jd: RoomData = await j.json();
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
  }, [roomId, studentId]);

  // 每次階段切換時清空本地建造中的方塊
  useEffect(() => {
    if (!room) return;
    if (lastPhaseRef.current !== room.phase) {
      lastPhaseRef.current = room.phase;
      setVoxels(new Set());
      setError(null);
    }
  }, [room]);

  const me = room?.yourSlot ?? null;
  const phase = room?.phase ?? "waiting";

  const isSetter =
    (phase === "setting1" && me === "A") ||
    (phase === "setting2" && me === "B");
  const isSolver =
    (phase === "solving1" && me === "B") ||
    (phase === "solving2" && me === "A");

  const submit = useCallback(
    async (action: "submit_secret" | "submit_answer") => {
      setSubmitting(true);
      setError(null);
      try {
        const arr: [number, number, number][] = Array.from(voxels, (k) => {
          const [x, y, z] = k.split(",").map(Number);
          return [x, y, z];
        });
        const r = await fetch(`/api/rooms/${roomId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerId: playerIdRef.current,
            action,
            voxels: arr,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "送出失敗");
        setRoom(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [voxels, roomId]
  );

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
      <Header room={room} me={me} />
      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      <div className="mt-6">
        {phase === "waiting" && <WaitingView roomId={room.id} me={me} />}

        {(phase === "setting1" || phase === "setting2") &&
          (isSetter ? (
            <SetterView
              voxels={voxels}
              setVoxels={setVoxels}
              onSubmit={() => submit("submit_secret")}
              submitting={submitting}
            />
          ) : (
            <WaitingForOther label="等對手出題中…" />
          ))}

        {(phase === "solving1" || phase === "solving2") &&
          (isSolver && room.views ? (
            <SolverView
              targetViews={room.views}
              voxels={voxels}
              setVoxels={setVoxels}
              onSubmit={() => submit("submit_answer")}
              submitting={submitting}
            />
          ) : (
            <WaitingForOther label="等對手解題中…" />
          ))}

        {phase === "done" && <DoneView room={room} me={me} />}
      </div>
    </div>
  );
}

function Header({ room, me }: { room: RoomData; me: "A" | "B" | null }) {
  const phaseLabel: Record<Phase, string> = {
    waiting: "等待對手加入",
    setting1: "第 1 輪 · A 出題",
    solving1: "第 1 輪 · B 解題",
    setting2: "第 2 輪 · B 出題",
    solving2: "第 2 輪 · A 解題",
    done: "對戰結束",
  };
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-slate-500">房間代碼</div>
        <div className="text-2xl font-mono font-bold tracking-widest">
          {room.id}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500">階段</div>
        <div className="font-semibold">{phaseLabel[room.phase]}</div>
        <div className="text-xs text-slate-500 mt-1">
          你是：
          <span className="font-semibold">
            {me ?? "觀戰"} {me === "A" ? "（紅方）" : me === "B" ? "（藍方）" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function WaitingView({
  roomId,
  me,
}: {
  roomId: string;
  me: "A" | "B" | null;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-5xl mb-3">👥</div>
      {me === "A" ? (
        <>
          <p className="text-lg font-semibold">把這個代碼傳給對手：</p>
          <div className="mt-4 inline-block rounded-lg bg-slate-900 px-6 py-3 text-3xl font-mono tracking-widest text-white">
            {roomId}
          </div>
          <p className="mt-4 text-sm text-slate-500">他加入後遊戲會自動開始。</p>
        </>
      ) : (
        <p className="text-slate-600">嘗試加入中…</p>
      )}
    </div>
  );
}

function WaitingForOther({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-5xl mb-3">⏳</div>
      <p className="text-slate-600">{label}</p>
    </div>
  );
}

function SetterView({
  voxels,
  setVoxels,
  onSubmit,
  submitting,
}: {
  voxels: Voxels;
  setVoxels: (v: Voxels) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        🤫 偷偷蓋一個立體圖。對手只會看到你的三視圖，不會看到立體本身。建議
        3-6 個方塊，太簡單沒挑戰、太難對手猜不到。
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
        <CubeBuilder voxels={voxels} onChange={setVoxels} color="#dc2626" />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        👆 點透明格放方塊，點實心方塊移除。
      </div>
      <button
        onClick={onSubmit}
        disabled={submitting || voxels.size === 0}
        className="mt-4 w-full rounded-lg bg-rose-600 px-4 py-3 text-white font-semibold disabled:bg-slate-300 hover:bg-rose-700"
      >
        {submitting ? "送出中…" : "送出題目，換對手解"}
      </button>
    </div>
  );
}

function SolverView({
  targetViews,
  voxels,
  setVoxels,
  onSubmit,
  submitting,
}: {
  targetViews: Record<ViewName, ViewMask>;
  voxels: Voxels;
  setVoxels: (v: Voxels) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">
          🔍 對手已出題，看下面（或右邊）的三視圖把立體還原。確定後按「送出答案」。
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
          <CubeBuilder voxels={voxels} onChange={setVoxels} color="#2563eb" />
        </div>
        <div className="mt-2 text-xs text-slate-500">
          👆 點透明格放方塊，點實心方塊移除。
        </div>
        <button
          onClick={onSubmit}
          disabled={submitting || voxels.size === 0}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold disabled:bg-slate-300 hover:bg-blue-700"
        >
          {submitting ? "送出中…" : "送出答案"}
        </button>
      </div>
      <aside>
        <h2 className="font-semibold">對手出的三視圖</h2>
        <div className="mt-3 flex flex-wrap gap-3 lg:flex-col">
          {(["front", "top", "side"] as const).map((name) => (
            <ViewGrid key={name} name={name} mask={targetViews[name]} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function DoneView({ room, me }: { room: RoomData; me: "A" | "B" | null }) {
  const score = useMemo(() => {
    let a = 0;
    let b = 0;
    for (const r of room.results) {
      if (!r.correct) continue;
      if (r.solver === "A") a++;
      else b++;
    }
    return { a, b };
  }, [room.results]);

  const winner =
    score.a === score.b ? "平手" : score.a > score.b ? "A 獲勝 🏆" : "B 獲勝 🏆";

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold">對戰結束</h2>
      <div className="mt-2 text-lg">
        比分 — A: <span className="font-mono font-bold">{score.a}</span> · B:{" "}
        <span className="font-mono font-bold">{score.b}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-rose-600">{winner}</div>
      <div className="mt-4 space-y-2">
        {room.results.map((r, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div>
              第 {i + 1} 輪 · {r.setter} 出題 → {r.solver} 解題
            </div>
            <div className="mt-1">
              {r.correct ? (
                <span className="text-emerald-700 font-medium">
                  ✓ 正確（用了 {r.cubesUsed} 個方塊）
                </span>
              ) : (
                <span className="text-rose-700 font-medium">
                  ✗ 不符（用了 {r.cubesUsed} 個方塊，
                  {r.mismatches.length > 0 &&
                    r.mismatches.map((m) =>
                      m === "front" ? "前視圖" : m === "top" ? "上視圖" : "右視圖"
                    ).join("、") + " 不對"}
                  ）
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-slate-500">
        你是 {me ?? "觀戰"}。想再來一場？回大廳建新房間即可。
      </div>
    </div>
  );
}


