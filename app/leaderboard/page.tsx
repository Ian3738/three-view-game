import Link from "next/link";
import { getLeaderboard, listAllClasses } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { class?: string };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { class: classFilter } = await searchParams;
  const [board, classes] = await Promise.all([
    getLeaderboard({ classCode: classFilter, limit: 100 }),
    listAllClasses(),
  ]);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold">對戰排行榜</h1>
        <p className="mt-2 text-slate-600">
          依「解題答對場數」排序。每打贏一輪 +1 分。
        </p>

        {classes.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">班級篩選：</span>
            <Link
              href="/leaderboard"
              className={`rounded-full border px-3 py-1 text-sm ${
                !classFilter
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
              }`}
            >
              全部
            </Link>
            {classes.map((c) => (
              <Link
                key={c}
                href={`/leaderboard?class=${encodeURIComponent(c)}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  classFilter === c
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          {board.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              還沒有人對戰過 — 去 <Link href="/battle" className="underline text-rose-600">雙人對戰</Link> 開第一場吧！
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left w-16">名次</th>
                  <th className="px-4 py-3 text-left">學生</th>
                  <th className="px-4 py-3 text-right">勝場</th>
                  <th className="px-4 py-3 text-right text-slate-400">敗場</th>
                  <th className="px-4 py-3 text-right text-slate-400">總場</th>
                </tr>
              </thead>
              <tbody>
                {board.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-t border-slate-100 ${i < 3 ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{s.classCode}</span>
                      <span className="text-slate-500">
                        {" "}· {String(s.seatNo).padStart(2, "0")} 號
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {s.wins}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {s.losses}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {s.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          排行榜每次重新整理會抓最新資料。資料保留至 Redis TTL 結束。
        </p>
      </div>
    </main>
  );
}
