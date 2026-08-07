import {Preference, PreferenceStore, DEFAULT_PREFERENCE} from '@/types/preference';
import { getToken } from './authStore';
import { apiPath, authJsonHeaders, authFetch } from './http';

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

async function fetchRemotePreference(): Promise<Preference | null> {
  if (!getToken()) return null;
  try {
    const resp = await authFetch(PREF_API, { headers: authJsonHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data || null;
  } catch { return null; }
}

async function pushRemotePreference(pref: Preference): Promise<void> {
  if (!getToken()) return;
  try {
    await authFetch(PREF_API, {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify(pref),
    });
  } catch (e) { console.warn('推送偏好设置失败:', e); }
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
