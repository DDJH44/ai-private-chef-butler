/**
 * API 调用封装
 */
import { Recipe, AddRecipeRequest, RecipeListResponse, RecipeOperationResponse } from '@/types/recipe';
import { loadPreference, PREFERENCE_CHANGE_EVENT } from './preferenceStore';
import { loadIngredients } from './ingredientStore';
import { loadCookHistory } from './historyStore';
import type { Preference } from '@/types/preference';

import { apiPath } from './env';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Preference cache — read once, refresh only on explicit change
let _prefCache: Preference | null = null;
let _prefDirty = true;
if (typeof window !== 'undefined') {
  window.addEventListener(PREFERENCE_CHANGE_EVENT, () => { _prefDirty = true; });
}
export function getPreference(): Preference {
  if (_prefDirty || !_prefCache) {
    _prefCache = loadPreference();
    _prefDirty = false;
  }
  return _prefCache;
}

const INVENTORY_KEYWORDS = ["冰箱", "食材", "有什么", "库存", "现有", "家里有", "还有什么", "看看冰箱", "还剩什么", "还有哪些", "推荐菜", "吃什么", "能做", "做菜", "推荐"];

/** 通用 JSON API 请求封装 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error((errorData as { detail?: string }).detail || `请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 通过后端代理上传图片到 OSS
 */
export async function uploadImageToOss(file: File): Promise<string> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/api/v1/oss/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`上传失败: ${response.status}`);
        }

        const data = await response.json();
        return data.file_url;
    } catch (error) {
        console.error('图片上传失败:', error);
        throw error;
    }
}

/**
 * 流式聊天
 */
export async function streamChat(
    message: string,
    onChunk: (chunk: string) => void,
    image_url?: string,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    threadId?: string
): Promise<void> {
    try {
        const shouldIncludeInventory = INVENTORY_KEYWORDS.some((kw) => message.includes(kw));
        const inventory = shouldIncludeInventory
            ? loadIngredients().map((i) => ({name: i.name, quantity: i.quantity, unit: i.unit, status: i.status}))
            : undefined;

        // 记忆学习 — 根据烹饪历史个性化推荐
        const cookHistory = loadCookHistory();
        const parts: string[] = [];
        // 喜爱的菜（≥4星）
        const favorites = [...new Set(
          cookHistory.filter(c => c.rating >= 4).map(c => c.recipe_name)
        )].slice(0, 8);
        if (favorites.length > 0) {
          parts.push(`用户喜爱的菜品：${favorites.join('、')}。优先推荐类似风味、烹饪方式的菜品。`);
        }
        // 不喜欢的菜（≤2星），避免推荐
        const dislikes = [...new Set(
          cookHistory.filter(c => c.rating <= 2).map(c => c.recipe_name)
        )].slice(0, 5);
        if (dislikes.length > 0) {
          parts.push(`用户不喜欢的菜品：${dislikes.join('、')}。请避免推荐这类菜或类似风格。`);
        }
        // 最近常做的菜（近5条），避免重复推荐
        const recent = cookHistory.slice(0, 5).map(c => c.recipe_name);
        if (recent.length > 0) {
          parts.push(`用户最近做过的菜：${recent.join('、')}。如果用户没有明确要求，尽量不重复推荐。`);
        }
        // 口味分析 — 高频菜推断偏好
        if (cookHistory.length >= 3) {
          const avgRating = (cookHistory.reduce((s, c) => s + c.rating, 0) / cookHistory.length).toFixed(1);
          parts.push(`用户共记录 ${cookHistory.length} 次烹饪，平均评分 ${avgRating}/5。根据评分历史调整推荐策略。`);
        }
        const cookContext = parts.length > 0
          ? `\n【用户烹饪记忆 — 请据此个性化推荐】\n${parts.map(p => `- ${p}`).join('\n')}\n`
          : "";

        const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
            method: "POST",
            body: JSON.stringify({
                message: message + cookContext,
                image_url: image_url,
                thread_id: threadId,
                preference: getPreference(),
                inventory,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder("utf-8");
        let fullContent = "";

        while (true) {
            const {done, value} = await reader.read();
            if (done) {
                onComplete?.();
                break;
            }

            const chunk = decoder.decode(value, {stream: true});
            fullContent += chunk;
            onChunk(fullContent);
        }
    } catch (error) {
        onError?.(error as Error);
    }
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(threadId: string): Promise<{ role: string; content: string }[]> {
    const data = await request<{ messages: { role: string; content: string }[] }>(
        `/api/v1/chat/messages?thread_id=${threadId}`
    );
    return data.messages;
}

/**
 * 清空聊天历史
 */
export async function clearChatHistory(threadId: string): Promise<void> {
    await request(`/api/v1/chat/messages?thread_id=${threadId}`, { method: "DELETE" });
}

/**
 * ========================================
 * 菜谱管理相关 API
 * ========================================
 */

/**
 * 添加菜谱到菜谱栏（全局存储）
 * @param request - 添加菜谱请求数据
 * @returns 操作结果
 */
export async function addRecipeToPanel(req: AddRecipeRequest): Promise<RecipeOperationResponse> {
    try {
        const recipe = await request<Recipe>("/api/v1/recipes", {
            method: "POST",
            body: JSON.stringify(req),
        });
        return { success: true, recipe };
    } catch (error) {
        console.error("添加菜谱失败:", error);
        return { success: false, error: error instanceof Error ? error.message : "未知错误" };
    }
}

export async function getRecipes(): Promise<Recipe[]> {
    try {
        const data = await request<RecipeListResponse>("/api/v1/recipes");
        return data.recipes;
    } catch (error) {
        console.error("获取菜谱失败:", error);
        return [];
    }
}

export async function deleteRecipeFromPanel(recipeId: string): Promise<RecipeOperationResponse> {
    try {
        await request(`/api/v1/recipes/${encodeURIComponent(recipeId)}`, { method: "DELETE" });
        return { success: true };
    } catch (error) {
        console.error("删除菜谱失败:", error);
        return { success: false, error: error instanceof Error ? error.message : "未知错误" };
    }
}

export async function batchDeleteRecipes(ids: string[]): Promise<RecipeOperationResponse> {
    try {
        await request("/api/v1/recipes/batch-delete", {
            method: "POST",
            body: JSON.stringify(ids),
        });
        return { success: true };
    } catch (error) {
        console.error("批量删除菜谱失败:", error);
        return { success: false, error: error instanceof Error ? error.message : "未知错误" };
    }
}

export async function updateRecipe(
    recipeId: string,
    updates: Partial<Recipe>
): Promise<RecipeOperationResponse> {
    try {
        const recipe = await request<Recipe>(`/api/v1/recipes/${encodeURIComponent(recipeId)}`, {
            method: "PUT",
            body: JSON.stringify(updates),
        });
        return { success: true, recipe };
    } catch (error) {
        console.error("更新菜谱失败:", error);
        return { success: false, error: error instanceof Error ? error.message : "未知错误" };
    }
}

export async function generateMealPlan(params: {
    week_start: string;
    week_end: string;
    mode: string;
    requirements?: string;
    preference?: Record<string, unknown>;
    inventory?: Array<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
    const data = await request<Record<string, unknown>>("/api/v1/meal-plan/generate", {
        method: "POST",
        body: JSON.stringify(params),
    });
    return data;
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
    try {
        const data = await request<RecipeListResponse>(
            `/api/v1/recipes/search?${new URLSearchParams({ q: query })}`
        );
        return data.recipes;
    } catch (error) {
        console.error("搜索菜谱失败:", error);
        return [];
    }
}