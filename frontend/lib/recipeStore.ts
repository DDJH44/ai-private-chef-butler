/**
 * 菜谱状态管理 — 后端 API 为唯一数据源
 */

import { Recipe } from '@/types/recipe';
import {
  getRecipes as apiGetRecipes,
  addRecipeToPanel,
  deleteRecipeFromPanel,
  batchCreateRecipes,
  batchDeleteRecipes,
  updateRecipe as apiUpdateRecipe,
  searchRecipes as apiSearchRecipes,
} from '@/lib/api';
import type { AddRecipeRequest } from '@/types/recipe';

export const RECIPE_CHANGE_EVENT = 'recipeChange';
const MIGRATION_KEY = 'ai_chef_recipes_migrated_v2';

// Memory cache — avoid redundant API calls from multiple components
let _cache: Recipe[] | null = null;
let _cacheDirty = true;

function notify() {
  _cacheDirty = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECIPE_CHANGE_EVENT));
  }
}

/** 后端 snake_case → 前端 camelCase */
function mapRecipe(api: Record<string, unknown>): Recipe {
  return {
    id: String(api.id ?? ''),
    title: String(api.title ?? ''),
    content: String(api.content ?? ''),
    imageUrl: (api.image_url as string) || undefined,
    difficulty: (api.difficulty as Recipe['difficulty']) || undefined,
    cookingTime: (api.cooking_time as string) || undefined,
    ingredients: (api.ingredients as string[]) || [],
    seasonings: (api.seasonings as string[]) || [],
    steps: (api.steps as string[]) || undefined,
    score: (api.score as number) || undefined,
    reason: (api.reason as string) || undefined,
    sourceUrl: (api.source_url as string) || undefined,
    videoUrl: (api.video_url as string) || undefined,
    tags: (api.tags as string[]) || [],
    isExpanded: Boolean(api.is_expanded),
    createdAt: typeof api.created_at === 'number' ? api.created_at : Date.now(),
    updatedAt: typeof api.updated_at === 'number' ? api.updated_at : Date.now(),
  };
}

/** 前端 camelCase → 后端 snake_case（创建用） */
function toApiFields(recipe: Partial<Recipe>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (recipe.title !== undefined) out.title = recipe.title;
  if (recipe.content !== undefined) out.content = recipe.content;
  if (recipe.imageUrl !== undefined) out.image_url = recipe.imageUrl;
  if (recipe.difficulty !== undefined) out.difficulty = recipe.difficulty;
  if (recipe.cookingTime !== undefined) out.cooking_time = recipe.cookingTime;
  if (recipe.ingredients !== undefined) out.ingredients = recipe.ingredients;
  if (recipe.seasonings !== undefined) out.seasonings = recipe.seasonings;
  if (recipe.score !== undefined) out.score = recipe.score;
  if (recipe.reason !== undefined) out.reason = recipe.reason;
  if (recipe.sourceUrl !== undefined) out.source_url = recipe.sourceUrl;
  if (recipe.videoUrl !== undefined) out.video_url = recipe.videoUrl;
  return out;
}

async function migrateFromLocalStorage() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_KEY)) return;
  const stored = localStorage.getItem('ai_chef_recipes');
  if (!stored) { localStorage.setItem(MIGRATION_KEY, '1'); return; }
  try {
    const data = JSON.parse(stored);
    const recipes: Recipe[] = data.recipes || [];
    if (recipes.length === 0) { localStorage.setItem(MIGRATION_KEY, '1'); return; }
    let count = 0;
    for (const r of recipes) {
      const res = await addRecipeToPanel({
        title: r.title,
        content: r.content,
        image_url: r.imageUrl,
        difficulty: r.difficulty,
        cooking_time: r.cookingTime,
      });
      if (res.success) count++;
    }
    if (count > 0) console.log(`Migrated ${count} recipes from localStorage to backend`);
    localStorage.setItem(MIGRATION_KEY, '1');
    localStorage.removeItem('ai_chef_recipes');
  } catch (e) {
    console.warn('Recipe migration failed, will retry next load', e);
  }
}

