import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          三視圖大挑戰
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          看前視圖、上視圖、右視圖，把立方體拼回來。
          <br />
          訓練空間想像力，挑戰自己也挑戰朋友。
        </p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link
            href="/solo"
            className="group rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-blue-500 hover:shadow-lg transition"
          >
            <div className="text-5xl mb-3">🧱</div>
            <h2 className="text-2xl font-semibold text-slate-900">單人闖關</h2>
            <p className="mt-2 text-sm text-slate-600">
              從簡單到困難，6 個關卡循序漸進。
            </p>
            <div className="mt-4 inline-flex items-center text-blue-600 font-medium group-hover:translate-x-1 transition">
              開始 →
            </div>
          </Link>

          <Link
            href="/battle"
            className="group rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-rose-500 hover:shadow-lg transition"
          >
            <div className="text-5xl mb-3">⚔️</div>
            <h2 className="text-2xl font-semibold text-slate-900">雙人對戰</h2>
            <p className="mt-2 text-sm text-slate-600">
              出題互打：你建一個秘密形狀，對手只看三視圖還原。
            </p>
            <div className="mt-4 inline-flex items-center text-rose-600 font-medium group-hover:translate-x-1 transition">
              建房間 →
            </div>
          </Link>
        </div>

        <div className="mt-10">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm text-slate-700 hover:border-amber-500 hover:text-amber-700"
          >
            🏆 看對戰排行榜
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          建議使用桌面瀏覽器，支援滑鼠拖曳旋轉立體圖。
        </p>
      </div>
    </main>
  );
}
