"use client";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}

/** 骨架屏占位块 — 配合 .skeleton-shimmer 动画使用 */
export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}
