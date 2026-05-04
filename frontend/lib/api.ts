/**
 * API 调用封装
 */
import { Recipe, AddRecipeRequest, RecipeListResponse, RecipeOperationResponse } from '@/types/recipe';
import { loadPreference } from './preferenceStore';
import { loadIngredients } from './ingredientStore';
import { loadCookHistory } from './historyStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const INVENTORY_KEYWORDS = ["冰箱", "食材", "有什么", "库存", "现有", "家里有", "还有什么"];

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

        // 烹饪历史 — 高分菜作为偏好参考
        const cookHistory = loadCookHistory();
        const favoriteDishes = [...new Set(
            cookHistory.filter(c => c.rating >= 4).map(c => c.recipe_name)
        )].slice(0, 5);
        const cookContext = favoriteDishes.length > 0
            ? `\n[用户偏好的菜品口味参考] 用户评分≥4星的菜品：${favoriteDishes.join('、')}。推荐时优先考虑类似风味。`
            : "";

        const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
            method: "POST",
            body: JSON.stringify({
                message: message + cookContext,
                image_url: image_url,
                thread_id: threadId,
                preference: loadPreference(),
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