/**
 * 膳食计划生成全局状态 — 页面切换不中断，悬浮卡片展示进度
 */
import { generateMealPlan } from "@/lib/api";
import { getPreference } from "@/lib/api";
import { loadIngredients } from "@/lib/ingredientStore";
import { updateMealInPlan } from "@/lib/mealPlanStore";
import { showToast } from "@/components/Toast";

type GenStatus = "generating" | "done" | "error";

export interface MealPlanGenTask {
  id: string;
  status: GenStatus;
  weekLabel: string;
  planId: string;
  createdAt: number;
  error: string | null;
}

interface MealPlanGenStore {
  tasks: MealPlanGenTask[];
}

type Listener = () => void;

const state: MealPlanGenStore = {
  tasks: [],
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getMealPlanGenState(): Readonly<MealPlanGenStore> {
  return state;
}

export function subscribeToMealPlanGen(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function hasActiveMealPlanGen(): boolean {
  return state.tasks.some((t) => t.status === "generating");
}

function generateId(): string {
  return `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 通知膳食计划页面刷新数据 */
function dispatchPlanChanged() {
  window.dispatchEvent(new CustomEvent("mealplan:generated"));
}

/** 启动膳食计划 AI 生成（全局任务，页面切换不中断） */
export async function startMealPlanGeneration(params: {
  week_start: string;
  week_end: string;
  mode: string;
  requirements?: string;
  planId: string;
  weekLabel: string;
  existingPlan: Record<string, unknown>;
}): Promise<void> {
  const id = generateId();

  const task: MealPlanGenTask = {
    id,
    status: "generating",
    weekLabel: params.weekLabel,
    planId: params.planId,
    createdAt: Date.now(),
    error: null,
  };

  state.tasks = [...state.tasks, task];
  notify();

  try {
    const inventory = loadIngredients().map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      status: i.status,
    }));

    const result = await generateMealPlan({
      week_start: params.week_start,
      week_end: params.week_end,
      mode: params.mode,
      requirements: params.requirements,
      preference: { ...getPreference() } as Record<string, unknown>,
      inventory,
      existing_plan: params.existingPlan,
    });

    const data = result as {
      plan?: {
        days?: Array<{
          date: string;
          meals: Record<
            string,
            {
              recipe_name: string;
              ingredients?: string[];
              calories: number;
              protein: number;
              carbs: number;
              fat: number;
            } | null
          >;
        }>;
      };
      error?: string;
    };

    if (data.error || !data.plan?.days) {
      state.tasks = state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "error", error: data.error || "生成失败" }
          : t
      );
      notify();
      dispatchPlanChanged();
      return;
    }

    // 批量更新计划数据
    for (const day of data.plan.days) {
      for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
        const mealData = day.meals?.[mealType];
        if (mealData === null || mealData === undefined) continue;
        if (mealData?.recipe_name) {
          updateMealInPlan(params.planId, day.date, mealType, {
            recipe_id: null,
            recipe_name: mealData.recipe_name,
            ingredients: mealData.ingredients || [],
            calories: mealData.calories || 0,
            protein: mealData.protein || 0,
            carbs: mealData.carbs || 0,
            fat: mealData.fat || 0,
            status: "planned",
          });
        }
      }
    }

    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, status: "done", error: null } : t
    );
    notify();
    dispatchPlanChanged();
    showToast("膳食计划已生成", "success");
  } catch (e) {
    const msg =
      e instanceof DOMException && e.name === "AbortError"
        ? "生成超时，请尝试分餐生成或稍后重试"
        : e instanceof Error
          ? e.message
          : "未知错误";
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, status: "error", error: msg } : t
    );
    notify();
    dispatchPlanChanged();
    showToast(msg, "error");
  }
}

export function clearMealPlanGenTask(id: string) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  notify();
}

export function clearCompletedMealPlanGenTasks() {
  state.tasks = state.tasks.filter((t) => t.status === "generating");
  notify();
}
