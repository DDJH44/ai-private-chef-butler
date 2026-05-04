/**
 * 菜谱状态管理工具
 * 基于 localStorage 实现菜谱的永久持久化存储
 * 所有会话共享同一个菜谱库，新建对话不会清除菜谱
 */

import { Recipe, RecipeStore } from '@/types/recipe';

/** localStorage 存储键名 */
const STORAGE_KEY = 'ai_chef_recipes';

/** 菜谱变更事件名称 */
export const RECIPE_CHANGE_EVENT = 'recipeChange';

/**
 * 触发菜谱变更事件，通知其他组件刷新
 */
function notifyRecipeChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECIPE_CHANGE_EVENT));
  }
}

/**
 * 从 localStorage 加载所有菜谱（全局）
 * @returns 菜谱列表
 */
export function loadRecipes(): Recipe[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const store: RecipeStore = JSON.parse(stored);
    return store.recipes || [];
  } catch (error) {
    console.error('加载菜谱失败:', error);
    return [];
  }
}

/**
 * 保存所有菜谱到 localStorage（全局）
 * @param recipes - 菜谱列表
 */
export function saveRecipes(recipes: Recipe[]): void {
  try {
    const store: RecipeStore = {
      recipes,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('保存菜谱失败:', error);
  }
}

/**
 * 添加菜谱（全局存储，不绑定会话）
 * @param recipe - 菜谱数据（不包含 id、createdAt、updatedAt）
 * @returns 新添加的菜谱
 */
export function addRecipe(
  recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Recipe {
  const recipes = loadRecipes();
  
  // 检查是否已存在（通过标题去重）
  const exists = recipes.some(r => r.title === recipe.title);
  if (exists) {
    // 如果已存在，直接返回现有菜谱
    const existing = recipes.find(r => r.title === recipe.title)!;
    return existing;
  }
  
  // 生成唯一 ID
  const newRecipe: Recipe = {
    ...recipe,
    id: `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  recipes.unshift(newRecipe); // 新菜谱放到最前面
  saveRecipes(recipes);
  
  // 通知其他组件刷新
  notifyRecipeChange();
  
  return newRecipe;
}

/**
 * 删除菜谱（全局删除）
 * @param recipeId - 菜谱 ID
 * @returns 是否删除成功
 */
export function deleteRecipe(recipeId: string): boolean {
  const recipes = loadRecipes();
  const filtered = recipes.filter(r => r.id !== recipeId);
  
  // 如果没有找到对应的菜谱，返回 false
  if (filtered.length === recipes.length) {
    return false;
  }
  
  saveRecipes(filtered);
  // 通知其他组件刷新
  notifyRecipeChange();
  return true;
}

/**
 * 更新菜谱（全局更新）
 * @param recipeId - 菜谱 ID
 * @param updates - 要更新的字段
 * @returns 更新后的菜谱，如果未找到则返回 null
 */
export function updateRecipe(
  recipeId: string, 
  updates: Partial<Recipe>
): Recipe | null {
  const recipes = loadRecipes();
  const index = recipes.findIndex(r => r.id === recipeId);
  
  if (index === -1) {
    return null;
  }
  
  // 更新菜谱并更新时间戳
  recipes[index] = {
    ...recipes[index],
    ...updates,
    updatedAt: Date.now()
  };
  
  saveRecipes(recipes);
  // 通知其他组件刷新
  notifyRecipeChange();
  return recipes[index];
}

/**
 * 清空所有菜谱
 */
export function clearAllRecipes(): void {
  saveRecipes([]);
  notifyRecipeChange();
}

/**
 * 获取单个菜谱（全局查找）
 * @param recipeId - 菜谱 ID
 * @returns 菜谱详情，如果未找到则返回 undefined
 */
export function getRecipe(recipeId: string): Recipe | undefined {
  const recipes = loadRecipes();
  return recipes.find(r => r.id === recipeId);
}

/**
 * 获取菜谱总数
 * @returns 菜谱数量
 */
export function getRecipeCount(): number {
  return loadRecipes().length;
}

/**
 * 检查菜谱是否已存在（通过标题判断，全局范围）
 * @param title - 菜谱标题
 * @returns 是否已存在
 */
export function recipeExists(title: string): boolean {
  const recipes = loadRecipes();
  return recipes.some(r => r.title.toLowerCase() === title.toLowerCase());
}

/**
 * 批量添加菜谱（全局存储）
 * @param recipesToAdd - 要添加的菜谱列表
 * @returns 添加后的所有菜谱
 */
export function addRecipesBatch(
  recipesToAdd: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>[]
): Recipe[] {
  const recipes = loadRecipes();
  
  const newRecipes: Recipe[] = recipesToAdd
    .filter(data => !recipes.some(r => r.title === data.title)) // 去重
    .map(data => ({
      ...data,
      id: `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  
  const allRecipes = [...newRecipes, ...recipes]; // 新菜谱在前
  saveRecipes(allRecipes);
  notifyRecipeChange();
  
  return allRecipes;
}

/**
 * 切换菜谱展开/折叠状态
 * @param recipeId - 菜谱 ID
 * @returns 更新后的菜谱
 */
export function toggleRecipeExpanded(recipeId: string): Recipe | null {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    return null;
  }
  
  return updateRecipe(recipeId, { isExpanded: !recipe.isExpanded });
}

/**
 * 获取所有已展开的菜谱
 * @returns 已展开的菜谱列表
 */
export function getExpandedRecipes(): Recipe[] {
  const recipes = loadRecipes();
  return recipes.filter(r => r.isExpanded);
}

/**
 * 搜索菜谱（通过标题或内容，全局搜索）
 * @param query - 搜索关键词
 * @returns 匹配的菜谱列表
 */
export function searchRecipes(query: string): Recipe[] {
  const recipes = loadRecipes();
  const searchQuery = query.toLowerCase();
  
  return recipes.filter(r => 
    r.title.toLowerCase().includes(searchQuery) ||
    r.content.toLowerCase().includes(searchQuery)
  );
}
