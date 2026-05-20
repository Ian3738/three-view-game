import { createRace } from "@/lib/raceRooms";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playerId = typeof body.playerId === "string" ? body.playerId : null;
  if (!playerId)
    return Response.json({ error: "playerId required" }, { status: 400 });
  const room = await createRace(playerId);
  return Response.json({ raceId: room.id, slot: "A" });
}
