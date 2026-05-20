import Link from "next/link";
import ShadowSoloGame from "./ShadowSoloGame";

export default function ShadowSoloPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-2xl font-bold">影子陣 · 單人練習</h1>
        <p className="text-slate-600 text-sm mt-1">
          系統隨機出題，看三視圖把立體拼回來。可以選難度，沒有時間壓力，純練習。
        </p>
        <ShadowSoloGame />
      </div>
    </main>
  );
}
