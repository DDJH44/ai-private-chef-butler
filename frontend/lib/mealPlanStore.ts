import {MealPlan, MealPlanStore, MealItem, createEmptyMealPlan, getWeekRange} from '@/types/mealPlan';

const STORAGE_KEY = 'ai_chef_meal_plans';

export const MEAL_PLAN_CHANGE_EVENT = 'mealPlanChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MEAL_PLAN_CHANGE_EVENT));
    }
}

export function loadMealPlans(): MealPlan[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const store: MealPlanStore = JSON.parse(stored);
        return store.meal_plans || [];
    } catch {
        return [];
    }
}

export function saveMealPlans(plans: MealPlan[]): void {
    try {
        const store: MealPlanStore = {meal_plans: plans, lastUpdated: Date.now()};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('保存膳食计划失败:', error);
    }
}

export function getOrCreateWeekPlan(date: Date): MealPlan {
    const plans = loadMealPlans();
    const {start, end} = getWeekRange(date);
    const existing = plans.find((p) => p.week_start === start && p.status === "active");
    if (existing) return existing;

    const newPlan = createEmptyMealPlan(start, end);
    plans.unshift(newPlan);
    saveMealPlans(plans);
    notifyChange();
    return newPlan;
}

export function updateMealInPlan(
    planId: string,
    date: string,
    mealType: "breakfast" | "lunch" | "dinner",
    meal: MealItem
): void {
    const plans = loadMealPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const day = plan.days.find((d) => d.date === date);
    if (!day) return;

    day.meals[mealType] = meal;
    day.daily_total = {
        calories: day.meals.breakfast.calories + day.meals.lunch.calories + day.meals.dinner.calories,
        protein: day.meals.breakfast.protein + day.meals.lunch.protein + day.meals.dinner.protein,
        carbs: day.meals.breakfast.carbs + day.meals.lunch.carbs + day.meals.dinner.carbs,
        fat: day.meals.breakfast.fat + day.meals.lunch.fat + day.meals.dinner.fat,
    };

    plan.weekly_total = plan.days.reduce(
        (acc, d) => ({
            calories: acc.calories + d.daily_total.calories,
            protein: acc.protein + d.daily_total.protein,
            carbs: acc.carbs + d.daily_total.carbs,
            fat: acc.fat + d.daily_total.fat,
        }),
        {calories: 0, protein: 0, carbs: 0, fat: 0}
    );

    saveMealPlans(plans);
    notifyChange();
}

export function removeMealFromPlan(planId: string, date: string, mealType: "breakfast" | "lunch" | "dinner"): void {
    const emptyMeal: MealItem = {
        recipe_id: null, recipe_name: null,
        calories: 0, protein: 0, carbs: 0, fat: 0,
        status: "empty",
    };
    updateMealInPlan(planId, date, mealType, emptyMeal);
}
