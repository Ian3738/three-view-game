import Link from "next/link";
import RaceLobby from "./RaceLobby";

export default function RaceIndex() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-3xl font-bold">影子陣 · 速度賽</h1>
        <p className="mt-2 text-slate-600">
          玩法：系統出 10 題同樣的三視圖，雙方搶解。每題第一個答對的人拿 1 分；
          兩人都覺得不會可以「放棄」。10 題打完總分高的獲勝。難度會從簡單往難遞增。
        </p>
        <div className="mt-8">
          <RaceLobby />
        </div>
      </div>
    </main>
  );
}
