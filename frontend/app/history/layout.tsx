import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "历史记录 - AI 私人厨师",
  description: "查看你的对话历史、菜谱浏览记录和烹饪评分记录。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
