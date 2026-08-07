import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "膳食计划 - AI 私人厨师",
  description: "按周规划一日三餐，AI 根据你的口味和食材生成个性化膳食计划。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
