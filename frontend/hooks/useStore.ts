"use client";

import { useSyncExternalStore, useRef } from "react";

/**
 * 通用的外部 store 订阅 hook，基于 React useSyncExternalStore
 * 替代 forceUpdate 反模式，确保只在状态真正变化时重渲染
 *
 * @param subscribe - store 的 subscribe 函数
 * @param getSnapshot - store 的 getSnapshot 函数
 * @returns 当前 store 状态（只读）
 */
export function useStore<T>(
  subscribe: (fn: () => void) => () => void,
  getSnapshot: () => T
): T {
  // 缓存上一次的快照，避免引用相同时触发不必要的重渲染
  const prevRef = useRef<T | undefined>(undefined);
  const snapshot = useSyncExternalStore(subscribe, () => {
    const next = getSnapshot();
    // 浅比较：如果引用相同，返回旧引用，让 React 跳过重渲染
    if (prevRef.current === next) return prevRef.current as T;
    prevRef.current = next;
    return next;
  });
  return snapshot;
}
