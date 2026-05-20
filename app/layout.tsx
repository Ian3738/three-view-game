import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "三視圖大挑戰",
  description: "國中三視圖單元的互動遊戲：拼立方體、看三視圖、雙人對戰。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
