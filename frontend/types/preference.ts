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

export interface NutritionTargets {
    daily_calories?: number;
    protein_target?: number;
    carbs_target?: number;
    fat_target?: number;
    fiber_target?: number;
    goal_type?: "muscle_gain" | "fat_loss" | "maintain" | "custom";
}

export interface BodyMetric {
    id: string;
    user_id: string;
    date: string;
    weight?: number;
    body_fat?: number;
    muscle_mass?: number;
    waist?: number;
    notes?: string;
    created_at: number;
}

export interface Preference {
    allergies: string[];
    custom_allergies: string[];
    diet_type: string;
    taste: TastePreference;
    family_members: FamilyMember[];
    nutrition_targets?: NutritionTargets;
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

export const GOAL_TYPES = [
    {value: "muscle_gain", label: "增肌", desc: "热量盈余 + 高蛋白", icon: "💪"},
    {value: "fat_loss", label: "减脂", desc: "热量缺口 + 高蛋白", icon: "🔥"},
    {value: "maintain", label: "维持", desc: "保持当前体重和体型", icon: "⚖"},
    {value: "custom", label: "自定义", desc: "手动设置各项营养目标", icon: "🎯"},
];
