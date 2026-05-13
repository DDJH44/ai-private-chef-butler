import {Preference, PreferenceStore, DEFAULT_PREFERENCE} from '@/types/preference';
import { getToken } from './authStore';
import { apiPath } from './env';

const STORAGE_KEY = 'ai_chef_preference';
const PREF_API = apiPath('/v1/preferences');

export const PREFERENCE_CHANGE_EVENT = 'preferenceChange';

function notifyPreferenceChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PREFERENCE_CHANGE_EVENT));
    }
}

function sanitize(pref: Preference): Preference {
  return {
    ...pref,
    allergies: (pref.allergies || []).filter(a => a && a.trim()),
    custom_allergies: (pref.custom_allergies || []).filter(a => a && a.trim()),
  };
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function fetchRemotePreference(): Promise<Preference | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const resp = await fetch(PREF_API, { headers: authHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.preference || null;
  } catch { return null; }
}

async function pushRemotePreference(pref: Preference): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(PREF_API, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(pref),
    });
  } catch { /* 静默失败，本地已保存 */ }
}

export function loadPreference(): Preference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          // 尝试从后端拉取
          fetchRemotePreference().then(remote => {
            if (remote) savePreference(remote);
          });
          return {...DEFAULT_PREFERENCE};
        }

        const store: PreferenceStore = JSON.parse(stored);
        const pref = store.preference || {...DEFAULT_PREFERENCE};
        const cleaned = sanitize(pref);
        if (JSON.stringify(cleaned) !== JSON.stringify(pref)) {
          savePreference(cleaned);
        }
        return cleaned;
    } catch (error) {
        console.error('加载偏好设置失败:', error);
        return {...DEFAULT_PREFERENCE};
    }
}

export function savePreference(preference: Preference): void {
    try {
        const store: PreferenceStore = {
            preference,
            lastUpdated: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        notifyPreferenceChange();
        pushRemotePreference(preference);
    } catch (error) {
        console.error('保存偏好设置失败:', error);
    }
}

export function updatePreference(updates: Partial<Preference>): Preference {
    const current = loadPreference();
    const updated: Preference = {
        ...current,
        ...updates,
    };
    savePreference(updated);
    return updated;
}
