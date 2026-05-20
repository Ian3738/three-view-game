import Link from "next/link";
import BattleLobby from "./BattleLobby";

export default function BattleIndex() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold">雙人對戰</h1>
        <p className="mt-2 text-slate-600">
          玩法：A 偷偷建一個立體 → 系統算出三視圖 → B 只看視圖把它還原。
          然後換 B 出題、A 解。各打一輪，比看誰準。
        </p>
        <div className="mt-8">
          <BattleLobby />
        </div>
      </div>
    </main>
  );
}
