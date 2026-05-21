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

type Phase = "waiting" | "setting" | "solving" | "done";

type RoundResult = {
  solver: "A" | "B";
  setter: "A" | "B";
  cubesUsed: number;
  correct: boolean;
  mismatches: ViewName[];
};

type RoomData = {
  id: string;
  phase: Phase;
  players: { A: boolean; B: boolean };
  yourSlot: "A" | "B" | null;
  mySubmittedSecret: boolean;
  opponentSubmittedSecret: boolean;
  mySubmittedAnswer: boolean;
  opponentSubmittedAnswer: boolean;
  opponentSecretViews: Record<ViewName, ViewMask> | null;
  reveal: {
    A: { voxels: [number, number, number][] } | null;
    B: { voxels: [number, number, number][] } | null;
  };
  results: { A: RoundResult | null; B: RoundResult | null };
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

  // polling + 自動加入
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

  // 階段切換時清空本地建造中的方塊
  useEffect(() => {
    if (!room) return;
    if (lastPhaseRef.current !== room.phase) {
      lastPhaseRef.current = room.phase;
      setVoxels(new Set());
      setError(null);
    }
  }, [room]);

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
        // 送出後清空 builder，避免 solving 階段還看到 setting 時建的東西
        setVoxels(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [voxels, roomId]
  );

  const restart = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/rooms/${roomId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: playerIdRef.current,
          action: "restart",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "重啟失敗");
      setRoom(data);
      setVoxels(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [roomId]);

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

        {room.phase === "setting" &&
          (room.mySubmittedSecret ? (
            <WaitingForOther
              label="✓ 你已出題！等對手出題中…"
              detail={
                room.opponentSubmittedSecret
                  ? "對手也出完了，準備進入解題…"
                  : "對手還在蓋自己的秘密形狀"
              }
            />
          ) : (
            <SetterView
              voxels={voxels}
              setVoxels={setVoxels}
              opponentReady={room.opponentSubmittedSecret}
              onSubmit={() => submit("submit_secret")}
              submitting={submitting}
            />
          ))}

        {room.phase === "solving" &&
          (room.mySubmittedAnswer ? (
            <WaitingForOther
              label="✓ 你已送出答案！等對手解題中…"
              detail={
                room.opponentSubmittedAnswer
                  ? "對手也解完了，準備公布結果…"
                  : "對手還在解你出的題"
              }
            />
          ) : room.opponentSecretViews ? (
            <SolverView
              targetViews={room.opponentSecretViews}
              voxels={voxels}
              setVoxels={setVoxels}
              opponentDone={room.opponentSubmittedAnswer}
              onSubmit={() => submit("submit_answer")}
              submitting={submitting}
            />
          ) : (
            <WaitingForOther label="載入對手題目中…" />
          ))}

        {room.phase === "done" && <DoneView room={room} onRestart={restart} />}
      </div>
    </div>
  );
}

function Header({ room }: { room: RoomData }) {
  const phaseLabel: Record<Phase, string> = {
    waiting: "等待對手加入",
    setting: "雙方同時出題",
    solving: "雙方同時解題",
    done: "對戰結束",
  };
  const meLabel = room.yourSlot
    ? `${room.yourSlot}${room.yourSlot === "A" ? "（紅方）" : "（藍方）"}`
    : "觀戰";

  // 雙方狀態（出題/解題階段才顯示）
  let aStatus = "";
  let bStatus = "";
  if (room.phase === "setting") {
    aStatus = (room.yourSlot === "A" ? room.mySubmittedSecret : room.opponentSubmittedSecret) ? "✓" : "⏳";
    bStatus = (room.yourSlot === "B" ? room.mySubmittedSecret : room.opponentSubmittedSecret) ? "✓" : "⏳";
  } else if (room.phase === "solving") {
    aStatus = (room.yourSlot === "A" ? room.mySubmittedAnswer : room.opponentSubmittedAnswer) ? "✓" : "⏳";
    bStatus = (room.yourSlot === "B" ? room.mySubmittedAnswer : room.opponentSubmittedAnswer) ? "✓" : "⏳";
  }

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs text-slate-500">房間代碼</div>
        <div className="text-2xl font-mono font-bold tracking-widest">
          {room.id}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500">階段</div>
        <div className="font-semibold">{phaseLabel[room.phase]}</div>
        {(room.phase === "setting" || room.phase === "solving") && (
          <div className="mt-1 flex items-center gap-3 justify-end text-sm">
            <span>
              <span className="text-rose-600 font-semibold">A</span> {aStatus}
            </span>
            <span>
              <span className="text-blue-600 font-semibold">B</span> {bStatus}
            </span>
          </div>
        )}
        <div className="text-xs text-slate-500 mt-1">你是：{meLabel}</div>
      </div>
    </div>
  );
}

