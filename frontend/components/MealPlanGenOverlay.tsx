"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getMealPlanGenState,
  subscribeToMealPlanGen,
  clearMealPlanGenTask,
} from "@/lib/mealPlanGenStore";
import { useStore } from "@/hooks/useStore";

export function MealPlanGenOverlay() {
  const router = useRouter();
  const mealPlanState = useStore(subscribeToMealPlanGen, getMealPlanGenState);
  const tasks = mealPlanState.tasks;

  // 完成的卡片 3 秒后自动消失
  useEffect(() => {
    const doneOrError = tasks.filter(
      (t) => t.status === "done" || t.status === "error"
    );
    if (doneOrError.length === 0) return;
    const timers = doneOrError.map((task) =>
      setTimeout(() => clearMealPlanGenTask(task.id), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [tasks]);

  const activeTasks = tasks.filter((t) => t.status === "generating");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const errorTasks = tasks.filter((t) => t.status === "error");

  if (activeTasks.length === 0 && doneTasks.length === 0 && errorTasks.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 155,
        right: 20,
        zIndex: 101,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 300,
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
              border: "2px solid var(--golden)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              AI 生成膳食计划
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {task.weekLabel}
            </div>
          </div>
        </div>
      ))}

      {/* 已完成的任务 */}
      {doneTasks.slice(-1).map((task) => (
        <div
          key={task.id}
          onClick={() => router.push("/meal-plan")}
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
          <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              膳食计划已生成
            </div>
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
              点击查看 →
            </div>
          </div>
        </div>
      ))}

      {/* 失败的任务 */}
      {errorTasks.slice(-1).map((task) => (
        <div
          key={task.id}
          onClick={() => router.push("/meal-plan")}
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
          <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              生成失败
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {task.error || "请重试"}
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
