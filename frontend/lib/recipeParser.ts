/**
 * 菜谱内容解析工具
 * 从 AI 回复的消息中提取菜谱信息
 */

import { Recipe } from '@/types/recipe';

/**
 * 从标记块中提取菜谱字段
 */
function extractFieldsFromBlock(block: string): Partial<Recipe> {
  const recipe: Partial<Recipe> = {};

  const patterns: [keyof Recipe, RegExp, ((v: string) => unknown) | undefined][] = [
    ['title', /标题[：:]\s*(.+?)(?:\n|$)/i, v => v.trim()],
    ['difficulty', /难度[：:]\s*(.+?)(?:\n|$)/i, v => ['简单', '中等', '困难'].includes(v.trim()) ? v.trim() : undefined],
    ['cookingTime', /时间[：:]\s*(.+?)(?:\n|$)/i, v => v.trim()],
    ['score', /评分[：:]\s*(\d+(?:\.\d+)?)/i, v => { const s = parseFloat(v); return s >= 0 && s <= 5 ? s : undefined; }],
    ['reason', /理由[：:]\s*(.+?)(?:\n|$)/i, v => v.trim()],
    ['ingredients', /食材[：:]\s*([\s\S]*?)(?:调味料|步骤|做法|视频|$)/i, v => parseList(v)],
    ['seasonings', /调味料[：:]\s*([\s\S]*?)(?:步骤|做法|视频|$)/i, v => parseList(v)],
    ['steps', /步骤[：:]\s*([\s\S]*?)(?:视频|$)/i, v => parseList(v)],
    ['videoUrl', /视频[：:]\s*(https?:\/\/[^\s]+)/i, v => v.trim()],
  ];

  for (const [key, regex, transform] of patterns) {
    const match = block.match(regex);
    if (match) {
      const value = transform?.(match[1]) ?? match[1].trim();
      if (value !== undefined) {
        recipe[key] = value as never;
      }
    }
  }

  recipe.content = block.trim();
  return recipe;
}

/**
 * 从全文提取所有图片 URL（按出现顺序，去重）
 */
function extractImageUrls(content: string): string[] {
  const seen = new Set<string>();
  const imgRegex = /!\[.*?\]\((https?:\/\/[^)]+)\)/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    if (!seen.has(match[1])) seen.add(match[1]);
  }
  return [...seen];
}

/**
 * 从 AI 回复中解析所有带标记的菜谱块 [SAVE_RECIPE_START]...[SAVE_RECIPE_END]
 */
function parseAllMarkedRecipes(content: string): Array<{index: number; content: string; recipe: Partial<Recipe>}> {
  const recipes: Array<{index: number; content: string; recipe: Partial<Recipe>}> = [];
  const imageUrls = extractImageUrls(content);
  const regex = /\[SAVE_RECIPE_START\]([\s\S]*?)\[SAVE_RECIPE_END\]/g;
  let match;
  let index = 0;

  while ((match = regex.exec(content)) !== null) {
    const recipe = extractFieldsFromBlock(match[1]);
    if (imageUrls.length > index) {
      recipe.imageUrl = imageUrls[index];
    }
    recipes.push({ index: index++, content: match[0], recipe });
  }
  return recipes;
}

/**
 * 从普通文本中解析多个菜谱（按 ## 标题分割）
 */
