export type IngredientCategory = "蔬菜" | "肉类" | "蛋奶" | "调味料" | "干货" | "其他";
export type IngredientUnit = "个" | "克" | "千克" | "毫升" | "升" | "瓶" | "袋" | "盒";
export type IngredientStatus = "normal" | "expiring_soon" | "expired";

export interface Ingredient {
    id: string;
    name: string;
    category: IngredientCategory;
    quantity: number;
    unit: IngredientUnit;
    purchase_date: string;
    shelf_life_days: number;
    expiry_date: string;
    status: IngredientStatus;
    created_at: string;
    updated_at: string;
}

export interface IngredientStore {
    ingredients: Ingredient[];
    lastUpdated: number;
}

export const CATEGORY_OPTIONS: IngredientCategory[] = ["蔬菜", "肉类", "蛋奶", "调味料", "干货", "其他"];

export const UNIT_OPTIONS: IngredientUnit[] = ["个", "克", "千克", "毫升", "升", "瓶", "袋", "盒"];

export const DEFAULT_SHELF_LIFE: Record<string, number> = {
    "鸡蛋": 30,
    "牛奶": 7,
    "豆腐": 3,
    "猪肉": 3,
    "牛肉": 5,
    "鸡肉": 3,
    "鱼": 2,
    "虾": 2,
    "白菜": 7,
    "土豆": 30,
    "番茄": 7,
    "黄瓜": 5,
    "青椒": 7,
    "洋葱": 30,
    "大蒜": 60,
    "生姜": 30,
    "酱油": 365,
    "醋": 365,
    "盐": 1825,
    "糖": 730,
    "食用油": 365,
    "大米": 365,
    "面粉": 180,
    "面条": 180,
};

export function calculateStatus(expiryDate: string): IngredientStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "expired";
    if (diffDays <= 3) return "expiring_soon";
    return "normal";
}

export function calculateExpiryDate(purchaseDate: string, shelfLifeDays: number): string {
    const date = new Date(purchaseDate);
    date.setDate(date.getDate() + shelfLifeDays);
    return date.toISOString().split("T")[0];
}

export function getDaysRemaining(expiryDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const STATUS_CONFIG: Record<IngredientStatus, {label: string; color: string; bg: string; border: string}> = {
    normal: {label: "正常", color: "text-[#5B8C5A]", bg: "bg-[#5B8C5A]/10", border: "border-[#5B8C5A]/30"},
    expiring_soon: {label: "即将过期", color: "text-[#D4A853]", bg: "bg-[#D4A853]/10", border: "border-[#D4A853]/30"},
    expired: {label: "已过期", color: "text-[#C44F4F]", bg: "bg-[#C44F4F]/10", border: "border-[#C44F4F]/30"},
};

export const CATEGORY_ICONS: Record<IngredientCategory, string> = {
    "蔬菜": "🥬",
    "肉类": "🥩",
    "蛋奶": "🥚",
    "调味料": "🧂",
    "干货": "🌾",
    "其他": "📦",
};
