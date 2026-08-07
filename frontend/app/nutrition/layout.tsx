import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "营养记录 - AI 私人厨师",
  description: "记录每日饮食，拍照识别菜品营养，追踪卡路里和蛋白质、碳水、脂肪摄入。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
