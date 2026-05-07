import { ShoppingList } from '@/types/shoppingList';
import {
    fetchShoppingLists,
    createShoppingList as apiCreate,
    updateShoppingList as apiUpdate,
    deleteShoppingList as apiDelete,
    toggleShoppingItem as apiToggle,
} from '@/lib/shoppingListApi';

export const SHOPPING_LIST_CHANGE_EVENT = 'shoppingListChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SHOPPING_LIST_CHANGE_EVENT));
    }
}

export async function loadShoppingLists(): Promise<ShoppingList[]> {
    try {
        return await fetchShoppingLists();
    } catch (error) {
        console.error('加载购物清单失败:', error);
        return [];
    }
}

export async function addShoppingList(list: ShoppingList): Promise<ShoppingList> {
    const created = await apiCreate({
        source_recipes: list.source_recipes,
        source_recipe_names: list.source_recipe_names,
        items: list.items,
    });
    notifyChange();
    return created;
}

export async function updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<void> {
    try {
        await apiUpdate(id, {
            source_recipe_names: updates.source_recipe_names,
            items: updates.items,
            status: updates.status,
        });
        notifyChange();
    } catch (error) {
        console.error('更新购物清单失败:', error);
    }
}

export async function deleteShoppingList(id: string): Promise<void> {
    try {
        await apiDelete(id);
        notifyChange();
    } catch (error) {
        console.error('删除购物清单失败:', error);
    }
}

export async function toggleItemChecked(listId: string, itemId: string): Promise<void> {
    try {
        await apiToggle(listId, itemId);
        notifyChange();
    } catch (error) {
        console.error('切换项目勾选失败:', error);
    }
}
