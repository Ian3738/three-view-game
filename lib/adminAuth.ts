import { cookies } from "next/headers";

export const ADMIN_COOKIE = "tvg-admin";

// 比對輸入密碼是否與 ADMIN_PASSWORD env var 相同。
// 沒設 ADMIN_PASSWORD 時拒絕一切登入，避免 production 忘了設變數導致後台不設防。
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return input === expected;
}

// 從 cookie 判斷目前是否為管理員。Server-side 用。
export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(ADMIN_COOKIE)?.value === expected;
}
