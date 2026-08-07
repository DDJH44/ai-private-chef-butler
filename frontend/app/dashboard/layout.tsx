import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "数据概览 - AI 私人厨师",
  description: "一目了然你的私厨数据：菜谱收藏、烹饪次数、今日营养、食材库存与膳食计划。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
