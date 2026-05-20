"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ViewGrid from "@/components/ViewGrid";
import {
  projectAll,
  viewsEqual,
  ViewMask,
  ViewName,
  Voxels,
} from "@/lib/voxel";
import { generatePuzzle } from "@/lib/puzzleGen";

const CubeBuilder = dynamic(() => import("@/components/CubeBuilder"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-slate-400">
      載入 3D 場景…
    </div>
  ),
});

type Tier = "easy" | "medium" | "hard";

const TIER_LABEL: Record<Tier, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

function difficultyFromTier(tier: Tier): number {
  // 各 tier 取一個隨機難度，給變化
  if (tier === "easy") return 1 + Math.floor(Math.random() * 3); // 1-3
  if (tier === "medium") return 4 + Math.floor(Math.random() * 3); // 4-6
  return 7 + Math.floor(Math.random() * 4); // 7-10
}

type Puzzle = {
  views: Record<ViewName, ViewMask>;
  answer: [number, number, number][];
  difficulty: number;
};

export default function ShadowSoloGame() {
  const [tier, setTier] = useState<Tier>("easy");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [voxels, setVoxels] = useState<Voxels>(new Set());
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "ok"; cubes: number }
    | { kind: "bad"; mismatches: ViewName[] }
  >({ kind: "idle" });
  const [solvedCount, setSolvedCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // 第一次 mount 產一題
  useEffect(() => {
    nextPuzzle("easy");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextPuzzle = (t: Tier) => {
    const d = difficultyFromTier(t);
    const p = generatePuzzle(d);
    setPuzzle({ views: p.views, answer: p.voxels, difficulty: p.difficulty });
    setVoxels(new Set());
    setResult({ kind: "idle" });
    setShowAnswer(false);
  };

  const onChange = (v: Voxels) => {
    setVoxels(v);
    if (result.kind !== "idle") setResult({ kind: "idle" });
  };

  const myViews = useMemo(() => projectAll(voxels), [voxels]);

  const check = () => {
    if (!puzzle) return;
    const { ok, mismatches } = viewsEqual(myViews, puzzle.views);
    if (ok) {
      setResult({ kind: "ok", cubes: voxels.size });
      setSolvedCount((c) => c + 1);
    } else {
      setResult({ kind: "bad", mismatches });
    }
  };

  const giveUp = () => {
    setShowAnswer(true);
  };

  if (!puzzle) {
    return <div className="mt-6 text-slate-400">產生題目中…</div>;
  }

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">難度：</span>
          {(["easy", "medium", "hard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTier(t);
                nextPuzzle(t);
              }}
              className={`rounded-md border-2 px-3 py-1 text-sm font-medium ${
                tier === t
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
          <span className="ml-2 text-xs text-slate-400">
            這題難度 {puzzle.difficulty}/10
          </span>
          <span className="ml-auto text-sm text-slate-500">
            已解 <span className="font-semibold text-emerald-700">{solvedCount}</span> 題
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-600">
            方塊：<span className="font-semibold">{voxels.size}</span>
          </div>
          <button
            onClick={() => {
              setVoxels(new Set());
              setResult({ kind: "idle" });
            }}
            className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            清空
          </button>
        </div>

        <div className="h-[55vh] min-h-[360px] max-h-[560px] lg:h-[520px] rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          <CubeBuilder voxels={voxels} onChange={onChange} />
        </div>
        <div className="text-xs text-slate-500">
          👆 點透明格放方塊，點實心方塊移除。
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">這題的三視圖</h2>
        </div>
        <div className="flex flex-wrap gap-3 lg:flex-col">
          {(["front", "top", "side"] as const).map((name) => {
            const bad =
              result.kind === "bad" && result.mismatches.includes(name);
            return (
              <ViewGrid
                key={name}
                name={name}
                mask={puzzle.views[name]}
                highlight={bad ? "bad" : "neutral"}
              />
            );
          })}
        </div>

        {result.kind !== "ok" && !showAnswer && (
          <div className="space-y-2">
            <button
              onClick={check}
              disabled={voxels.size === 0}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-white font-semibold disabled:bg-slate-300 hover:bg-emerald-700 transition"
            >
              檢查答案
            </button>
            <button
              onClick={giveUp}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              看答案
            </button>
          </div>
        )}

        {result.kind === "ok" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm">
            <div className="font-semibold text-emerald-800">✓ 正確！</div>
            <div className="mt-1 text-emerald-700">
              用了 {result.cubes} 個方塊
            </div>
          </div>
        )}

        {result.kind === "bad" && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
            <div className="font-semibold">尚未符合三視圖</div>
            <div className="mt-1 text-xs">
              {result.mismatches
                .map((m) =>
                  m === "front" ? "前視圖" : m === "top" ? "上視圖" : "右視圖"
                )
                .join("、")}{" "}
              不對，紅色標示的視圖跟你的不一樣。
            </div>
          </div>
        )}

        {showAnswer && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            參考答案：{puzzle.answer.length} 個方塊。重試或下一題。
          </div>
        )}

        <button
          onClick={() => nextPuzzle(tier)}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-700 transition"
        >
          下一題 →
        </button>
      </aside>
    </div>
  );
}
