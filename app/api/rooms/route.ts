import { createRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playerId = typeof body.playerId === "string" ? body.playerId : null;
  if (!playerId)
    return Response.json({ error: "playerId required" }, { status: 400 });
  const room = await createRoom(playerId);
  return Response.json({ roomId: room.id, slot: "A" });
}
