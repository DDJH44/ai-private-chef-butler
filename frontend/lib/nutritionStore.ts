import { showToast } from "@/components/Toast";
import { authFetch, getBase } from "./http";

export interface FoodItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  estimated_weight?: string;
}

export interface PhotoAnalysisResult {
  meal_type: string;
  foods: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  summary: string;
}

export interface PhotoAnalysisTask {
  id: string;
  mealType: string;
  date: string;
  status: "analyzing" | "done" | "error";
  result: PhotoAnalysisResult | null;
  error: string | null;
  createdAt: number;
}

interface NutritionStoreState {
  tasks: PhotoAnalysisTask[];
  showResult: boolean;
}

type Listener = () => void;

const state: NutritionStoreState = {
  tasks: [],
  showResult: false,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getNutritionState(): Readonly<NutritionStoreState> {
  return state;
}

export function subscribeToNutrition(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function generateId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 当前是否有正在进行的识别任务 */
export function hasActiveAnalysis(): boolean {
  return state.tasks.some((t) => t.status === "analyzing");
}

/** 获取最新的已完成任务结果 */
export function getLatestResult(): PhotoAnalysisResult | null {
  for (let i = state.tasks.length - 1; i >= 0; i--) {
    if (state.tasks[i].status === "done" && state.tasks[i].result) {
      return state.tasks[i].result;
    }
  }
  return null;
}

/** 开始拍照识别 */
export async function startPhotoAnalysis(
  mealType: string,
  date: string,
  file: File
): Promise<void> {
  const id = generateId();

  const task: PhotoAnalysisTask = {
    id,
    mealType,
    date,
    status: "analyzing",
    result: null,
    error: null,
    createdAt: Date.now(),
  };

  state.tasks = [...state.tasks, task];
  state.showResult = true;
  notify();

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("meal_type", mealType);
    formData.append("date", date);

    const resp = await authFetch(`${getBase()}/api/v1/nutrition/analyze-photo`, {
      method: "POST",
      body: formData,
    });

    if (resp.ok) {
      const result: PhotoAnalysisResult = await resp.json();
      state.tasks = state.tasks.map((t) =>
        t.id === id ? { ...t, status: "done", result } : t
      );
      showToast(`${mealType}分析完成`, "success");
      // 通知所有监听者刷新数据（后端已保存记录到数据库）
      window.dispatchEvent(new CustomEvent("nutrition:analysis-done"));
    } else {
      const err = await resp.json().catch(() => ({ detail: "分析失败" }));
      state.tasks = state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "error", error: err.detail || "分析失败" }
          : t
      );
      showToast(err.detail || "分析失败", "error");
    }
  } catch (e) {
    state.tasks = state.tasks.map((t) =>
      t.id === id ? { ...t, status: "error", error: "网络错误，分析失败" } : t
    );
    showToast("网络错误，分析失败", "error");
  }

  notify();
}

/** 关闭结果面板 */
export function dismissAnalysisResult() {
  state.showResult = false;
  // 清除已完成的任务
  state.tasks = state.tasks.filter((t) => t.status === "analyzing");
  notify();
}

/** 清除指定任务 */
export function clearTask(id: string) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  notify();
}

/** 清除所有已完成/失败的任务 */
export function clearCompletedTasks() {
  state.tasks = state.tasks.filter((t) => t.status === "analyzing");
  notify();
}
