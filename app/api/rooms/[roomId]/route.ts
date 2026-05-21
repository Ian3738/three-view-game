import {
  getRoom,
  joinRoom,
  publicView,
  restartBattle,
  slotOf,
  submitAnswer,
  submitSecret,
} from "@/lib/rooms";

type Ctx = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { roomId } = await ctx.params;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");
  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "房間不存在" }, { status: 404 });
  const viewerSlot = playerId ? slotOf(room, playerId) : null;
  return Response.json(publicView(room, viewerSlot));
}

export async function POST(req: Request, ctx: Ctx) {
  const { roomId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const playerId: string | undefined = body.playerId;
  const action: string | undefined = body.action;
  if (!playerId)
    return Response.json({ error: "playerId required" }, { status: 400 });
  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "房間不存在" }, { status: 404 });

  if (action === "join") {
    const joined = await joinRoom(roomId, playerId);
    if (!joined)
      return Response.json({ error: "無法加入（房間已滿）" }, { status: 400 });
    return Response.json(publicView(joined, slotOf(joined, playerId)));
  }

  if (action === "submit_secret") {
    const voxels = body.voxels;
    if (!Array.isArray(voxels))
      return Response.json({ error: "缺少 voxels" }, { status: 400 });
    const r = await submitSecret(roomId, playerId, voxels);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json(publicView(r.room, slotOf(r.room, playerId)));
  }

  if (action === "submit_answer") {
    const voxels = body.voxels;
    if (!Array.isArray(voxels))
      return Response.json({ error: "缺少 voxels" }, { status: 400 });
    const r = await submitAnswer(roomId, playerId, voxels);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json(publicView(r.room, slotOf(r.room, playerId)));
  }

  if (action === "restart") {
    const r = await restartBattle(roomId, playerId);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    return Response.json(publicView(r.room, slotOf(r.room, playerId)));
  }

  return Response.json({ error: "未知 action" }, { status: 400 });
}