function WaitingView({
  roomId,
  amHost,
}: {
  roomId: string;
  amHost: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-5xl mb-3">👥</div>
      {amHost ? (
        <>
          <p className="text-lg font-semibold">把這個代碼傳給對手：</p>
          <div className="mt-4 inline-block rounded-lg bg-slate-900 px-6 py-3 text-3xl font-mono tracking-widest text-white">
            {roomId}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            他加入後雙方就會同時開始出題。
          </p>
        </>
      ) : (
        <p className="text-slate-600">嘗試加入中…</p>
      )}
    </div>
  );
}

function WaitingForOther({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-5xl mb-3">⏳</div>
      <p className="text-slate-700 font-semibold">{label}</p>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function SetterView({
  voxels,
  setVoxels,
  opponentReady,
  onSubmit,
  submitting,
}: {
  voxels: Voxels;
  setVoxels: (v: Voxels) => void;
  opponentReady: boolean;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        🤫 同時開蓋！偷偷蓋一個立體圖。對手只會看到你的三視圖。
        {opponentReady && (
          <span className="ml-1 font-semibold">對手已經出完了，快點！</span>
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
        {submitting ? "送出中…" : "送出題目"}
      </button>
    </div>
  );
}

function SolverView({
  targetViews,
  voxels,
  setVoxels,
  opponentDone,
  onSubmit,
  submitting,
}: {
  targetViews: Record<ViewName, ViewMask>;
  voxels: Voxels;
  setVoxels: (v: Voxels) => void;
  opponentDone: boolean;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">
          🔍 看下方（或右邊）的三視圖把對手出的立體還原。
          {opponentDone && (
            <span className="ml-1 font-semibold">對手已經解完了，加油！</span>
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

function DoneView({
  room,
  onRestart,
}: {
  room: RoomData;
  onRestart: () => void;
}) {
  const score = useMemo(() => {
    let a = 0;
    let b = 0;
    if (room.results.A?.correct) a++;
    if (room.results.B?.correct) b++;
    return { a, b };
  }, [room.results]);

  const winnerLabel =
    score.a === score.b
      ? score.a === 1
        ? "雙方都答對 — 平手！"
        : score.a === 0
          ? "雙方都答錯 — 平手"
          : "平手"
      : score.a > score.b
        ? "A 獲勝 🏆"
        : "B 獲勝 🏆";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">對戰結束</h2>
        <div className="mt-2 text-lg">
          比分 — <span className="text-rose-600 font-semibold">A</span>:{" "}
          <span className="font-mono font-bold">{score.a}</span> ·{" "}
          <span className="text-blue-600 font-semibold">B</span>:{" "}
          <span className="font-mono font-bold">{score.b}</span>
        </div>
        <div className="mt-1 text-2xl font-bold text-amber-600">
          {winnerLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PlayerResultCard
          label="A 的成績"
          color="rose"
          result={room.results.A}
          secret={room.reveal.A}
        />
        <PlayerResultCard
          label="B 的成績"
          color="blue"
          result={room.results.B}
          secret={room.reveal.B}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onRestart}
          className="rounded-lg bg-rose-600 px-5 py-2.5 text-white font-semibold hover:bg-rose-700"
        >
          🔄 再戰一局（同房間）
        </button>
        <span className="text-sm text-slate-500">
          按下後對手畫面也會自動重置開始新一局。
        </span>
      </div>
    </div>
  );
}

function PlayerResultCard({
  label,
  color,
  result,
  secret,
}: {
  label: string;
  color: "rose" | "blue";
  result: RoundResult | null;
  secret: { voxels: [number, number, number][] } | null;
}) {
  const headerCls =
    color === "rose"
      ? "text-rose-700 border-rose-200"
      : "text-blue-700 border-blue-200";

  return (
    <div className={`rounded-xl border-2 bg-white p-4 ${headerCls}`}>
      <div className="font-semibold">{label}</div>
      {result ? (
        <div className="mt-2 text-sm">
          解題：
          {result.correct ? (
            <span className="text-emerald-700 font-semibold">
              ✓ 正確（用 {result.cubesUsed} 個方塊）
            </span>
          ) : (
            <span className="text-rose-700 font-semibold">
              ✗ 不符 — {result.mismatches
                .map((m) =>
                  m === "front" ? "前視圖" : m === "top" ? "上視圖" : "右視圖"
                )
                .join("、")}{" "}
              不對
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-400">未送出答案</div>
      )}
      {secret && (
        <div className="mt-3 text-xs text-slate-500">
          出題的秘密形狀：{secret.voxels.length} 個方塊
        </div>
      )}
    </div>
  );
}
