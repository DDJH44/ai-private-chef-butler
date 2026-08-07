import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "购物清单 - AI 私人厨师",
  description: "管理你的购物清单，根据菜谱自动生成采购项，勾选已购食材。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
