import Link from "next/link";
import PracticeGame from "@/components/PracticeGame";

export default function ShadowSoloPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回首頁
        </Link>
        <h1 className="mt-4 text-2xl font-bold">影子陣 · 單人練習</h1>
        <p className="text-slate-600 text-sm mt-1">
          系統隨機出題，三視圖以「投影到三面牆」的影子陣桌遊風格呈現。
          選簡單／中等／困難，無限練。
        </p>
        <PracticeGame viewStyle="shadow" />
      </div>
    </main>
  );
}
