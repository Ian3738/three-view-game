import Link from "next/link";
import RaceRoom from "./RaceRoom";

export default async function RaceRoomPage({
  params,
}: {
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = await params;
  return (
    <main className="flex-1 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/race" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回大廳
        </Link>
        <RaceRoom raceId={raceId.toUpperCase()} />
      </div>
    </main>
  );
}