function parseAllRecipesFromText(content: string): Array<{index: number; content: string; recipe: Partial<Recipe>}> {
  const recipes: Array<{index: number; content: string; recipe: Partial<Recipe>}> = [];
  // 补充 Markdown 标题区域的字段提取
  const extraPatterns: [keyof Recipe, RegExp, ((v: string) => unknown) | undefined][] = [
    ['title', /^##\s+(?:🍳\s*)?(?:食谱|菜谱)?[：:]?\s*(.+?)$/im, v => v.trim()],
    ['difficulty', /难度[：:]\s*(简单|中等|困难)/i, v => v.trim()],
    ['cookingTime', /时间[：:]\s*(\d+\s*(?:分钟|小时))/i, v => v.trim()],
    ['score', /评分[：:]\s*(\d+(?:\.\d+)?)/i, v => { const s = parseFloat(v); return s >= 0 && s <= 5 ? s : undefined; }],
    ['ingredients', /###?\s*(?:食材(?:清单|列表)?|所需食材|材料(?:清单)?)\s*[：:]?\s*\n([\s\S]*?)(?=###?|$)/i, v => parseList(v)],
    ['seasonings', /###?\s*(?:调味料|调料)\s*[：:]?\s*\n([\s\S]*?)(?=###?|$)/i, v => parseList(v)],
    ['steps', /###?\s*(?:制作步骤|烹饪步骤|(?<!\S)步骤|做法)\s*[：:]?\s*\n([\s\S]*?)(?=###?|$)/i, v => parseList(v)],
    ['videoUrl', /视频[：:]\s*(https?:\/\/[^\s]+)/i, v => v.trim()],
  ];

  const sections = content.split(/(?=^##\s+)/m);
  let index = 0;

  for (const section of sections) {
    if (!section.trim() || section.trim().length < 50) continue;
    const recipeSignals = [
      /食材(?!选择|搭配|储存|保鲜|技巧|小窍门|购买|挑选)/i,
      /步骤(?!详解|说明|建议|分析|解析|指南|总结|回顾|补充|注意|关键)/i,
      /调味料|调料/i,
      /^\d+\.\s+/m,
    ];
    if (recipeSignals.filter(r => r.test(section)).length < 2) continue;

    const recipe: Partial<Recipe> = {};
    for (const [key, regex, transform] of extraPatterns) {
      const match = section.match(regex);
      if (match) {
        const value = transform?.(match[1]) ?? match[1].trim();
        if (value !== undefined) {
          recipe[key] = value as never;
        }
      }
    }

    const imgMatch = section.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/i);
    if (imgMatch) recipe.imageUrl = imgMatch[1];

    const videoMatch = section.match(/###?\s*🎬\s*视频教程[\s\S]*?\[(?:[^\]]*)\]\((https?:\/\/[^)]+)\)/i)
      || section.match(/\[.*?\]\((https?:\/\/(?:www\.)?bilibili\.com\/video\/[^)]+)\)/i);
    if (videoMatch) recipe.videoUrl = videoMatch[1];

    recipe.content = section.trim();

    if (recipe.title) {
      recipes.push({ index: index++, content: section.trim(), recipe });
    }
  }

  // 回退：整个内容作为一个菜谱
  if (recipes.length === 0) {
    const recipe: Partial<Recipe> = {};
    for (const [key, regex, transform] of extraPatterns) {
      const match = content.match(regex);
      if (match) {
        const value = transform?.(match[1]) ?? match[1].trim();
        if (value !== undefined) {
          recipe[key] = value as never;
        }
      }
    }
    const imgMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/i);
    if (imgMatch) recipe.imageUrl = imgMatch[1];
    const videoMatch = content.match(/###?\s*🎬\s*视频教程[\s\S]*?\[(?:[^\]]*)\]\((https?:\/\/[^)]+)\)/i)
      || content.match(/\[.*?\]\((https?:\/\/(?:www\.)?bilibili\.com\/video\/[^)]+)\)/i);
    if (videoMatch) recipe.videoUrl = videoMatch[1];
    recipe.content = content;
    const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
    const hasSteps = recipe.steps && recipe.steps.length > 0;
    if (recipe.title && (hasIngredients || hasSteps)) {
      recipes.push({ index: 0, content, recipe });
    }
  }

  return recipes;
}

/**
 * 从 AI 回复中解析单个菜谱
 */
export function parseRecipeFromMessage(content: string): Partial<Recipe> {
  return parseMarkedRecipe(content) || parseRecipeFromText(content);
}

/**
 * 从 AI 回复中解析所有菜谱（多菜谱优先）
 */
export function parseAllRecipesFromMessage(content: string): Array<{index: number; content: string; recipe: Partial<Recipe>}> {
  const marked = parseAllMarkedRecipes(content);
  if (marked.length > 0) return marked;
  return parseAllRecipesFromText(content);
}

/** 解析单个带标记的菜谱 */
function parseMarkedRecipe(content: string): Partial<Recipe> | null {
  const match = content.match(/\[SAVE_RECIPE_START\]([\s\S]*?)\[SAVE_RECIPE_END\]/);
  return match ? extractFieldsFromBlock(match[1]) : null;
}

/** 从普通文本解析单个菜谱 */
function parseRecipeFromText(content: string): Partial<Recipe> {
  const recipe = parseAllRecipesFromText(content);
  return recipe.length > 0 ? recipe[0].recipe : {};
}

/**
 * 解析列表项：支持 - / * / 1. 前缀
 */
function parseList(text: string): string[] {
  const items = text
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));

  // 如果只有单行且包含中文分号，可能是SAVE块压缩的步骤列表
  if (items.length === 1 && /[；;]/.test(items[0])) {
    return items[0]
      .split(/[；;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return items;
}

/**
 * 检查消息是否包含菜谱内容
 */
export function containsRecipe(content: string): boolean {
  if (content.includes('[SAVE_RECIPE_START]')) return true;

  const hasHeaders = /^##\s+/m.test(content);
  const hasNumberedList = /^\d+\.\s+/m.test(content);

  if (hasHeaders && hasNumberedList) {
    const keywords = ['食谱', '菜谱', '做法', '步骤', '食材', '调味料', '烹饪', '制作'];
    return keywords.filter(k => content.includes(k)).length >= 3;
  }

  const hasBullets = /^[-*•]\s+/m.test(content);
  if (hasHeaders && hasBullets) {
    return /食材/.test(content) && /步骤/.test(content);
  }

  return false;
}

/** 提取菜谱标题 */
export function extractRecipeTitle(content: string): string | null {
  return parseRecipeFromMessage(content).title || null;
}

/** 验证菜谱数据完整性 */
export function validateRecipe(recipe: Partial<Recipe>): boolean {
  return !!(recipe.title && recipe.content && (
    (recipe.ingredients && recipe.ingredients.length > 0) ||
    (recipe.steps && recipe.steps.length > 0)
  ));
}
