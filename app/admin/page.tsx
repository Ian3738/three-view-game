import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/adminAuth";
import { listAllStudents } from "@/lib/stats";
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
  // 每班內依座號排序
  for (const arr of byClass.values()) arr.sort((a, b) => a.seatNo - b.seatNo);
  const classes = Array.from(byClass.keys()).sort();

  const totalStudents = students.length;
  const totalRounds = students.reduce((acc, s) => acc + s.total, 0);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-5xl mx-auto">
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

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="登錄學生" value={totalStudents} />
          <Stat label="總對戰輪數" value={totalRounds} />
          <Stat label="班級數" value={classes.length} />
          <Stat
            label="總勝場"
            value={students.reduce((a, s) => a + s.wins, 0)}
          />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
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
  students: Array<{
    id: string;
    seatNo: number;
    wins: number;
    losses: number;
    total: number;
    lastSeen: number;
  }>;
}) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="font-semibold">{classCode}</div>
        <div className="text-sm text-slate-500">{students.length} 人有紀錄</div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-white text-slate-600">
          <tr>
            <th className="px-4 py-2 text-left w-20">座號</th>
            <th className="px-4 py-2 text-right">勝</th>
            <th className="px-4 py-2 text-right">敗</th>
            <th className="px-4 py-2 text-right">總</th>
            <th className="px-4 py-2 text-right">正確率</th>
            <th className="px-4 py-2 text-right text-slate-400">最後活動</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const acc = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
            return (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono">
                  {String(s.seatNo).padStart(2, "0")}
                </td>
                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">
                  {s.wins}
                </td>
                <td className="px-4 py-2 text-right font-mono text-rose-500">
                  {s.losses}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-500">
                  {s.total}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {s.total > 0 ? `${acc}%` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-slate-400">
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
  );
}
