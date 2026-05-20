import Link from "next/link";
import { getLeaderboard, LeaderboardKind, listAllClasses } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { class?: string; kind?: string };

function parseKind(v: string | undefined): LeaderboardKind {
  return v === "race" ? "race" : "battle";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const classFilter = sp.class;

  const [board, classes] = await Promise.all([
    getLeaderboard({ classCode: classFilter, kind, limit: 100 }),
    listAllClasses(),
  ]);

  const kindMeta = {
    battle: {
      title: "雙人對戰排行榜",
      subtitle: "出題互打模式：解題答對 +1 分。",
      scoreLabel: "勝場",
      scoreKey: "wins" as const,
      lossesKey: "losses" as const,
      totalKey: "total" as const,
    },
    race: {
      title: "速度賽排行榜",
      subtitle: "影子陣同題搶答：每題第一個答對的人 +1 分。",
      scoreLabel: "搶分",
      scoreKey: "raceWins" as const,
      lossesKey: "raceLosses" as const,
      totalKey: "raceTotal" as const,
    },
  }[kind];

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{kindMeta.title}</h1>
        <p className="mt-2 text-slate-600">{kindMeta.subtitle}</p>

        {/* 雙榜切換 */}
        <div className="mt-6 inline-flex rounded-lg border-2 border-slate-200 bg-white p-1">
          <KindTab
            href={`/leaderboard${classFilter ? `?class=${encodeURIComponent(classFilter)}` : ""}`}
            active={kind === "battle"}
            label="雙人對戰"
          />
          <KindTab
            href={`/leaderboard?kind=race${classFilter ? `&class=${encodeURIComponent(classFilter)}` : ""}`}
            active={kind === "race"}
            label="速度賽"
          />
        </div>

        {classes.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">班級篩選：</span>
            <ClassChip
              href={`/leaderboard${kind === "race" ? "?kind=race" : ""}`}
              active={!classFilter}
              label="全部"
            />
            {classes.map((c) => (
              <ClassChip
                key={c}
                href={`/leaderboard?${kind === "race" ? "kind=race&" : ""}class=${encodeURIComponent(c)}`}
                active={classFilter === c}
                label={c}
              />
            ))}
          </div>
        )}

        <div className="mt-6 rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
          {board.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              還沒有人玩過{kind === "race" ? "速度賽" : "對戰"} — 去{" "}
              <Link
                href={kind === "race" ? "/race" : "/battle"}
                className="underline text-rose-600"
              >
                {kind === "race" ? "影子陣速度賽" : "雙人對戰"}
              </Link>{" "}
              開第一場吧！
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left w-16">名次</th>
                  <th className="px-4 py-3 text-left">學生</th>
                  <th className="px-4 py-3 text-right">{kindMeta.scoreLabel}</th>
                  <th className="px-4 py-3 text-right text-slate-400">敗</th>
                  <th className="px-4 py-3 text-right text-slate-400">總</th>
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
                      {s[kindMeta.scoreKey]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {s[kindMeta.lossesKey]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {s[kindMeta.totalKey]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          排行榜每次重新整理會抓最新資料。
        </p>
      </div>
    </main>
  );
}

function KindTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

function ClassChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
      }`}
    >
      {label}
    </Link>
  );
}
