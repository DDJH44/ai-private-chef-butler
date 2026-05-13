import { ShoppingList, ShoppingListItem } from '@/types/shoppingList';
import { getToken } from './authStore';

import { apiPath } from './env';
const BASE = apiPath('/v1/shopping');

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ShoppingListFromAPI {
    id: string;
    created_at: number;  // unix ms from backend
    source_recipes: string[];
    source_recipe_names: string[];
    items: ShoppingListItem[];
    status: string;
}

function mapList(api: ShoppingListFromAPI): ShoppingList {
    return {
        ...api,
        created_at: new Date(api.created_at).toISOString(),
        status: api.status as "pending" | "completed",
    };
}

function mapLists(apiLists: ShoppingListFromAPI[]): ShoppingList[] {
    return apiLists.map(mapList);
}

export async function fetchShoppingLists(): Promise<ShoppingList[]> {
    const resp = await fetch(BASE, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`Failed to fetch shopping lists: ${resp.status}`);
    const data = await resp.json();
    return mapLists(data.shopping_lists || []);
}

export async function createShoppingList(data: {
    source_recipes?: string[];
    source_recipe_names?: string[];
    items: ShoppingListItem[];
}): Promise<ShoppingList> {
    const resp = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
            source_recipes: data.source_recipes || [],
            source_recipe_names: data.source_recipe_names || [],
            items: data.items.map(i => ({
                ingredient_name: i.ingredient_name,
                required_amount: i.required_amount,
                unit: i.unit,
                in_stock: i.in_stock,
                stock_amount: i.stock_amount,
                checked: i.checked,
            })),
        }),
    });
    if (!resp.ok) throw new Error(`Failed to create shopping list: ${resp.status}`);
    return mapList(await resp.json());
}

export async function updateShoppingList(
    id: string,
    data: { source_recipe_names?: string[]; items?: ShoppingListItem[]; status?: string },
): Promise<ShoppingList> {
    const body: Record<string, unknown> = {};
    if (data.source_recipe_names !== undefined) body.source_recipe_names = data.source_recipe_names;
    if (data.items !== undefined) {
        body.items = data.items.map(i => ({
            ingredient_name: i.ingredient_name,
            required_amount: i.required_amount,
            unit: i.unit,
            in_stock: i.in_stock,
            stock_amount: i.stock_amount,
            checked: i.checked,
        }));
    }
    if (data.status !== undefined) body.status = data.status;

    const resp = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Failed to update shopping list: ${resp.status}`);
    return mapList(await resp.json());
}

export async function deleteShoppingList(id: string): Promise<void> {
    const resp = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!resp.ok) throw new Error(`Failed to delete shopping list: ${resp.status}`);
}

export async function toggleShoppingItem(listId: string, itemId: string): Promise<ShoppingList> {
    const resp = await fetch(`${BASE}/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}/toggle`, { method: 'PATCH', headers: authHeaders() });
    if (!resp.ok) throw new Error(`Failed to toggle item: ${resp.status}`);
    return mapList(await resp.json());
}
