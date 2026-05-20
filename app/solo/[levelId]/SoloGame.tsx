"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ViewGrid from "@/components/ViewGrid";
import {
  projectAll,
  viewsEqual,
  ViewMask,
  ViewName,
  Voxels,
} from "@/lib/voxel";

const CubeBuilder = dynamic(() => import("@/components/CubeBuilder"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-slate-400">
      載入 3D 場景…
    </div>
  ),
});

type Props = {
  levelName: string;
  hint: string;
  minCubes: number | null;
  targetViews: Record<ViewName, ViewMask>;
};

export default function SoloGame({ levelName, hint, minCubes, targetViews }: Props) {
  const [voxels, setVoxels] = useState<Voxels>(new Set());
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "ok"; usedCubes: number; minimal: boolean }
    | { kind: "bad"; mismatches: ViewName[] }
  >({ kind: "idle" });

  const myViews = useMemo(() => projectAll(voxels), [voxels]);
  const cubeCount = voxels.size;

  const check = () => {
    const { ok, mismatches } = viewsEqual(myViews, targetViews);
    if (!ok) {
      setResult({ kind: "bad", mismatches });
    } else {
      setResult({
        kind: "ok",
        usedCubes: cubeCount,
        minimal: minCubes == null ? true : cubeCount === minCubes,
      });
    }
  };

  const reset = () => {
    setVoxels(new Set());
    setResult({ kind: "idle" });
  };

  const onChange = (v: Voxels) => {
    setVoxels(v);
    if (result.kind !== "idle") setResult({ kind: "idle" });
  };

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{levelName}</h1>
          <p className="text-slate-600 text-sm mt-1">{hint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-600">
            已用方塊：<span className="font-semibold">{cubeCount}</span>
            {minCubes != null && (
              <span className="text-slate-400"> / 目標 {minCubes}</span>
            )}
          </div>
          <button
            onClick={reset}
            className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            清空
          </button>
        </div>

        <div className="h-[55vh] min-h-[360px] max-h-[560px] lg:h-[520px] rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          <CubeBuilder voxels={voxels} onChange={onChange} />
        </div>

        <div className="text-xs text-slate-500 leading-relaxed">
          👆 <b>點透明格</b>放新方塊 · <b>點實心方塊</b>移除它 ·
          拖曳場景旋轉視角 · 兩指縮放（觸控）／滾輪縮放（桌面）
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">目標三視圖</h2>
          <p className="text-xs text-slate-500 mt-1">
            黑色 = 此格至少有一個方塊。請拼出符合三張視圖的立體。
          </p>
        </div>

        <div className="flex flex-wrap gap-3 lg:flex-col">
          {(["front", "top", "side"] as const).map((name) => {
            const bad =
              result.kind === "bad" && result.mismatches.includes(name);
            return (
              <ViewGrid
                key={name}
                name={name}
                mask={targetViews[name]}
                highlight={bad ? "bad" : "neutral"}
              />
            );
          })}
        </div>

        <button
          onClick={check}
          disabled={cubeCount === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold disabled:bg-slate-300 hover:bg-blue-700 transition"
        >
          檢查答案
        </button>

        {result.kind === "ok" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm">
            <div className="font-semibold text-emerald-800">✓ 三視圖正確！</div>
            <div className="mt-1 text-emerald-700">
              用了 {result.usedCubes} 個方塊
              {minCubes != null && !result.minimal && (
                <> — 還可以用更少喔（目標 {minCubes} 個）</>
              )}
              {result.minimal && minCubes != null && (
                <> — 達到最少方塊數！🎉</>
              )}
            </div>
          </div>
        )}

        {result.kind === "bad" && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
            <div className="font-semibold">尚未符合三視圖</div>
            <div className="mt-1">
              紅色標示的視圖跟你建的不一樣：
              {result.mismatches.map((m) => (
                <span
                  key={m}
                  className="inline-block ml-1 px-1.5 py-0.5 bg-rose-100 rounded text-xs"
                >
                  {m === "front" ? "前視圖" : m === "top" ? "上視圖" : "右視圖"}
                </span>
              ))}
            </div>
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="text-sm font-medium cursor-pointer">
            你目前的三視圖（即時預覽）
          </summary>
          <div className="mt-3 flex flex-wrap gap-3 lg:flex-col">
            {(["front", "top", "side"] as const).map((name) => (
              <ViewGrid
                key={name}
                name={name}
                mask={myViews[name]}
                cellSize={20}
              />
            ))}
          </div>
        </details>
      </aside>
    </div>
  );
}
