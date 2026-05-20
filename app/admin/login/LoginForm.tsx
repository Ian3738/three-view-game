"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "登入失敗");
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="密碼"
        autoFocus
        className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
      />
      {error && (
        <div className="rounded bg-rose-50 border border-rose-200 p-2 text-sm text-rose-800">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || pw.length === 0}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-white font-semibold disabled:bg-slate-300 hover:bg-slate-700"
      >
        {busy ? "驗證中…" : "登入"}
      </button>
    </form>
  );
}
