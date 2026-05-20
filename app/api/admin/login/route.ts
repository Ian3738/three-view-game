import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkPassword } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkPassword(password)) {
    return Response.json({ error: "密碼錯誤" }, { status: 401 });
  }
  const expected = process.env.ADMIN_PASSWORD!;
  const c = await cookies();
  c.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return Response.json({ ok: true });
}
