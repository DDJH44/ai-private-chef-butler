import {MealPlan, MealPlanStore, MealItem, createEmptyMealPlan, getWeekRange} from '@/types/mealPlan';
import { apiPath, authFetch, authJsonHeaders } from './http';
import { getToken } from './authStore';

const STORAGE_KEY = 'ai_chef_meal_plans';
const PLANS_API = apiPath('/v1/meal-plan/plans');

export const MEAL_PLAN_CHANGE_EVENT = 'mealPlanChange';

function notifyChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MEAL_PLAN_CHANGE_EVENT));
    }
}

// ==================== 后端同步 ====================

let _synced = false;

async function syncFromRemote(): Promise<MealPlan[]> {
    if (!getToken()) return [];
    try {
        const resp = await authFetch(PLANS_API, { headers: authJsonHeaders() });
        if (!resp.ok) return [];
        const data = await resp.json();
        const remotePlans: MealPlan[] = (data.items || []).map((r: { plan_data: unknown }) => r.plan_data as MealPlan);
        if (remotePlans.length > 0) {
            const store: MealPlanStore = { meal_plans: remotePlans, lastUpdated: Date.now() };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        }
        _synced = true;
        return remotePlans;
    } catch { return []; }
}

async function pushPlanToRemote(plan: MealPlan): Promise<void> {
    if (!getToken()) return;
    try {
        await authFetch(`${PLANS_API}/${encodeURIComponent(plan.id)}`, {
            method: 'PUT',
            headers: authJsonHeaders(),
            body: JSON.stringify({
                id: plan.id,
                week_start: plan.week_start,
                week_end: plan.week_end,
                plan_data: plan,
                status: plan.status,
            }),
        });
    } catch (e) {
        console.warn('膳食计划同步到远程失败:', e);
    }
}

async function deletePlanFromRemote(planId: string): Promise<void> {
    if (!getToken()) return;
    try {
        await authFetch(`${PLANS_API}/${encodeURIComponent(planId)}`, {
            method: 'DELETE',
            headers: authJsonHeaders(),
        });
    } catch (e) {
        console.warn('删除远程膳食计划失败:', e);
    }
}

// ==================== 本地存储（带远程同步） ====================

export function loadMealPlans(): MealPlan[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const localPlans: MealPlan[] = stored ? (JSON.parse(stored) as MealPlanStore).meal_plans || [] : [];

        // 首次加载时异步从远程同步
        if (!_synced && getToken()) {
            syncFromRemote().then(remotePlans => {
                if (remotePlans.length > 0) notifyChange();
            });
        }
        return localPlans;
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
    pushPlanToRemote(newPlan);
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
    pushPlanToRemote(plan);
}

export function removeMealFromPlan(planId: string, date: string, mealType: "breakfast" | "lunch" | "dinner"): void {
    const emptyMeal: MealItem = {
        recipe_id: null, recipe_name: null,
        calories: 0, protein: 0, carbs: 0, fat: 0,
        status: "empty",
    };
    updateMealInPlan(planId, date, mealType, emptyMeal);
}

export function clearMealPlan(planId: string): void {
    const plans = loadMealPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    for (const day of plan.days) {
        day.meals.breakfast = { recipe_id: null, recipe_name: null, ingredients: [], calories: 0, protein: 0, carbs: 0, fat: 0, status: "empty" };
        day.meals.lunch = { recipe_id: null, recipe_name: null, ingredients: [], calories: 0, protein: 0, carbs: 0, fat: 0, status: "empty" };
        day.meals.dinner = { recipe_id: null, recipe_name: null, ingredients: [], calories: 0, protein: 0, carbs: 0, fat: 0, status: "empty" };
        day.daily_total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    plan.weekly_total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    saveMealPlans(plans);
    pushPlanToRemote(plan);
    notifyChange();
}

export function deleteMealPlan(planId: string): void {
    const plans = loadMealPlans();
    const filtered = plans.filter((p) => p.id !== planId);
    saveMealPlans(filtered);
    deletePlanFromRemote(planId);
    notifyChange();
}
