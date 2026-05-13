import {ChatHistorySession, ViewHistoryItem, CookHistoryItem, HistoryStore} from '@/types/history';
import { getToken } from './authStore';
import { apiPath } from './env';

const STORAGE_KEY = 'ai_chef_history';
const COOK_API = apiPath('/v1/cook-history');

export const HISTORY_CHANGE_EVENT = 'historyChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(HISTORY_CHANGE_EVENT));
    }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function fetchRemoteCookHistory(): Promise<CookHistoryItem[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const resp = await fetch(COOK_API, { headers: authHeaders() });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.records || []).map((r: Record<string, unknown>) => ({
      ...r, created_at: String(r.created_at || ''),
    })) as CookHistoryItem[];
  } catch { return []; }
}

async function pushCookRecord(record: CookHistoryItem): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(COOK_API, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(record),
    });
  } catch { /* 静默 */ }
}

async function deleteRemoteCookRecord(id: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${COOK_API}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  } catch { /* 静默 */ }
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
    const local = loadStore().cook_history;
    // 异步拉取远程记录合并
    fetchRemoteCookHistory().then(remote => {
      if (remote.length === 0) return;
      const merged = new Map<string, CookHistoryItem>();
      for (const r of remote) merged.set(r.id, r);
      for (const r of local) {
        if (!merged.has(r.id) || new Date(r.created_at) > new Date(merged.get(r.id)!.created_at)) {
          merged.set(r.id, r);
        }
      }
      const store = loadStore();
      store.cook_history = [...merged.values()].sort((a, b) =>
        new Date(b.cook_date).getTime() - new Date(a.cook_date).getTime()
      );
      saveStore(store);
      notifyChange();
    });
    return local;
}

export function addCookRecord(record: CookHistoryItem): void {
    const store = loadStore();
    store.cook_history.unshift(record);
    saveStore(store);
    notifyChange();
    pushCookRecord(record);
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
    deleteRemoteCookRecord(id);
}
