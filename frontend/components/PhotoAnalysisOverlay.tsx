"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getNutritionState,
  subscribeToNutrition,
  clearTask,
  type PhotoAnalysisTask,
} from "@/lib/nutritionStore";

export function PhotoAnalysisOverlay() {
  const router = useRouter();
  const [tasks, setTasks] = useState<PhotoAnalysisTask[]>([]);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    return subscribeToNutrition(() => {
      const s = getNutritionState();
      setTasks([...s.tasks]);
      setShowResult(s.showResult);
    });
  }, []);

  // 完成的卡片 3 秒后自动消失
  useEffect(() => {
    const doneOrError = tasks.filter(
      (t) => t.status === "done" || t.status === "error"
    );
    if (doneOrError.length === 0) return;
    const timers = doneOrError.map((task) =>
      setTimeout(() => clearTask(task.id), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [tasks]);

  const activeTasks = tasks.filter((t) => t.status === "analyzing");
  const doneTasks = tasks.filter((t) => t.status === "done" && t.result);
  const errorTasks = tasks.filter((t) => t.status === "error");

  // 没有任何需要展示的任务
  if (activeTasks.length === 0 && doneTasks.length === 0 && errorTasks.length === 0) {
    return null;
  }

  // 如果在 nutrition 页面且 showResult 为 true，不显示浮窗（页面内已有展示）
  const isOnNutritionPage =
    typeof window !== "undefined" && window.location.pathname === "/nutrition";
  if (isOnNutritionPage && showResult) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        right: 20,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 320,
      }}
    >
      {/* 进行中的任务 */}
      {activeTasks.map((task) => (
        <div
          key={task.id}
          style={{
            padding: "12px 16px",
            background: "var(--surface)",
            borderRadius: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "slideInRight 0.3s ease",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              {task.mealType}识别中...
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              AI 正在分析食物营养
            </div>
          </div>
        </div>
      ))}

      {/* 已完成/失败的任务（不在 nutrition 页面时显示） */}
      {!isOnNutritionPage &&
        [...doneTasks, ...errorTasks].slice(-2).map((task) => (
          <div
            key={task.id}
            onClick={() => router.push("/nutrition")}
            style={{
              padding: "12px 16px",
              background: "var(--surface)",
              borderRadius: 14,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              transition: "var(--transition)",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {task.status === "done" ? "✅" : "❌"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {task.mealType}
                {task.status === "done" ? "识别完成" : "识别失败"}
              </div>
              <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                点击查看详情 →
              </div>
            </div>
          </div>
        ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
