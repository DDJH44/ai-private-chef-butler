import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登录 - AI 私人厨师",
  description: "登录你的 AI 私人厨师账号，开启智能菜谱推荐与膳食管理。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
