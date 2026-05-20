"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreatePlayerId } from "@/lib/playerId";

export default function BattleLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy("create");
    setError(null);
    try {
      const playerId = getOrCreatePlayerId();
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!r.ok) throw new Error("建房間失敗");
      const data = await r.json();
      router.push(`/battle/${data.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  function joinRoom() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) {
      setError("房間代碼是 4 個字");
      return;
    }
    setBusy("join");
    setError(null);
    router.push(`/battle/${trimmed}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-lg">開新房間</h2>
        <p className="text-sm text-slate-600 mt-1">
          建立後會拿到一個 4 個字的代碼，傳給朋友讓他輸入加入。
        </p>
        <button
          onClick={createRoom}
          disabled={busy !== null}
          className="mt-4 rounded-lg bg-rose-600 px-5 py-2.5 text-white font-medium disabled:bg-slate-300 hover:bg-rose-700"
        >
          {busy === "create" ? "建立中…" : "建立房間"}
        </button>
      </div>

      <div className="rounded-xl border-2 border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-lg">加入房間</h2>
        <p className="text-sm text-slate-600 mt-1">輸入朋友給你的 4 字代碼。</p>
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
            className="flex-1 rounded-lg border-2 border-slate-300 px-4 py-2.5 font-mono text-lg uppercase tracking-widest focus:border-rose-500 outline-none"
          />
          <button
            onClick={joinRoom}
            disabled={busy !== null}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-white font-medium disabled:bg-slate-300 hover:bg-slate-700"
          >
            加入
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
