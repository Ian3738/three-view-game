import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/adminAuth";
import { listAllStudents, StudentRecord } from "@/lib/stats";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const students = await listAllStudents();
  // 依班級分組
  const byClass = new Map<string, typeof students>();
  for (const s of students) {
    if (!byClass.has(s.classCode)) byClass.set(s.classCode, []);
    byClass.get(s.classCode)!.push(s);
  }
  for (const arr of byClass.values()) arr.sort((a, b) => a.seatNo - b.seatNo);
  const classes = Array.from(byClass.keys()).sort();

  const totalStudents = students.length;
  const totalBattleRounds = students.reduce((a, s) => a + s.total, 0);
  const totalRaceRounds = students.reduce((a, s) => a + s.raceTotal, 0);
  const totalBattleWins = students.reduce((a, s) => a + s.wins, 0);
  const totalRaceWins = students.reduce((a, s) => a + s.raceWins, 0);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 回首頁
            </Link>
            <h1 className="mt-2 text-3xl font-bold">老師後台</h1>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="登錄學生" value={totalStudents} />
          <Stat label="班級數" value={classes.length} />
          <Stat label="對戰輪數" value={totalBattleRounds} tint="rose" />
          <Stat label="對戰勝場" value={totalBattleWins} tint="rose" />
          <Stat label="速度賽回合" value={totalRaceRounds} tint="amber" />
          <Stat label="速度賽搶分" value={totalRaceWins} tint="amber" />
        </div>

        {classes.length === 0 ? (
          <div className="mt-10 rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            還沒有學生對戰過。等他們玩起來資料就會出現。
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {classes.map((cls) => (
              <ClassTable
                key={cls}
                className={cls}
                students={byClass.get(cls)!}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tint = "slate",
}: {
  label: string;
  value: number;
  tint?: "slate" | "rose" | "amber";
}) {
  const ring =
    tint === "rose"
      ? "border-rose-200"
      : tint === "amber"
        ? "border-amber-200"
        : "border-slate-200";
  return (
    <div className={`rounded-xl border-2 bg-white p-4 ${ring}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}

function ClassTable({
  className: classCode,
  students,
}: {
  className: string;
  students: StudentRecord[];
}) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="font-semibold">{classCode}</div>
        <div className="text-sm text-slate-500">{students.length} 人有紀錄</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-white text-slate-600">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left w-16 align-bottom">
                座號
              </th>
              <th colSpan={4} className="px-3 py-1 text-center bg-rose-50/50 text-rose-700 font-semibold border-x border-rose-100">
                雙人對戰
              </th>
              <th colSpan={4} className="px-3 py-1 text-center bg-amber-50/50 text-amber-700 font-semibold border-x border-amber-100">
                速度賽
              </th>
              <th rowSpan={2} className="px-3 py-2 text-right text-slate-400 align-bottom">
                最後活動
              </th>
            </tr>
            <tr className="text-xs">
              <th className="px-3 py-1 text-right bg-rose-50/30">勝</th>
              <th className="px-3 py-1 text-right bg-rose-50/30">敗</th>
              <th className="px-3 py-1 text-right bg-rose-50/30">總</th>
              <th className="px-3 py-1 text-right bg-rose-50/30">正確率</th>
              <th className="px-3 py-1 text-right bg-amber-50/30">搶分</th>
              <th className="px-3 py-1 text-right bg-amber-50/30">未搶</th>
              <th className="px-3 py-1 text-right bg-amber-50/30">總</th>
              <th className="px-3 py-1 text-right bg-amber-50/30">搶到率</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const acc = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
              const raceAcc =
                s.raceTotal > 0 ? Math.round((s.raceWins / s.raceTotal) * 100) : 0;
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono">
                    {String(s.seatNo).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 bg-rose-50/20">
                    {s.wins}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-rose-500 bg-rose-50/20">
                    {s.losses}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500 bg-rose-50/20">
                    {s.total}
                  </td>
                  <td className="px-3 py-2 text-right font-mono bg-rose-50/20">
                    {s.total > 0 ? `${acc}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 bg-amber-50/20">
                    {s.raceWins}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-rose-500 bg-amber-50/20">
                    {s.raceLosses}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500 bg-amber-50/20">
                    {s.raceTotal}
                  </td>
                  <td className="px-3 py-2 text-right font-mono bg-amber-50/20">
                    {s.raceTotal > 0 ? `${raceAcc}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {s.lastSeen
                      ? new Date(s.lastSeen).toLocaleString("zh-TW", {
                          hour12: false,
                        })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
