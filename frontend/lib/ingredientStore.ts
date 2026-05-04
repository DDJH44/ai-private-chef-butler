import {Ingredient, IngredientStore, IngredientCategory, calculateStatus, calculateExpiryDate} from '@/types/ingredient';

const STORAGE_KEY = 'ai_chef_ingredients';

export const INGREDIENT_CHANGE_EVENT = 'ingredientChange';

function notifyIngredientChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(INGREDIENT_CHANGE_EVENT));
    }
}

export function loadIngredients(): Ingredient[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const store: IngredientStore = JSON.parse(stored);
        return (store.ingredients || []).map((ing) => ({
            ...ing,
            status: calculateStatus(ing.expiry_date),
        }));
    } catch (error) {
        console.error('加载食材库存失败:', error);
        return [];
    }
}

export function saveIngredients(ingredients: Ingredient[]): void {
    try {
        const store: IngredientStore = {
            ingredients,
            lastUpdated: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('保存食材库存失败:', error);
    }
}

export function addIngredient(
    data: Omit<Ingredient, 'id' | 'status' | 'created_at' | 'updated_at'>
): Ingredient {
    const ingredients = loadIngredients();
    const now = new Date().toISOString();
    const expiryDate = data.expiry_date || calculateExpiryDate(data.purchase_date, data.shelf_life_days);

    const newIngredient: Ingredient = {
        ...data,
        id: `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expiry_date: expiryDate,
        status: calculateStatus(expiryDate),
        created_at: now,
        updated_at: now,
    };

    ingredients.unshift(newIngredient);
    saveIngredients(ingredients);
    notifyIngredientChange();
    return newIngredient;
}

export function updateIngredient(id: string, updates: Partial<Ingredient>): Ingredient | null {
    const ingredients = loadIngredients();
    const index = ingredients.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const updated = {
        ...ingredients[index],
        ...updates,
        updated_at: new Date().toISOString(),
    };
    if (updates.expiry_date || updates.purchase_date || updates.shelf_life_days) {
        updated.expiry_date = updated.expiry_date || calculateExpiryDate(updated.purchase_date, updated.shelf_life_days);
        updated.status = calculateStatus(updated.expiry_date);
    }

    ingredients[index] = updated;
    saveIngredients(ingredients);
    notifyIngredientChange();
    return updated;
}

export function deleteIngredient(id: string): boolean {
    const ingredients = loadIngredients();
    const filtered = ingredients.filter((i) => i.id !== id);
    if (filtered.length === ingredients.length) return false;
    saveIngredients(filtered);
    notifyIngredientChange();
    return true;
}

export function getExpiringCount(): number {
    const ingredients = loadIngredients();
    return ingredients.filter((i) => {
        const status = calculateStatus(i.expiry_date);
        return status === "expiring_soon" || status === "expired";
    }).length;
}

export function searchIngredients(query: string): Ingredient[] {
    const ingredients = loadIngredients();
    const q = query.toLowerCase();
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
}

export function filterByCategory(category: IngredientCategory | "全部"): Ingredient[] {
    const ingredients = loadIngredients();
    if (category === "全部") return ingredients;
    return ingredients.filter((i) => i.category === category);
}
