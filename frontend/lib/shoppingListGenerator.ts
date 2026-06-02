import {generateUUID} from '@/lib/utils';
import {loadIngredients} from '@/lib/ingredientStore';
import {addShoppingList} from '@/lib/shoppingListStore';
import {ShoppingList, ShoppingListItem} from '@/types/shoppingList';
import {Recipe} from '@/types/recipe';

interface ParsedIngredient {
    name: string;
    amount: number;
    unit: string;
}

const UNIT_PATTERNS: [RegExp, string][] = [
    [/(\d+(?:\.\d+)?)\s*(千克|公斤|kg)/i, '千克'],
    [/(\d+(?:\.\d+)?)\s*(克|g)/i, '克'],
    [/(\d+(?:\.\d+)?)\s*(毫升|ml)/i, '毫升'],
    [/(\d+(?:\.\d+)?)\s*(升|l|L)/i, '升'],
    [/(\d+(?:\.\d+)?)\s*(个|只|颗|枚)/, '个'],
    [/(\d+(?:\.\d+)?)\s*(根|条)/, '根'],
    [/(\d+(?:\.\d+)?)\s*(块|片)/, '块'],
    [/(\d+(?:\.\d+)?)\s*(瓶|罐)/, '瓶'],
    [/(\d+(?:\.\d+)?)\s*(袋|包)/, '袋'],
    [/(\d+(?:\.\d+)?)\s*(盒|箱)/, '盒'],
    [/(\d+(?:\.\d+)?)\s*(勺|汤匙|大勺)/, '勺'],
    [/(\d+(?:\.\d+)?)\s*(把|束|捆)/, '把'],
    [/(\d+(?:\.\d+)?)\s*(适量|少许)/, '适量'],
];

export function parseIngredientString(raw: string): ParsedIngredient {
    const trimmed = raw.trim();
    for (const [pattern, unit] of UNIT_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            const name = trimmed.replace(match[0], '').trim() || trimmed;
            return {name, amount: parseFloat(match[1]), unit};
        }
    }
    const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (numMatch && numMatch[2]) {
        return {name: numMatch[2].trim(), amount: parseFloat(numMatch[1]), unit: '份'};
    }
    return {name: trimmed, amount: 1, unit: '份'};
}

const IGNORE_NAMES = new Set(['盐', '糖', '味精', '鸡精', '料酒', '生抽', '老抽', '醋', '胡椒', '花椒', '姜', '蒜', '葱', '油', '淀粉']);

function extractIngredientsFromContent(content: string): string[] {
  const match = content.match(/食材[：:]\s*([^\n]+)/);
  if (match) return match[1].split(/[，,]/).map(s => s.trim()).filter(Boolean);
  // Try markdown lists
  const listMatch = content.match(/###?\s*🥬\s*食材\n([\s\S]*?)(?=###|$)/);
  if (listMatch) {
    return listMatch[1].split('\n')
      .map(l => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

export async function generateShoppingListFromRecipes(
    recipes: Recipe[],
): Promise<ShoppingList[]> {
    const inventory = loadIngredients();
    const lists: ShoppingList[] = [];

    for (const recipe of recipes) {
        const rawIngredients = recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients
            : extractIngredientsFromContent(recipe.content || '');
        const allRaw = [
            ...rawIngredients.flatMap(s => s.split(/[，,]/).map(x => x.trim()).filter(Boolean)),
            ...(recipe.seasonings || []).flatMap(s => s.split(/[，,]/).map(x => x.trim()).filter(Boolean)),
        ];

        const items: ShoppingListItem[] = allRaw
            .map(raw => parseIngredientString(raw))
            .filter(parsed => !IGNORE_NAMES.has(parsed.name) || parsed.amount >= 2)
            .map(parsed => {
                const stockItem = inventory.find(
                    inv => inv.name === parsed.name || inv.name.includes(parsed.name) || parsed.name.includes(inv.name)
                );
                const stockAmount = stockItem ? stockItem.quantity : 0;
                const inStock = stockItem !== undefined && stockAmount >= parsed.amount;

                return {
                    id: generateUUID(),
                    ingredient_name: parsed.name,
                    required_amount: parsed.amount,
                    unit: parsed.unit,
                    in_stock: inStock,
                    stock_amount: stockAmount,
                    checked: inStock,
                    recipe_names: [recipe.title],
                };
            });

        const list: ShoppingList = {
            id: `list_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            created_at: new Date().toISOString(),
            source_recipes: [recipe.id],
            source_recipe_names: [recipe.title],
            items,
            status: 'pending',
        };

        const created = await addShoppingList(list);
        lists.push(created);
    }

    return lists;
}
