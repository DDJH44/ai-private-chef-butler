export interface FamilyMember {
    id: string;
    role: "adult" | "child" | "elderly" | "baby";
    age: number;
    notes: string;
}

export interface TastePreference {
    spice: number;
    salt: number;
    sweet: number;
    oil: number;
}

export interface Preference {
    allergies: string[];
    custom_allergies: string[];
    diet_type: string;
    taste: TastePreference;
    family_members: FamilyMember[];
}

export interface PreferenceStore {
    preference: Preference;
    lastUpdated: number;
}

export const DEFAULT_PREFERENCE: Preference = {
    allergies: [],
    custom_allergies: [],
    diet_type: "normal",
    taste: {
        spice: 3,
        salt: 3,
        sweet: 3,
        oil: 3,
    },
    family_members: [],
};

export const ALLERGY_OPTIONS = [
    "花生", "海鲜", "乳制品", "鸡蛋",
    "大豆", "麸质", "坚果", "贝类",
];

export const DIET_TYPES = [
    {value: "normal", icon: "🥩", name: "普通饮食", desc: "无特殊限制"},
    {value: "vegan", icon: "🥬", name: "纯素食", desc: "不含任何动物性食材"},
    {value: "vegetarian", icon: "🥚", name: "蛋奶素", desc: "可含蛋和奶制品"},
    {value: "keto", icon: "🥩", name: "生酮饮食", desc: "高脂肪低碳水"},
    {value: "fitness", icon: "💪", name: "健身增肌", desc: "高蛋白高热量"},
    {value: "low_calorie", icon: "🥗", name: "低卡减脂", desc: "低热量低脂肪"},
];

export const TASTE_DIMENSIONS = [
    {key: "spice" as const, label: "辣度", left: "不辣", right: "嗜辣"},
    {key: "salt" as const, label: "咸淡", left: "偏淡", right: "偏咸"},
    {key: "sweet" as const, label: "甜度", left: "不甜", right: "偏甜"},
    {key: "oil" as const, label: "油量", left: "少油", right: "正常"},
];

export const ROLE_OPTIONS = [
    {value: "adult", label: "成人"},
    {value: "child", label: "儿童"},
    {value: "elderly", label: "老人"},
    {value: "baby", label: "婴儿"},
];
