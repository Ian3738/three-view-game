import {
  forfeitRound,
  getRace,
  joinRace,
  publicRaceView,
  raceSlotOf,
  submitRaceAnswer,
} from "@/lib/raceRooms";

type Ctx = { params: Promise<{ raceId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { raceId } = await ctx.params;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");
  const room = await getRace(raceId);
  if (!room) return Response.json({ error: "房間不存在" }, { status: 404 });
  const viewerSlot = playerId ? raceSlotOf(room, playerId) : null;
  return Response.json(publicRaceView(room, viewerSlot));
}

export async function POST(req: Request, ctx: Ctx) {
  const { raceId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const playerId: string | undefined = body.playerId;
  const action: string | undefined = body.action;
  if (!playerId)
    return Response.json({ error: "playerId required" }, { status: 400 });
  const room = await getRace(raceId);
  if (!room) return Response.json({ error: "房間不存在" }, { status: 404 });

  if (action === "join") {
    const joined = await joinRace(raceId, playerId);
    if (!joined)
      return Response.json({ error: "無法加入（房間已滿）" }, { status: 400 });
    return Response.json(publicRaceView(joined, raceSlotOf(joined, playerId)));
  }

  if (action === "submit_answer") {
    const voxels = body.voxels;
    if (!Array.isArray(voxels))
      return Response.json({ error: "缺少 voxels" }, { status: 400 });
    const r = await submitRaceAnswer(raceId, playerId, voxels);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json({
      correct: r.correct,
      room: publicRaceView(r.room, raceSlotOf(r.room, playerId)),
    });
  }

  if (action === "forfeit") {
    const r = await forfeitRound(raceId, playerId);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json(publicRaceView(r.room, raceSlotOf(r.room, playerId)));
  }

  return Response.json({ error: "未知 action" }, { status: 400 });
}
