import { ViewMask, ViewName, VIEW_LABEL } from "@/lib/voxel";

type Props = {
  mask: ViewMask;
  name: ViewName;
  highlight?: "ok" | "bad" | "neutral";
  cellSize?: number;
};

const HIGHLIGHT_CLASS: Record<NonNullable<Props["highlight"]>, string> = {
  ok: "border-emerald-400 bg-emerald-50",
  bad: "border-rose-400 bg-rose-50",
  neutral: "border-slate-300 bg-white",
};

export default function ViewGrid({
  mask,
  name,
  highlight = "neutral",
  cellSize = 32,
}: Props) {
  return (
    <div
      className={`inline-flex flex-col items-center gap-2 rounded-lg border-2 p-3 ${HIGHLIGHT_CLASS[highlight]}`}
    >
      <div className="text-sm font-medium text-slate-700">{VIEW_LABEL[name]}</div>
      <div
        className="grid gap-0.5 bg-slate-200 p-0.5 rounded"
        style={{
          gridTemplateColumns: `repeat(${mask[0]?.length ?? 0}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${mask.length}, ${cellSize}px)`,
        }}
      >
        {mask.map((row, r) =>
          row.map((filled, c) => (
            <div
              key={`${r}-${c}`}
              className={filled ? "bg-slate-800" : "bg-white"}
              style={{ width: cellSize, height: cellSize }}
            />
          ))
        )}
      </div>
    </div>
  );
}
