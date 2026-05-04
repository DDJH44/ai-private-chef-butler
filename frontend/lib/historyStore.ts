import {ChatHistorySession, ViewHistoryItem, CookHistoryItem, HistoryStore} from '@/types/history';

const STORAGE_KEY = 'ai_chef_history';

export const HISTORY_CHANGE_EVENT = 'historyChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(HISTORY_CHANGE_EVENT));
    }
}

function loadStore(): HistoryStore {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {chat_history: [], view_history: [], cook_history: [], lastUpdated: 0};
        return JSON.parse(stored);
    } catch {
        return {chat_history: [], view_history: [], cook_history: [], lastUpdated: 0};
    }
}

function saveStore(store: HistoryStore): void {
    store.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadChatHistory(): ChatHistorySession[] {
    return loadStore().chat_history;
}

export function saveChatSession(session: ChatHistorySession): void {
    const store = loadStore();
    const index = store.chat_history.findIndex((s) => s.session_id === session.session_id);
    if (index >= 0) {
        store.chat_history[index] = session;
    } else {
        store.chat_history.unshift(session);
    }
    saveStore(store);
    notifyChange();
}

export function deleteChatSession(sessionId: string): void {
    const store = loadStore();
    store.chat_history = store.chat_history.filter((s) => s.session_id !== sessionId);
    saveStore(store);
    notifyChange();
}

export function loadViewHistory(): ViewHistoryItem[] {
    return loadStore().view_history;
}

export function recordView(recipeId: string, recipeName: string): void {
    const store = loadStore();
    const existing = store.view_history.find((v) => v.recipe_id === recipeId);
    if (existing) {
        existing.view_count += 1;
        existing.last_viewed_at = new Date().toISOString();
    } else {
        store.view_history.unshift({
            recipe_id: recipeId,
            recipe_name: recipeName,
            view_count: 1,
            last_viewed_at: new Date().toISOString(),
        });
    }
    saveStore(store);
    notifyChange();
}

export function clearViewHistory(): void {
    const store = loadStore();
    store.view_history = [];
    saveStore(store);
    notifyChange();
}

export function loadCookHistory(): CookHistoryItem[] {
    return loadStore().cook_history;
}

export function addCookRecord(record: CookHistoryItem): void {
    const store = loadStore();
    store.cook_history.unshift(record);
    saveStore(store);
    notifyChange();
}

export function updateCookRecord(id: string, updates: Partial<CookHistoryItem>): void {
    const store = loadStore();
    const index = store.cook_history.findIndex((c) => c.id === id);
    if (index >= 0) {
        store.cook_history[index] = {...store.cook_history[index], ...updates};
        saveStore(store);
        notifyChange();
    }
}

export function deleteCookRecord(id: string): void {
    const store = loadStore();
    store.cook_history = store.cook_history.filter((c) => c.id !== id);
    saveStore(store);
    notifyChange();
}
