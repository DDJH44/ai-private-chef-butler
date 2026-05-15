"use client";

import {useState, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import {MealPlan, MEAL_TYPES, WEEKDAYS, formatWeekRange, MealItem} from "@/types/mealPlan";
import {getOrCreateWeekPlan, removeMealFromPlan, updateMealInPlan, clearMealPlan, MEAL_PLAN_CHANGE_EVENT} from "@/lib/mealPlanStore";
import {generateShoppingListFromRecipes} from "@/lib/shoppingListGenerator";
import {showToast} from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import DatePicker from "@/components/DatePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import {generateMealPlan} from "@/lib/api";
import { getPreference } from "@/lib/api";
import {loadIngredients} from "@/lib/ingredientStore";

/* ---------- inline style tokens ---------- */
const fontHeading = "var(--font-noto-serif-sc), 'Noto Serif SC', serif";
const transition = "all 0.25s ease";

const s = {
    page: {
        display: "flex",
        flexDirection: "column" as const,
        height: "100%",
        background: "var(--bg)",
    },
    header: {
        flexShrink: 0,
        padding: "14px 16px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
    },
    headerInner: {
        position: "relative" as const,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: "1280px",
        margin: "0 auto",
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: "none",
        fontSize: 16,
        color: "var(--text)",
        transition,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: "var(--text)",
        letterSpacing: "-0.02em",
        fontFamily: fontHeading,
        margin: 0,
    },
    headerSub: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginTop: 2,
    },
    aiBtn: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: "var(--accent)",
        color: "#fff",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-raised-sm)",
        transition,
    },
    navBar: {
        flexShrink: 0,
        padding: "12px 16px 8px",
        maxWidth: "1280px",
        width: "100%",
        margin: "0 auto",
    },
    navCard: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
        borderRadius: 16,
        padding: "10px 12px",
    },
    navArrow: {
        padding: 6,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-xs)",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontSize: 16,
        color: "var(--text-secondary)",
        lineHeight: 1,
        transition,
    },
    navCenter: {
        textAlign: "center" as const,
    },
    navTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text)",
        fontFamily: fontHeading,
        margin: 0,
    },
    navSub: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginTop: 2,
    },
    content: {
        flex: 1,
        overflowY: "auto" as const,
        padding: "8px 16px 16px",
        maxWidth: "1280px",
        width: "100%",
        margin: "0 auto",
    },
    /* empty state */
    emptyWrap: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        paddingTop: 64,
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: "var(--text)",
        fontFamily: fontHeading,
        marginBottom: 4,
    },
    emptyDesc: {
        fontSize: 14,
        color: "var(--text-muted)",
        marginBottom: 16,
    },
    goldenBtn: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 24px",
        background: "var(--golden)",
        color: "#fff",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-raised)",
        transition,
    },
    /* table */
    tableWrap: {
        overflowX: "auto" as const,
    },
    table: {
        width: "100%",
        minWidth: 640,
        borderCollapse: "separate" as const,
        borderSpacing: "0 4px",
    },
    th: {
        padding: "8px 4px",
        textAlign: "center" as const,
    },
    thDate: {
        fontSize: 10,
        color: "var(--text-muted)",
    },
    thDay: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text)",
    },
    tdLabel: {
        padding: "4px 8px 4px 0",
        verticalAlign: "top" as const,
    },
    labelInner: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        paddingTop: 8,
    },
    labelIcon: {
        fontSize: 16,
    },
    labelText: {
        fontSize: 10,
        color: "var(--text-muted)",
        fontWeight: 500,
    },
    tdCell: {
        padding: "4px 2px",
    },
    mealCard: {
        position: "relative" as const,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 12,
        padding: 8,
        minHeight: 56,
        cursor: "pointer",
        transition,
    },
    mealName: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text)",
        lineHeight: 1.3,
        display: "-webkit-box" as const,
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
    },
    mealKcal: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginTop: 2,
    },
    removeBtn: {
        position: "absolute" as const,
        top: 4,
        right: 4,
        opacity: 0,
        padding: 2,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 10,
        color: "var(--rose)",
        borderRadius: 4,
        lineHeight: 1,
        transition,
    },
    emptyCell: {
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset)",
        borderRadius: 12,
        padding: 8,
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: 14,
        color: "var(--text-muted)",
        transition,
    },
    /* nutrition card */
    nutritionCard: {
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
    },
    nutritionHeader: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    nutritionIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
    },
    nutritionTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text)",
        fontFamily: fontHeading,
    },
    nutritionGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
    },
    nutritionItem: {
        textAlign: "center" as const,
    },
    nutritionValue: {
        fontSize: 16,
        fontWeight: 700,
    },
    nutritionUnit: {
        fontSize: 10,
        fontWeight: 400,
    },
    nutritionLabel: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginTop: 2,
    },
    shoppingBtn: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "14px",
        background: "var(--golden)",
        color: "#fff",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-raised)",
        marginTop: 12,
        transition,
    },
    /* modal overlay */
    overlay: {
        position: "fixed" as const,
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 0.2s ease",
    },
    modal: {
        width: "100%",
        maxWidth: 448,
        margin: "0 16px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-lg)",
        borderRadius: 20,
        padding: 24,
        animation: "scale-in 0.25s ease both",
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: "var(--text)",
        fontFamily: fontHeading,
        marginBottom: 16,
    },
    modalLabel: {
        display: "block",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-secondary)",
        marginBottom: 8,
    },
    radioCard: (active: boolean) => ({
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        background: "var(--bg)",
        boxShadow: active ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
        borderRadius: 12,
        cursor: "pointer",
        border: "none",
        width: "100%",
        textAlign: "left" as const,
        transition,
    }),
    radioDot: (active: boolean) => ({
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "var(--bg)",
        boxShadow: active ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    }),
    radioDotInner: {
        width: 8,
        height: 8,
        borderRadius: 999,
        background: "var(--accent)",
    },
    radioTitle: {
        fontSize: 14,
        fontWeight: 500,
        color: "var(--text)",
        margin: 0,
    },
    radioDesc: {
        fontSize: 12,
        color: "var(--text-muted)",
        margin: 0,
        marginTop: 2,
    },
    textarea: {
        width: "100%",
        padding: "10px 12px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        borderRadius: 12,
        border: "none",
        outline: "none",
        fontSize: 14,
        color: "var(--text)",
        resize: "none" as const,
        fontFamily: "inherit",
        transition,
    },
    genBtn: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 12,
        background: "var(--accent)",
        color: "#fff",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-raised-sm)",
        transition,
    },
    cancelBtn: {
        padding: "12px 24px",
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        transition,
    },
    spinner: {
        display: "inline-block",
        animation: "spin 1s linear infinite",
    },
};

