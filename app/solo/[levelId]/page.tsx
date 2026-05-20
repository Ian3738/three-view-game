import Link from "next/link";
import { notFound } from "next/navigation";
import { getLevel, levelTargetViews } from "@/lib/levels";
import SoloGame from "./SoloGame";

export default async function SoloLevelPage({
  params,
}: {
  params: Promise<{ levelId: string }>;
}) {
  const { levelId } = await params;
  const level = getLevel(levelId);
  if (!level) notFound();

  const { views } = levelTargetViews(level);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/solo" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回關卡列表
        </Link>
        <SoloGame
          levelName={level.name}
          hint={level.hint}
          minCubes={level.minCubes}
          targetViews={views}
        />
      </div>
    </main>
  );
}
