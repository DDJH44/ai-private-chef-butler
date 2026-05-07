import {Preference, PreferenceStore, DEFAULT_PREFERENCE} from '@/types/preference';

const STORAGE_KEY = 'ai_chef_preference';

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

export function loadPreference(): Preference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {...DEFAULT_PREFERENCE};

        const store: PreferenceStore = JSON.parse(stored);
        const pref = store.preference || {...DEFAULT_PREFERENCE};
        const cleaned = sanitize(pref);
        // Auto-fix stale data
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