/* ---------- injected keyframes (once) ---------- */
if (typeof document !== "undefined" && !document.getElementById("neumorph-keyframes")) {
    const style = document.createElement("style");
    style.id = "neumorph-keyframes";
    style.textContent = `
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
@keyframes spin { to { transform: rotate(360deg) } }
.meal-card-wrap:hover .meal-remove-btn { opacity: 1 !important; }
.meal-card-wrap:hover { box-shadow: var(--shadow-raised) !important; }
.empty-cell-wrap:hover { box-shadow: var(--shadow-raised-sm) !important; }
`;
    document.head.appendChild(style);
}

/* ---------- component ---------- */
export default function MealPlanPage() {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [plan, setPlan] = useState<MealPlan | null>(null);
    const [showGenerate, setShowGenerate] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [genRequirements, setGenRequirements] = useState("");
    const [genMode, setGenMode] = useState<"full" | "breakfast_only" | "lunch_only" | "dinner_only">("full");
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Edit meal modal state
    const [showEdit, setShowEdit] = useState(false);
    const [editingDate, setEditingDate] = useState("");
    const [editingMealType, setEditingMealType] = useState<"breakfast" | "lunch" | "dinner">("breakfast");
    const [editName, setEditName] = useState("");
    const [editIngredients, setEditIngredients] = useState("");
    const [editCalories, setEditCalories] = useState("");
    const [editProtein, setEditProtein] = useState("");
    const [editCarbs, setEditCarbs] = useState("");
    const [editFat, setEditFat] = useState("");

    const openEdit = useCallback((date: string, mealType: "breakfast" | "lunch" | "dinner") => {
        if (!plan) return;
        const day = plan.days.find(d => d.date === date);
        const meal = day?.meals[mealType];
        setEditingDate(date);
        setEditingMealType(mealType);
        if (meal && meal.status === "planned") {
            setEditName(meal.recipe_name || "");
            setEditIngredients((meal.ingredients || []).join("、"));
            setEditCalories(meal.calories ? String(meal.calories) : "");
            setEditProtein(meal.protein ? String(meal.protein) : "");
            setEditCarbs(meal.carbs ? String(meal.carbs) : "");
            setEditFat(meal.fat ? String(meal.fat) : "");
        } else {
            setEditName("");
            setEditIngredients("");
            setEditCalories("");
            setEditProtein("");
            setEditCarbs("");
            setEditFat("");
        }
        setShowEdit(true);
    }, [plan]);

    const handleSaveMeal = useCallback(() => {
        if (!plan || !editName.trim()) return;
        const meal: MealItem = {
            recipe_id: null,
            recipe_name: editName.trim(),
            ingredients: editIngredients.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
            calories: Number(editCalories) || 0,
            protein: Number(editProtein) || 0,
            carbs: Number(editCarbs) || 0,
            fat: Number(editFat) || 0,
            status: "planned",
        };
        updateMealInPlan(plan.id, editingDate, editingMealType, meal);
        setShowEdit(false);
    }, [plan, editName, editIngredients, editCalories, editProtein, editCarbs, editFat, editingDate, editingMealType]);

    const handleClearPlan = useCallback(() => {
        if (!plan) return;
        setShowClearConfirm(true);
    }, [plan]);

    const refreshPlan = useCallback(() => {
        const p = getOrCreateWeekPlan(currentDate);
        setPlan({...p});
    }, [currentDate]);

    useEffect(() => {
        refreshPlan();
    }, [refreshPlan]);

    useEffect(() => {
        const handler = () => refreshPlan();
        window.addEventListener(MEAL_PLAN_CHANGE_EVENT, handler);
        return () => window.removeEventListener(MEAL_PLAN_CHANGE_EVENT, handler);
    }, [refreshPlan]);

    const goWeek = useCallback((offset: number) => {
        setCurrentDate((d) => {
            const n = new Date(d);
            n.setDate(n.getDate() + offset * 7);
            return n;
        });
    }, []);

    const handleRemove = useCallback((date: string, mealType: "breakfast" | "lunch" | "dinner") => {
        if (!plan) return;
        removeMealFromPlan(plan.id, date, mealType);
    }, [plan]);

    const handleGenerate = useCallback(async () => {
        if (!plan) return;
        setGenerating(true);
        try {
            const inventory = loadIngredients().map(i => ({
                name: i.name, quantity: i.quantity, unit: i.unit, status: i.status,
            }));

            // Pass existing plan so AI can preserve user-edited meals
            const existingPlan = {
                days: plan.days.map(d => ({
                    date: d.date,
                    meals: {
                        breakfast: d.meals.breakfast.status === "planned" ? {
                            recipe_name: d.meals.breakfast.recipe_name,
                            calories: d.meals.breakfast.calories,
                            protein: d.meals.breakfast.protein,
                            carbs: d.meals.breakfast.carbs,
                            fat: d.meals.breakfast.fat,
                        } : null,
                        lunch: d.meals.lunch.status === "planned" ? {
                            recipe_name: d.meals.lunch.recipe_name,
                            calories: d.meals.lunch.calories,
                            protein: d.meals.lunch.protein,
                            carbs: d.meals.lunch.carbs,
                            fat: d.meals.lunch.fat,
                        } : null,
                        dinner: d.meals.dinner.status === "planned" ? {
                            recipe_name: d.meals.dinner.recipe_name,
                            calories: d.meals.dinner.calories,
                            protein: d.meals.dinner.protein,
                            carbs: d.meals.dinner.carbs,
                            fat: d.meals.dinner.fat,
                        } : null,
                    },
                })),
            };

            const result = await generateMealPlan({
                week_start: plan.week_start,
                week_end: plan.week_end,
                mode: genMode,
                requirements: genRequirements || undefined,
                preference: getPreference() as unknown as Record<string, unknown>,
                inventory,
                existing_plan: existingPlan,
            } as Parameters<typeof generateMealPlan>[0]);

            const data = result as { plan?: { days?: Array<{ date: string; meals: Record<string, { recipe_name: string; ingredients?: string[]; calories: number; protein: number; carbs: number; fat: number } | null> }> }; error?: string; raw?: string };
            if (data.error || !data.plan?.days) {
                showToast(data.error || "生成失败，请重试", "error");
                return;
            }

            for (const day of data.plan.days) {
                for (const mealType of MEAL_TYPES) {
                    const mealData = day.meals?.[mealType.key];
                    // null means "not generated" — skip to preserve existing
                    if (mealData === null || mealData === undefined) continue;
                    if (mealData?.recipe_name) {
                        const meal: MealItem = {
                            recipe_id: null,
                            recipe_name: mealData.recipe_name,
                            ingredients: mealData.ingredients || [],
                            calories: mealData.calories || 0,
                            protein: mealData.protein || 0,
                            carbs: mealData.carbs || 0,
                            fat: mealData.fat || 0,
                            status: "planned",
                        };
                        updateMealInPlan(plan.id, day.date, mealType.key, meal);
                    }
                }
            }
            refreshPlan();
            showToast("膳食计划已生成", "success");
            setShowGenerate(false);
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                showToast("生成超时，请尝试分餐生成（早餐/午餐/晚餐单独生成）或稍后重试", "error");
            } else {
                showToast("生成失败: " + (e instanceof Error ? e.message : "未知错误"), "error");
            }
        } finally {
            setGenerating(false);
        }
    }, [plan, genMode, genRequirements, refreshPlan]);

    const handleGenerateWeekShoppingList = useCallback(async () => {
        if (!plan) return;
        const recipesWithIngredients: { id: string; title: string; content: string; ingredients: string[]; createdAt: number; updatedAt: number }[] = [];
        for (const day of plan.days) {
            for (const mt of MEAL_TYPES) {
                const meal = day.meals[mt.key];
                if (meal.status === "planned" && meal.recipe_name && meal.ingredients && meal.ingredients.length > 0) {
                    recipesWithIngredients.push({
                        id: `meal_${day.date}_${mt.key}`,
                        title: meal.recipe_name,
                        content: "",
                        ingredients: meal.ingredients,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                }
            }
        }
        if (recipesWithIngredients.length === 0) {
            showToast("本周还没有安排带食材的菜品，请先生成膳食计划", "info");
            return;
        }
        await generateShoppingListFromRecipes(recipesWithIngredients);
        showToast(`已为本周 ${recipesWithIngredients.length} 道菜生成购物清单`, "success");
        router.push("/shopping-list");
    }, [plan, router]);

    if (!plan) return null;

    const weekRange = formatWeekRange(plan.week_start, plan.week_end);
    const hasAnyMeal = plan.days.some((d) =>
        MEAL_TYPES.some((m) => d.meals[m.key].status === "planned")
    );

    const nutritionColorMap: Record<string, string> = {
        "热量": "var(--accent)",
        "蛋白质": "var(--green)",
        "碳水": "var(--golden)",
        "脂肪": "var(--rose)",
    };

    return (
        <AuthGuard>
        <div style={s.page}>
            {/* ── header ── */}
            <header style={s.header}>
                <div style={{...s.headerInner, maxWidth: 1280, margin: "0 auto", padding: "0 0"}}>
                    <div style={{display: "flex", alignItems: "center", gap: 12}}>
                        <button
                            onClick={() => router.back()}
                            style={s.backBtn}
                            onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                            onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                        >
                            ←
                        </button>
                        <div>
                            <h1 style={s.headerTitle}>膳食计划</h1>
                            <p style={s.headerSub}>AI 规划你的每周三餐</p>
                        </div>
                    </div>
                    <div style={{display: "flex", gap: 8}}>
                        {hasAnyMeal && (
                            <button
                                onClick={handleClearPlan}
                                style={{
                                    ...s.aiBtn,
                                    background: "var(--bg)",
                                    color: "var(--rose)",
                                    boxShadow: "var(--shadow-raised-sm)",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                                onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                            >
                                清空计划
                            </button>
                        )}
                        <button
                            onClick={() => setShowGenerate(true)}
                            style={s.aiBtn}
                            onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                            onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                        >
                            ✨AI 生成
                        </button>
                    </div>
                </div>
            </header>

            {/* ── week navigation ── */}
            <div style={s.navBar}>
                <div style={s.navCard}>
                    <button
                        onClick={() => goWeek(-1)}
                        style={s.navArrow}
                        onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                        onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-xs)"; }}
                    >
                        ←
                    </button>
                    <button
                        onClick={() => setShowDatePicker(true)}
                        style={{
                            ...s.navCenter, background: "transparent", border: "none",
                            cursor: "pointer", fontFamily: "inherit", padding: "4px 12px",
                            borderRadius: 12, touchAction: "manipulation",
                        }}
                    >
                        <p style={s.navTitle}>{weekRange}</p>
                        <p style={s.navSub}>
                            第 {Math.ceil((new Date(plan.week_start).getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))} 周
                        </p>
                    </button>
                    <button
                        onClick={() => goWeek(1)}
                        style={s.navArrow}
                        onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                        onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-xs)"; }}
                    >
                        →
                    </button>
                </div>
            </div>

            {/* ── content ── */}
            <div style={s.content}>
                {!hasAnyMeal ? (
                    <div style={s.emptyWrap}>
                        <div style={s.emptyIcon}>📅</div>
                        <h3 style={s.emptyTitle}>还没有膳食计划</h3>
                        <p style={s.emptyDesc}>让AI帮你规划本周三餐</p>
                        <button
                            onClick={() => setShowGenerate(true)}
                            style={s.goldenBtn}
                            onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-lg)"; }}
                            onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                        >
                            ✨ AI 生成计划
                        </button>
                    </div>
                ) : (
                    <div>
                        {/* table */}
                        <div style={s.tableWrap}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        <th style={{...s.th, width: 56}}></th>
                                        {WEEKDAYS.map((day, i) => (
                                            <th key={day} style={s.th}>
                                                <div style={{textAlign: "center"}}>
                                                    <p style={s.thDate}>{plan.days[i]?.date.slice(5)}</p>
                                                    <p style={s.thDay}>{day}</p>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MEAL_TYPES.map((mealType) => (
                                        <tr key={mealType.key}>
                                            <td style={s.tdLabel}>
                                                <div style={s.labelInner}>
                                                    <span style={s.labelIcon}>{mealType.icon}</span>
                                                    <span style={s.labelText}>{mealType.label}</span>
                                                </div>
                                            </td>
                                            {plan.days.map((day) => {
                                                const meal = day.meals[mealType.key];
                                                const isPlanned = meal.status === "planned";
                                                return (
                                                    <td key={day.date} style={s.tdCell}>
                                                        {isPlanned ? (
                                                            <div
                                                                className="meal-card-wrap"
                                                                style={s.mealCard}
                                                                onClick={() => openEdit(day.date, mealType.key)}
                                                            >
                                                                <p style={s.mealName}>
                                                                    {meal.recipe_name}
                                                                </p>
                                                                <p style={s.mealKcal}>{meal.calories}kcal</p>
                                                                <button
                                                                    className="meal-remove-btn"
                                                                    style={s.removeBtn}
                                                                    onClick={(e) => { e.stopPropagation(); handleRemove(day.date, mealType.key); }}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="empty-cell-wrap"
                                                                style={s.emptyCell}
                                                                onClick={() => openEdit(day.date, mealType.key)}
                                                            >
                                                                ＋
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* nutrition summary */}
                        <div style={s.nutritionCard}>
                            <div style={s.nutritionHeader}>
                                <div style={s.nutritionIcon}>📊</div>
                                <span style={s.nutritionTitle}>本周营养概览</span>
                            </div>
                            <div style={s.nutritionGrid}>
                                {[
                                    {label: "热量", value: plan.weekly_total.calories, unit: "kcal"},
                                    {label: "蛋白质", value: plan.weekly_total.protein, unit: "g"},
                                    {label: "碳水", value: plan.weekly_total.carbs, unit: "g"},
                                    {label: "脂肪", value: plan.weekly_total.fat, unit: "g"},
                                ].map((n) => (
                                    <div key={n.label} style={s.nutritionItem}>
                                        <p style={{...s.nutritionValue, color: nutritionColorMap[n.label] || "var(--text)"}}>
                                            {n.value}<span style={s.nutritionUnit}>{n.unit}</span>
                                        </p>
                                        <p style={s.nutritionLabel}>{n.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* shopping list button */}
                        <button
                            onClick={handleGenerateWeekShoppingList}
                            style={s.shoppingBtn}
                            onMouseEnter={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-lg)"; }}
                            onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                        >
                            🛒 生成本周购物清单
                        </button>
                    </div>
                )}
            </div>

            {/* ── AI generate modal ── */}
            {showGenerate && (
                <div
                    style={s.overlay}
                    onClick={() => !generating && setShowGenerate(false)}
                >
                    <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={s.modalTitle}>AI 生成本周膳食计划</h3>

                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            {/* mode selection */}
                            <div>
                                <label style={s.modalLabel}>生成模式</label>
                                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                    {([
                                        { value: "full", title: "完整规划", desc: "三餐全部安排" },
                                        { value: "breakfast_only", title: "仅规划早餐", desc: "午晚餐自行安排" },
                                        { value: "lunch_only", title: "仅规划午餐", desc: "早晚餐自行安排" },
                                        { value: "dinner_only", title: "仅规划晚餐", desc: "早午餐自行安排" },
                                    ] as const).map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            style={s.radioCard(genMode === opt.value)}
                                            onClick={() => setGenMode(opt.value)}
                                        >
                                            <div style={s.radioDot(genMode === opt.value)}>
                                                {genMode === opt.value && <div style={s.radioDotInner}/>}
                                            </div>
                                            <div>
                                                <p style={s.radioTitle}>{opt.title}</p>
                                                <p style={s.radioDesc}>{opt.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* requirements */}
                            <div>
                                <label style={s.modalLabel}>特殊要求（可选）</label>
                                <textarea
                                    value={genRequirements}
                                    onChange={(e) => setGenRequirements(e.target.value)}
                                    placeholder='如"这周想多吃素""周末做点复杂的"'
                                    rows={2}
                                    disabled={generating}
                                    style={{
                                        ...s.textarea,
                                        opacity: generating ? 0.5 : 1,
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                    onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                />
                            </div>
                        </div>

                        <div style={{display: "flex", gap: 12, marginTop: 20}}>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                style={{
                                    ...s.genBtn,
                                    opacity: generating ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => { if (!generating) (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised)"; }}
                                onMouseLeave={(e) => { (e.currentTarget.style.boxShadow as any) = "var(--shadow-raised-sm)"; }}
                            >
                                {generating ? (
                                    <>
                                        <span style={s.spinner}>⏳</span> 生成中...
                                    </>
                                ) : (
                                    <>✨ 开始生成</>
                                )}
                            </button>
                            <button
                                onClick={() => setShowGenerate(false)}
                                disabled={generating}
                                style={{
                                    ...s.cancelBtn,
                                    opacity: generating ? 0.4 : 1,
                                }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
            {/* ── Edit meal modal ── */}
            {showEdit && (
                <div
                    style={s.overlay}
                    onClick={() => setShowEdit(false)}
                >
                    <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={s.modalTitle}>
                            编辑 {MEAL_TYPES.find(m => m.key === editingMealType)?.icon} {MEAL_TYPES.find(m => m.key === editingMealType)?.label} · {editingDate}
                        </h3>

                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            <div>
                                <label style={s.modalLabel}>菜品名 *</label>
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="如：番茄炒蛋"
                                    style={{
                                        ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                    onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveMeal()}
                                />
                            </div>
                            <div>
                                <label style={s.modalLabel}>食材（用、或逗号分隔）</label>
                                <input
                                    value={editIngredients}
                                    onChange={(e) => setEditIngredients(e.target.value)}
                                    placeholder="如：番茄、鸡蛋、葱"
                                    style={{
                                        ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                    onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                />
                            </div>
                            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12}}>
                                <div>
                                    <label style={s.modalLabel}>热量 (kcal)</label>
                                    <input
                                        type="number"
                                        value={editCalories}
                                        onChange={(e) => setEditCalories(e.target.value)}
                                        placeholder="500"
                                        style={{
                                            ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                                <div>
                                    <label style={s.modalLabel}>蛋白质 (g)</label>
                                    <input
                                        type="number"
                                        value={editProtein}
                                        onChange={(e) => setEditProtein(e.target.value)}
                                        placeholder="25"
                                        style={{
                                            ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                                <div>
                                    <label style={s.modalLabel}>碳水 (g)</label>
                                    <input
                                        type="number"
                                        value={editCarbs}
                                        onChange={(e) => setEditCarbs(e.target.value)}
                                        placeholder="60"
                                        style={{
                                            ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                                <div>
                                    <label style={s.modalLabel}>脂肪 (g)</label>
                                    <input
                                        type="number"
                                        value={editFat}
                                        onChange={(e) => setEditFat(e.target.value)}
                                        placeholder="15"
                                        style={{
                                            ...s.textarea, width: "100%", boxSizing: "border-box" as const,
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{display: "flex", gap: 12, marginTop: 20}}>
                            <button
                                onClick={handleSaveMeal}
                                disabled={!editName.trim()}
                                style={{
                                    ...s.genBtn,
                                    opacity: editName.trim() ? 1 : 0.5,
                                }}
                            >
                                保存
                            </button>
                            <button
                                onClick={() => setShowEdit(false)}
                                style={s.cancelBtn}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDatePicker && (
                <DatePicker
                    value={currentDate}
                    onChange={(date) => { setCurrentDate(date); setShowDatePicker(false); }}
                    onClose={() => setShowDatePicker(false)}
                />
            )}
            {showClearConfirm && (
                <ConfirmDialog
                    isOpen={showClearConfirm}
                    title="清空膳食计划"
                    message="确定要清空本周所有膳食计划吗？此操作不可撤销。"
                    onCancel={() => setShowClearConfirm(false)}
                    onConfirm={() => {
                        if (plan) { clearMealPlan(plan.id); showToast("本周计划已清空", "info"); }
                        setShowClearConfirm(false);
                    }}
                />
            )}

        </AuthGuard>
    );
}
