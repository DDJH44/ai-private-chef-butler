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

interface MergedIngredient {
    name: string;
    totalAmount: number;
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

export function mergeIngredients(ingredientLists: string[][]): MergedIngredient[] {
    const map = new Map<string, MergedIngredient>();

    for (const list of ingredientLists) {
        for (const raw of list) {
            const parsed = parseIngredientString(raw);
            const key = parsed.name;
            const existing = map.get(key);
            if (existing) {
                if (existing.unit === parsed.unit || existing.unit === '份' || parsed.unit === '份') {
                    existing.totalAmount += parsed.amount;
                    if (existing.unit === '份' && parsed.unit !== '份') {
                        existing.unit = parsed.unit;
                    }
                } else {
                    existing.totalAmount += parsed.amount;
                }
            } else {
                map.set(key, {
                    name: parsed.name,
                    totalAmount: parsed.amount,
                    unit: parsed.unit,
                });
            }
        }
    }

    return Array.from(map.values());
}

const IGNORE_NAMES = new Set(['盐', '糖', '味精', '鸡精', '料酒', '生抽', '老抽', '醋', '胡椒', '花椒', '姜', '蒜', '葱', '油', '淀粉']);

export async function generateShoppingListFromRecipes(
    recipes: Recipe[],
): Promise<ShoppingList> {
    const inventory = loadIngredients();

    const ingredientLists = recipes.map(r => r.ingredients || []);
    const merged = mergeIngredients(ingredientLists);

    const seasoningLists = recipes.map(r => r.seasonings || []);
    const mergedSeasonings = mergeIngredients(seasoningLists);

    const allMerged = [...merged, ...mergedSeasonings];

    const items: ShoppingListItem[] = allMerged
        .filter(item => !IGNORE_NAMES.has(item.name) || item.totalAmount >= 2)
        .map(item => {
            const stockItem = inventory.find(
                inv => inv.name === item.name || inv.name.includes(item.name) || item.name.includes(inv.name)
            );
            const stockAmount = stockItem ? stockItem.quantity : 0;
            const inStock = stockItem !== undefined && stockAmount >= item.totalAmount;

            return {
                id: generateUUID(),
                ingredient_name: item.name,
                required_amount: item.totalAmount,
                unit: item.unit,
                in_stock: inStock,
                stock_amount: stockAmount,
                checked: inStock,
            };
        });

    const list: ShoppingList = {
        id: `list_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        created_at: new Date().toISOString(),
        source_recipes: recipes.map(r => r.id),
        source_recipe_names: recipes.map(r => r.title),
        items,
        status: 'pending',
    };

    return await addShoppingList(list);
}
