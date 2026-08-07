import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的菜谱 - AI 私人厨师",
  description: "管理你保存的菜谱，按标签和关键词快速搜索，发现下一道想做的菜。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
