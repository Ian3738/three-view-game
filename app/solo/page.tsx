import Link from "next/link";
import { LEVELS } from "@/lib/levels";

export default function SoloIndex() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold">單人闖關</h1>
        <p className="mt-2 text-slate-600">
          每一關會給你三個視圖，按照視圖在 3D 場景中拼出對應的立方體組合。
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVELS.map((lv) => (
            <Link
              key={lv.id}
              href={`/solo/${lv.id}`}
              className="rounded-xl border-2 border-slate-200 bg-white p-5 hover:border-blue-500 hover:shadow transition"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{lv.name}</h2>
                <span className="text-xs text-slate-500">
                  {lv.minCubes ? `${lv.minCubes} 個方塊` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{lv.hint}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
