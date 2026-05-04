import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { SideNav, BottomNav } from "@/components/ResponsiveNav";
import { ToastContainer } from "@/components/Toast";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["600", "700"],
});

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
      <body className={`${notoSansSC.variable} ${notoSerifSC.variable} antialiased`}>
        <div className="h-[100dvh] flex overflow-hidden" style={{ background: "var(--bg)" }}>
          <SideNav />
          <main className="flex-1 flex flex-col min-w-0 h-full">
            <div className="flex-1 min-h-0 overflow-hidden">
              {children}
            </div>
            <BottomNav />
          </main>
          <ToastContainer />
        </div>
      </body>
    </html>
  );
}
