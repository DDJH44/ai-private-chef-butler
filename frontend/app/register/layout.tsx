import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "注册 - AI 私人厨师",
  description: "注册 AI 私人厨师账号，享受智能菜谱推荐、食材管理与膳食规划服务。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
