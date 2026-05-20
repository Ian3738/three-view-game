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
import type { BuilderMode } from "@/components/CubeBuilder";

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
  const [mode, setMode] = useState<BuilderMode>("add");
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
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{levelName}</h1>
          <p className="text-slate-600 text-sm mt-1">{hint}</p>
        </div>

        <div className="flex items-center gap-2">
          <ModeButton
            active={mode === "add"}
            onClick={() => setMode("add")}
            label="新增"
            color="blue"
          />
          <ModeButton
            active={mode === "remove"}
            onClick={() => setMode("remove")}
            label="移除"
            color="rose"
          />
          <div className="ml-4 text-sm text-slate-600">
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

        <div className="h-[480px] rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          <CubeBuilder voxels={voxels} onChange={onChange} mode={mode} />
        </div>

        <div className="text-xs text-slate-500">
          滑鼠拖曳：旋轉視角 · 滾輪：縮放 ·{" "}
          {mode === "add"
            ? "點地面或既有方塊：放置新方塊"
            : "點方塊：移除方塊"}
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">目標三視圖</h2>
          <p className="text-xs text-slate-500 mt-1">
            黑色 = 此格至少有一個方塊。請拼出符合三張視圖的立體。
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
                  {m === "front" ? "正視圖" : m === "top" ? "俯視圖" : "側視圖"}
                </span>
              ))}
            </div>
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="text-sm font-medium cursor-pointer">
            你目前的三視圖（即時預覽）
          </summary>
          <div className="mt-3 flex flex-col gap-3">
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

function ModeButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: "blue" | "rose";
}) {
  const activeCls =
    color === "blue"
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-rose-600 text-white border-rose-600";
  return (
    <button
      onClick={onClick}
      className={`rounded-md border-2 px-4 py-1.5 text-sm font-medium ${
        active ? activeCls : "bg-white text-slate-700 border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
