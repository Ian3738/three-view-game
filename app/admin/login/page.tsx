import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border-2 border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold">老師後台</h1>
        <p className="mt-2 text-sm text-slate-600">輸入密碼進入。</p>
        <div className="mt-4">
          <LoginForm />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          密碼設在 Vercel 的 ADMIN_PASSWORD 環境變數。沒設好的話登入會一直失敗。
        </p>
      </div>
    </main>
  );
}
