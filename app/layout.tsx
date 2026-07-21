import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "归来剧场 · 实时排班系统",
  description: "临时开本、快速换 DM、玩家补位与冲突预警的一体化调度台。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
