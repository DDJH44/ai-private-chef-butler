import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的冰箱 - AI 私人厨师",
  description: "管理冰箱食材，跟踪保质期，拍照识别食材，让 AI 根据现有食材推荐菜品。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
