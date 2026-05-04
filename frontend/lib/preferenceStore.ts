import {Preference, PreferenceStore, DEFAULT_PREFERENCE} from '@/types/preference';

const STORAGE_KEY = 'ai_chef_preference';

export const PREFERENCE_CHANGE_EVENT = 'preferenceChange';

function notifyPreferenceChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(PREFERENCE_CHANGE_EVENT));
    }
}

export function loadPreference(): Preference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {...DEFAULT_PREFERENCE};

        const store: PreferenceStore = JSON.parse(stored);
        return store.preference || {...DEFAULT_PREFERENCE};
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
