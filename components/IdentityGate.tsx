"use client";

import { useEffect, useState } from "react";
import { loadStudent, saveStudent, Student, studentToId } from "@/lib/studentId";

type Props = {
  children: (id: string, student: Student) => React.ReactNode;
};

// 子元件接收 student id 作為 render prop，確保身分一定存在後才 mount。
export default function IdentityGate({ children }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStudent(loadStudent());
    setLoaded(true);
  }, []);

  if (!loaded) {
    return <div className="py-12 text-center text-slate-400">載入中…</div>;
  }

  if (!student) {
    return (
      <IdentityForm
        onSubmit={(s) => {
          saveStudent(s);
          setStudent(s);
        }}
      />
    );
  }

  return (
    <>
      <IdentityBadge
        student={student}
        onChange={() => setStudent(null)}
      />
      {children(studentToId(student), student)}
    </>
  );
}

function IdentityForm({ onSubmit }: { onSubmit: (s: Student) => void }) {
  const [classCode, setClassCode] = useState("");
  const [seatNo, setSeatNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const c = classCode.trim();
    const n = parseInt(seatNo, 10);
    if (!c) return setError("請輸入班級");
    if (!Number.isFinite(n) || n < 1 || n > 99)
      return setError("座號要在 1~99 之間");
    onSubmit({ classCode: c, seatNo: n });
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border-2 border-slate-200 bg-white p-6 mt-6">
      <h2 className="text-lg font-semibold text-slate-900">先告訴我你是誰</h2>
      <p className="mt-1 text-sm text-slate-600">
        這個資訊會用來統計你的成績、加入排行榜。
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">班級</span>
          <input
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            placeholder="例如 701 或 七年一班"
            maxLength={20}
            className="mt-1 w-full rounded-lg border-2 border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">座號</span>
          <input
            type="number"
            min={1}
            max={99}
            value={seatNo}
            onChange={(e) => setSeatNo(e.target.value)}
            placeholder="1 ~ 99"
            className="mt-1 w-full rounded-lg border-2 border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
          />
        </label>
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold hover:bg-blue-700"
        >
          確認，開始玩
        </button>
      </form>
    </div>
  );
}

function IdentityBadge({
  student,
  onChange,
}: {
  student: Student;
  onChange: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm">
      <div>
        <span className="text-slate-500">目前身分：</span>
        <span className="font-semibold">
          {student.classCode} · {String(student.seatNo).padStart(2, "0")} 號
        </span>
      </div>
      <button
        onClick={onChange}
        className="text-xs text-slate-500 hover:text-rose-600 underline"
      >
        換人
      </button>
    </div>
  );
}