let migrationStarted = false;
function ensureMigration() {
  if (!migrationStarted && typeof window !== 'undefined') {
    migrationStarted = true;
    migrateFromLocalStorage();
  }
}

export async function loadRecipes(): Promise<Recipe[]> {
  ensureMigration();
  if (!_cacheDirty && _cache) return _cache;
  const recipes = await apiGetRecipes();
  _cache = recipes.map((r: unknown) => mapRecipe(r as Record<string, unknown>));
  _cacheDirty = false;
  return _cache;
}

export async function getRecipeCount(): Promise<number> {
  const recipes = await loadRecipes();
  return recipes.length;
}

export async function getRecipe(recipeId: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes();
  return recipes.find((r) => r.id === recipeId);
}

export async function addRecipe(
  recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Recipe | null> {
  const res = await addRecipeToPanel({
    title: recipe.title,
    content: recipe.content,
    image_url: recipe.imageUrl,
    difficulty: recipe.difficulty,
    cooking_time: recipe.cookingTime,
    video_url: recipe.videoUrl,
    ingredients: recipe.ingredients,
    seasonings: recipe.seasonings,
    tags: recipe.tags,
    score: recipe.score,
    reason: recipe.reason,
    source_url: recipe.sourceUrl,
  });
  if (res.success && res.recipe) {
    notify();
    return mapRecipe(res.recipe as unknown as Record<string, unknown>);
  }
  return null;
}

export async function addRecipesBatch(
  recipesToAdd: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<Recipe[]> {
  const reqs: AddRecipeRequest[] = recipesToAdd.map(r => ({
    title: r.title,
    content: r.content,
    image_url: r.imageUrl,
    difficulty: r.difficulty,
    cooking_time: r.cookingTime,
    video_url: r.videoUrl,
    ingredients: r.ingredients,
    seasonings: r.seasonings,
    tags: r.tags,
    score: r.score,
    reason: r.reason,
    source_url: r.sourceUrl,
  }));
  const created = await batchCreateRecipes(reqs);
  const results = created.map((r: unknown) => mapRecipe(r as Record<string, unknown>));
  if (results.length > 0) notify();
  return results;
}

export async function deleteRecipe(recipeId: string): Promise<boolean> {
  const res = await deleteRecipeFromPanel(recipeId);
  if (res.success) {
    notify();
    return true;
  }
  return false;
}

export async function updateRecipe(
  recipeId: string,
  updates: Partial<Recipe>
): Promise<Recipe | null> {
  const res = await apiUpdateRecipe(recipeId, toApiFields(updates));
  if (res.success && res.recipe) {
    notify();
    return mapRecipe(res.recipe as unknown as Record<string, unknown>);
  }
  return null;
}

export async function deleteRecipesBatch(ids: string[]): Promise<boolean> {
  const res = await batchDeleteRecipes(ids);
  if (res.success) {
    notify();
    return true;
  }
  return false;
}

export async function clearAllRecipes(): Promise<void> {
  const recipes = await loadRecipes();
  const ids = recipes.map(r => r.id);
  if (ids.length > 0) await deleteRecipesBatch(ids);
}

export async function recipeExists(title: string): Promise<boolean> {
  const recipes = await loadRecipes();
  return recipes.some((r) => r.title.toLowerCase() === title.toLowerCase());
}

export async function toggleRecipeExpanded(recipeId: string): Promise<Recipe | null> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return null;
  return updateRecipe(recipeId, { isExpanded: !recipe.isExpanded });
}

export async function getExpandedRecipes(): Promise<Recipe[]> {
  const recipes = await loadRecipes();
  return recipes.filter((r) => r.isExpanded);
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const recipes = await apiSearchRecipes(query);
  return recipes.map((r: unknown) => mapRecipe(r as Record<string, unknown>));
}
