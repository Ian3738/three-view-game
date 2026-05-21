import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          三視圖大挑戰
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          看前視圖、上視圖、右視圖，把立方體拼回來。
          <br />
          訓練空間想像力，挑戰自己也挑戰朋友。
        </p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ModeCard
            href="/solo"
            emoji="🧱"
            title="單人闖關"
            desc="隨機出題、三檔難度，三視圖以教科書平面格式呈現。"
            color="blue"
            cta="開始"
          />
          <ModeCard
            href="/shadow-solo"
            emoji="🎲"
            title="影子陣・單人練習"
            desc="隨機出題、三檔難度，三視圖用影子陣桌遊風格的角落投影呈現。"
            color="emerald"
            cta="開始練習"
          />
          <ModeCard
            href="/battle"
            emoji="⚔️"
            title="雙人對戰（出題互打）"
            desc="兩人同時各蓋秘密形狀，同時解對方的題。比速度也比準。"
            color="rose"
            cta="建房間"
          />
          <ModeCard
            href="/race"
            emoji="⚡"
            title="影子陣・速度賽"
            desc="兩人看同一題，搶答 10 題、難度漸增、勝場最多者勝。"
            color="amber"
            cta="建房間"
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm text-slate-700 hover:border-amber-500 hover:text-amber-700"
          >
            🏆 排行榜
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          建議使用桌面瀏覽器或平板，支援觸控拖曳旋轉立體圖。
        </p>
      </div>
    </main>
  );
}

function ModeCard({
  href,
  emoji,
  title,
  desc,
  color,
  cta,
}: {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  color: "blue" | "emerald" | "rose" | "amber";
  cta: string;
}) {
  const hoverBorder = {
    blue: "hover:border-blue-500",
    emerald: "hover:border-emerald-500",
    rose: "hover:border-rose-500",
    amber: "hover:border-amber-500",
  }[color];
  const ctaColor = {
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
  }[color];
  return (
    <Link
      href={href}
      className={`group rounded-2xl border-2 border-slate-200 bg-white p-6 sm:p-8 text-left ${hoverBorder} hover:shadow-lg transition`}
    >
      <div className="text-4xl mb-3">{emoji}</div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
      <div className={`mt-4 inline-flex items-center font-medium ${ctaColor} group-hover:translate-x-1 transition`}>
        {cta} →
      </div>
    </Link>
  );
}
