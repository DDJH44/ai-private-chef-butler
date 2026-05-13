export interface MealNutrition {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface MealItem {
    recipe_id: string | null;
    recipe_name: string | null;
    ingredients?: string[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    status: "planned" | "empty";
}

export interface DayPlan {
    date: string;
    weekday: string;
    meals: {
        breakfast: MealItem;
        lunch: MealItem;
        dinner: MealItem;
    };
    daily_total: MealNutrition;
}

export interface MealPlan {
    id: string;
    week_start: string;
    week_end: string;
    generation_mode: "full" | "breakfast_only" | "lunch_only" | "dinner_only";
    days: DayPlan[];
    weekly_total: MealNutrition;
    status: "active" | "archived";
}

export interface MealPlanStore {
    meal_plans: MealPlan[];
    lastUpdated: number;
}

export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export const MEAL_TYPES = [
    {key: "breakfast" as const, label: "早餐", icon: "🌅"},
    {key: "lunch" as const, label: "午餐", icon: "🌞"},
    {key: "dinner" as const, label: "晚餐", icon: "🌙"},
];

export const EMPTY_MEAL: MealItem = {
    recipe_id: null,
    recipe_name: null,
    ingredients: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    status: "empty",
};

export function getWeekRange(date: Date): {start: string; end: string} {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        start: monday.toISOString().split("T")[0],
        end: sunday.toISOString().split("T")[0],
    };
}

export function getWeekDates(startStr: string): string[] {
    const start = new Date(startStr);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

export function formatWeekRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`;
}

export function createEmptyMealPlan(start: string, end: string): MealPlan {
    const dates = getWeekDates(start);
    const days: DayPlan[] = dates.map((date, i) => ({
        date,
        weekday: WEEKDAYS[i],
        meals: {
            breakfast: {...EMPTY_MEAL},
            lunch: {...EMPTY_MEAL},
            dinner: {...EMPTY_MEAL},
        },
        daily_total: {calories: 0, protein: 0, carbs: 0, fat: 0},
    }));

    return {
        id: `plan_${Date.now()}`,
        week_start: start,
        week_end: end,
        generation_mode: "full",
        days,
        weekly_total: {calories: 0, protein: 0, carbs: 0, fat: 0},
        status: "active",
    };
}
