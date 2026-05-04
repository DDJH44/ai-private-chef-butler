import {ShoppingList, ShoppingListStore, ShoppingListItem} from '@/types/shoppingList';

const STORAGE_KEY = 'ai_chef_shopping_lists';

export const SHOPPING_LIST_CHANGE_EVENT = 'shoppingListChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SHOPPING_LIST_CHANGE_EVENT));
    }
}

export function loadShoppingLists(): ShoppingList[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const store: ShoppingListStore = JSON.parse(stored);
        return store.shopping_lists || [];
    } catch (error) {
        console.error('加载购物清单失败:', error);
        return [];
    }
}

export function saveShoppingLists(lists: ShoppingList[]): void {
    try {
        const store: ShoppingListStore = {shopping_lists: lists, lastUpdated: Date.now()};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('保存购物清单失败:', error);
    }
}

export function addShoppingList(list: ShoppingList): void {
    const lists = loadShoppingLists();
    lists.unshift(list);
    saveShoppingLists(lists);
    notifyChange();
}

export function updateShoppingList(id: string, updates: Partial<ShoppingList>): void {
    const lists = loadShoppingLists();
    const index = lists.findIndex((l) => l.id === id);
    if (index === -1) return;
    lists[index] = {...lists[index], ...updates};
    saveShoppingLists(lists);
    notifyChange();
}

export function deleteShoppingList(id: string): void {
    const lists = loadShoppingLists().filter((l) => l.id !== id);
    saveShoppingLists(lists);
    notifyChange();
}

export function toggleItemChecked(listId: string, itemId: string): void {
    const lists = loadShoppingLists();
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;
    item.checked = !item.checked;
    saveShoppingLists(lists);
    notifyChange();
}
