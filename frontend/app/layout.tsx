import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "AI 私人厨师",
  description: "你的AI私人厨师管家 — 智能菜谱推荐、食材管理、膳食规划",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#e4e8ed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", system-ui, -apple-system, sans-serif' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
