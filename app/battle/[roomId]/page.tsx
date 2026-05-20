import Link from "next/link";
import BattleRoom from "./BattleRoom";

export default async function BattleRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main className="flex-1 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/battle" className="text-sm text-slate-500 hover:text-slate-700">
          ← 回大廳
        </Link>
        <BattleRoom roomId={roomId.toUpperCase()} />
      </div>
    </main>
  );
}
