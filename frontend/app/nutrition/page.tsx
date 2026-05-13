"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import { useFeishuStatus } from "@/hooks/useFeishuStatus";
import { getToken } from "@/lib/authStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

interface NutritionRecord {
  id: string;
  date: string;
  meal_type: string;
  food_name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
  image_url?: string;
  notes?: string;
  created_at: number;
}

interface DailySummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  total_sodium: number;
  meals: NutritionRecord[];
  analysis: string;
}

interface FoodItem {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  estimated_weight?: string;
}

interface PhotoAnalysisResult {
  meal_type: string;
  foods: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  summary: string;
}

interface HealthEval {
  date: string;
  score: number;
  health_eval: string;
}

const MEAL_TYPES = ["早餐", "午餐", "晚餐", "加餐"];
const MEAL_ICONS: Record<string, string> = { "早餐": "🌅", "午餐": "☀️", "晚餐": "🌙", "加餐": "🍎" };

const COMMON_FOODS: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {
  "米饭(100g)": { calories: 116, protein: 2.6, carbs: 25.6, fat: 0.3 },
  "面条(100g)": { calories: 137, protein: 4.5, carbs: 28, fat: 0.8 },
  "馒头(个)": { calories: 221, protein: 7, carbs: 45, fat: 1.1 },
  "鸡蛋(个)": { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  "牛奶(250ml)": { calories: 160, protein: 8, carbs: 12, fat: 8 },
  "苹果(个)": { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  "香蕉(根)": { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  "鸡胸肉(100g)": { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  "猪肉(100g)": { calories: 242, protein: 27, carbs: 0, fat: 14 },
  "牛肉(100g)": { calories: 250, protein: 26, carbs: 0, fat: 15 },
  "鱼(100g)": { calories: 206, protein: 22, carbs: 0, fat: 12 },
  "豆腐(100g)": { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  "青菜(100g)": { calories: 15, protein: 1.5, carbs: 2.1, fat: 0.2 },
  "番茄(个)": { calories: 22, protein: 1.1, carbs: 4.8, fat: 0.2 },
};

export default function NutritionPage() {
  const router = useRouter();
  const { configured: feishuConfigured } = useFeishuStatus();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    meal_type: "早餐",
    food_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    notes: "",
  });

  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [healthEval, setHealthEval] = useState<HealthEval | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/nutrition/summary/${selectedDate}`, { headers: authHeaders() });
      if (resp.ok) setSummary(await resp.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleFoodSelect = (food: string) => {
    const info = COMMON_FOODS[food];
    if (info) {
      setForm((prev) => ({
        ...prev,
        food_name: food,
        calories: String(info.calories),
        protein: String(info.protein),
        carbs: String(info.carbs),
        fat: String(info.fat),
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.food_name.trim()) {
      showToast("请输入食物名称", "error");
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/v1/nutrition/records`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: selectedDate,
          meal_type: form.meal_type,
          food_name: form.food_name,
          calories: form.calories ? parseFloat(form.calories) : null,
          protein: form.protein ? parseFloat(form.protein) : null,
          carbs: form.carbs ? parseFloat(form.carbs) : null,
          fat: form.fat ? parseFloat(form.fat) : null,
          notes: form.notes || null,
        }),
      });
      if (resp.ok) {
        showToast("记录已添加", "success");
        setShowForm(false);
        setForm({ meal_type: "早餐", food_name: "", calories: "", protein: "", carbs: "", fat: "", notes: "" });
        fetchSummary();
      }
    } catch (e) { showToast("添加失败", "error"); }
  };

  const handleDelete = async (id: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/v1/nutrition/records/${id}`, { method: "DELETE", headers: authHeaders() });
      if (resp.ok) { showToast("已删除", "success"); fetchSummary(); }
      else { showToast("删除失败", "error"); }
    } catch (e) { showToast("删除失败", "error"); }
  };

  const handleShareToFeishu = async () => {
    if (!summary) return;
    try {
      const payload = { ...summary };
      if (healthEval && healthEval.score > 0) {
        (payload as Record<string, unknown>).health_score = healthEval.score;
        (payload as Record<string, unknown>).health_eval = healthEval.health_eval;
      }
      const resp = await fetch(`${API_BASE}/api/v1/feishu/daily-report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (resp.ok) showToast("已推送到飞书", "success");
      else showToast(data.detail || "推送失败", "error");
    } catch (e) { showToast("推送失败", "error"); }
  };

  const handlePhotoUpload = async (mealType: string, file: File) => {
    setAnalyzing(mealType);
    setAnalysisResult(null);
    setShowAnalysis(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("meal_type", mealType);
      formData.append("date", selectedDate);

      const token = getToken();
      const resp = await fetch(`${API_BASE}/api/v1/nutrition/analyze-photo`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (resp.ok) {
        const result: PhotoAnalysisResult = await resp.json();
        setAnalysisResult(result);
        showToast(`${mealType}分析完成`, "success");
        fetchSummary();
      } else {
        const err = await resp.json();
        showToast(err.detail || "分析失败", "error");
      }
    } catch (e) {
      showToast("网络错误，分析失败", "error");
    }
    setAnalyzing(null);
  };

  const handleHealthEval = async () => {
    setEvaluating(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/nutrition/health-eval/${selectedDate}`, { headers: authHeaders() });
      if (resp.ok) {
        const result: HealthEval = await resp.json();
        setHealthEval(result);
      } else {
        showToast("评估失败", "error");
      }
    } catch (e) {
      showToast("网络错误", "error");
    }
    setEvaluating(false);
  };

  const navigateDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
    setHealthEval(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--green)";
    if (score >= 60) return "var(--golden)";
    return "var(--rose)";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "优秀";
    if (score >= 80) return "良好";
    if (score >= 60) return "一般";
    return "需改善";
  };

  return (
    <AuthGuard>
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="flex-shrink-0 px-6 sm:px-8 lg:px-12 xl:px-20 py-4" style={{ background: "var(--bg)" }}>
        <div className="relative flex items-center justify-between max-w-5xl sm:max-w-6xl md:max-w-7xl lg:max-w-[1200px] mx-auto">
          <div className="flex items-center gap-5">
            <button onClick={() => router.back()}
              style={{
                width: 42, height: 42, background: "var(--bg)", borderRadius: 14,
                boxShadow: "var(--shadow-raised-sm)", display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer", transition: "all 0.25s ease",
              }}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            >
              <span style={{ fontSize: 18 }}>←</span>
            </button>
            <div>
              <h1 style={{
                fontSize: 18, fontWeight: 700, color: "var(--text)",
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif", letterSpacing: "-0.02em",
              }}>
                📊 饮食记录
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                拍照识别 · 营养追踪 · 健康评估
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "var(--accent)", color: "#fff", borderRadius: 14,
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
          >
            <span style={{ fontSize: 16 }}>＋</span> 手动添加
          </button>
        </div>
      </header>

      {/* Date Navigator */}
      <div className="flex-shrink-0 px-6 sm:px-8 lg:px-12 xl:px-20 py-3 max-w-5xl sm:max-w-6xl md:max-w-7xl lg:max-w-[1200px] mx-auto">
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => navigateDate(-1)}
            style={{
              width: 44, height: 44, background: "var(--bg)", borderRadius: 14,
              boxShadow: "var(--shadow-raised-sm)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "var(--text-secondary)", transition: "all 0.25s ease",
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
          >◀</button>
          <div style={{
            padding: "10px 36px", background: "var(--bg)", borderRadius: 14,
            boxShadow: "var(--shadow-raised-sm)", fontSize: 15, fontWeight: 600, color: "var(--text)",
          }}>
            {formatDate(selectedDate)}
          </div>
          <button onClick={() => navigateDate(1)}
            style={{
              width: 44, height: 44, background: "var(--bg)", borderRadius: 14,
              boxShadow: "var(--shadow-raised-sm)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "var(--text-secondary)", transition: "all 0.25s ease",
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
          >▶</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-12 xl:px-20 py-4 max-w-5xl sm:max-w-6xl md:max-w-7xl lg:max-w-[1200px] mx-auto">
        {loading ? (
          <div className="empty-state pt-16">
            <div style={{ fontSize: 16, color: "var(--text-muted)" }}>加载中...</div>
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {/* Photo Upload Section — always visible */}
            <div>
              <h3 style={{
                fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 16,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}>📸 拍照识别</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {MEAL_TYPES.map((mt) => (
                  <div key={mt} style={{ position: "relative" }}>
                    <input
                      type="file"
                      accept="image/*"
                      ref={el => { fileInputRefs.current[mt] = el; }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(mt, file);
                        e.target.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[mt]?.click()}
                      disabled={analyzing !== null}
                      style={{
                        width: "100%", padding: "20px 12px", background: "var(--bg)", borderRadius: 16,
                        border: "none", cursor: analyzing ? "not-allowed" : "pointer",
                        boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                        opacity: analyzing && analyzing !== mt ? 0.5 : 1,
                      }}
                      onMouseDown={e => { if (!analyzing) (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                      onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                    >
                      <span style={{ fontSize: 28 }}>
                        {analyzing === mt ? "⏳" : MEAL_ICONS[mt]}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{mt}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {analyzing === mt ? "AI分析中..." : "点击拍照/上传"}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Result */}
            {showAnalysis && analysisResult && (
              <div className="card-base" style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{
                    fontSize: 16, fontWeight: 700, color: "var(--accent)",
                    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                  }}>
                    {MEAL_ICONS[analysisResult.meal_type]} {analysisResult.meal_type}分析结果
                  </h3>
                  <button onClick={() => setShowAnalysis(false)}
                    style={{
                      width: 28, height: 28, background: "var(--bg)", borderRadius: 8,
                      boxShadow: "var(--shadow-raised-xs)", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: "var(--text-muted)",
                    }}
                  >✕</button>
                </div>
                <div className="space-y-3">
                  {analysisResult.foods.map((food, idx) => (
                    <div key={idx} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: "var(--bg)", borderRadius: 12,
                      boxShadow: "var(--shadow-inset-sm)",
                    }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{food.food_name}</span>
                        {food.estimated_weight && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{food.estimated_weight}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                        <span>🔥{food.calories}kcal</span>
                        <span>🥩{food.protein}g</span>
                        <span>🍚{food.carbs}g</span>
                        <span>🧈{food.fat}g</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 16, padding: "12px 16px", background: "var(--bg)",
                  borderRadius: 12, boxShadow: "var(--shadow-inset-sm)",
                  fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  💡 {analysisResult.summary}
                </div>
              </div>
            )}

            {summary && (
            <>
            {/* Stats Card */}
            <div className="card-base" style={{ padding: 28 }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 20,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}>今日摄入</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--golden)" }} className="sm:text-[36px]">
                    {summary.total_calories.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>千卡</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }} className="sm:text-[36px]">
                    {summary.total_protein.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>蛋白质</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }} className="sm:text-[36px]">
                    {summary.total_carbs.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>碳水</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--rose)" }} className="sm:text-[36px]">
                    {summary.total_fat.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>脂肪</div>
                </div>
              </div>
              {summary.analysis && (
                <div style={{
                  marginTop: 24, padding: 20, background: "var(--bg)",
                  borderRadius: 14, boxShadow: "var(--shadow-inset-sm)",
                  whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7,
                }}>
                  {summary.analysis}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button onClick={handleHealthEval}
                  disabled={evaluating || summary.meals.length === 0}
                  style={{
                    flex: 1, padding: "14px 0",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "var(--accent)", color: "#fff", borderRadius: 14,
                    fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
                    boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
                    opacity: evaluating || summary.meals.length === 0 ? 0.6 : 1,
                  }}
                >
                  {evaluating ? "⏳ AI评估中..." : "🏥 健康评估"}
                </button>
                {feishuConfigured ? (
                <button onClick={handleShareToFeishu}
                  style={{
                    flex: 1, padding: "14px 0",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "var(--bg)", color: "#00d6b9", borderRadius: 14,
                    fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
                    boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                  }}
                  onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                  onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                >
                  🪽 推送飞书
                </button>
                ) : (
                <button onClick={() => router.push("/profile")}
                  style={{
                    flex: 1, padding: "14px 0",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "var(--bg)", color: "var(--text-muted)", borderRadius: 14,
                    fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
                    boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                    opacity: 0.6,
                  }}
                >
                  🪽 连接飞书
                </button>
                )}
              </div>
            </div>

            {/* Health Evaluation */}
            {healthEval && healthEval.score > 0 && (
              <div className="card-base" style={{ padding: 28 }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 20,
                  fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                }}>🏥 健康评估</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(healthEval.score) }}>
                      {healthEval.score}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{getScoreLabel(healthEval.score)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 8, background: "var(--bg)", borderRadius: 4, boxShadow: "var(--shadow-inset-sm)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${healthEval.score}%`,
                        background: getScoreColor(healthEval.score),
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: 20, background: "var(--bg)",
                  borderRadius: 14, boxShadow: "var(--shadow-inset-sm)",
                  whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8,
                }}>
                  {healthEval.health_eval}
                </div>
              </div>
            )}

            {/* Meals List */}
            <div>
              <h3 style={{
                fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 16,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}>📝 饮食记录</h3>
              {summary.meals.length === 0 ? (
                <div className="empty-state" style={{ padding: "4rem 2rem" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
                  <p style={{ fontSize: 16, color: "var(--text-muted)" }}>今日暂无记录</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>拍照或手动添加开始记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const grouped: Record<string, NutritionRecord[]> = {};
                    for (const m of summary.meals) {
                      grouped[m.meal_type] = grouped[m.meal_type] || [];
                      grouped[m.meal_type].push(m);
                    }
                    const order = ["早餐", "午餐", "晚餐", "加餐"];
                    return order.filter(mt => grouped[mt]).map(mt => {
                      const items = grouped[mt];
                      const totalCal = items.reduce((s, i) => s + (i.calories || 0), 0);
                      const totalP = items.reduce((s, i) => s + (i.protein || 0), 0);
                      const totalC = items.reduce((s, i) => s + (i.carbs || 0), 0);
                      const totalF = items.reduce((s, i) => s + (i.fat || 0), 0);
                      return (
                        <div key={mt} className="card-base" style={{ padding: 24 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{
                                width: 48, height: 48, background: "var(--bg)",
                                borderRadius: 14, boxShadow: "var(--shadow-inset-sm)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                              }}>
                                {MEAL_ICONS[mt] || "🍽️"}
                              </div>
                              <div>
                                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{mt}</span>
                                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 12 }}>
                                  {items.length}种食物 · 🔥{totalCal.toFixed(0)}kcal
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                              <span>🥩{totalP.toFixed(0)}g</span>
                              <span>🍚{totalC.toFixed(0)}g</span>
                              <span>🧈{totalF.toFixed(0)}g</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {items.map((meal) => (
                              <div key={meal.id} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 14px", background: "var(--bg)", borderRadius: 12,
                                boxShadow: "var(--shadow-inset-sm)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {meal.food_name}
                                  </span>
                                  {meal.notes && (
                                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{meal.notes}</span>
                                  )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                  {meal.calories ? (
                                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>🔥{meal.calories}kcal</span>
                                  ) : null}
                                  <button onClick={() => handleDelete(meal.id)}
                                    style={{
                                      width: 28, height: 28, background: "var(--bg)", borderRadius: 8,
                                      boxShadow: "var(--shadow-raised-xs)", border: "none", cursor: "pointer",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 12, color: "var(--text-muted)", transition: "all 0.25s ease",
                                    }}
                                    onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            </>)}
            {!summary && (
              <div className="empty-state" style={{ padding: "4rem 2rem" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
                <p style={{ fontSize: 16, color: "var(--text-muted)" }}>今日暂无记录</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>点击上方拍照或"手动添加"开始记录</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease",
        }} onClick={() => setShowForm(false)}>
          <div style={{
            width: "100%", maxWidth: 600, background: "var(--bg)",
            borderRadius: 28, boxShadow: "var(--shadow-raised-lg)", overflow: "hidden",
            animation: "scaleIn 0.25s ease both",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <h3 style={{
                fontSize: 18, fontWeight: 700, color: "var(--text)",
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}>➕ 手动添加</h3>
              <button onClick={() => setShowForm(false)}
                style={{
                  width: 36, height: 36, background: "var(--bg)", borderRadius: 12,
                  boxShadow: "var(--shadow-raised-xs)", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: "var(--text-muted)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
              >✕</button>
            </div>

            <div style={{ padding: "24px 28px", maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>餐次</label>
                <div className="flex gap-4">
                  {MEAL_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, meal_type: t }))}
                      style={{
                        flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 600,
                        border: "none", cursor: "pointer", transition: "all 0.25s ease",
                        background: "var(--bg)",
                        color: form.meal_type === t ? "var(--accent)" : "var(--text-secondary)",
                        boxShadow: form.meal_type === t ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
                      }}
                    >{MEAL_ICONS[t]} {t}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>快速选择</label>
                <div className="flex flex-wrap gap-3">
                  {Object.keys(COMMON_FOODS).map((food) => (
                    <button key={food} type="button" onClick={() => handleFoodSelect(food)}
                      style={{
                        padding: "10px 16px", background: "var(--bg)", color: "var(--accent)",
                        borderRadius: 12, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                        boxShadow: "var(--shadow-raised-xs)", transition: "all 0.25s ease",
                      }}
                      onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                      onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                    >{food}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>食物名称 *</label>
                <input value={form.food_name} onChange={(e) => setForm((p) => ({ ...p, food_name: e.target.value }))}
                  placeholder="如：米饭、鸡蛋..."
                  style={{
                    width: "100%", padding: "14px 18px", background: "var(--bg)", border: "none",
                    borderRadius: 14, boxShadow: "var(--shadow-inset-sm)", fontSize: 15, color: "var(--text)",
                    outline: "none", transition: "all 0.25s ease", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                {[
                  { key: "calories", label: "热量", unit: "kcal" },
                  { key: "protein", label: "蛋白质", unit: "g" },
                  { key: "carbs", label: "碳水", unit: "g" },
                  { key: "fat", label: "脂肪", unit: "g" },
                ].map(({ key, label, unit }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>{label}</label>
                    <input type="number" value={(form as Record<string, string>)[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={unit}
                      style={{
                        width: "100%", padding: "14px 18px", background: "var(--bg)", border: "none",
                        borderRadius: 14, boxShadow: "var(--shadow-inset-sm)", fontSize: 15, color: "var(--text)",
                        outline: "none", transition: "all 0.25s ease", boxSizing: "border-box",
                      }}
                      onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "24px 28px", display: "flex", gap: 18 }}>
              <button onClick={() => setShowForm(false)}
                style={{
                  flex: 1, padding: "14px 0", background: "var(--bg)", color: "var(--text-secondary)",
                  borderRadius: 14, fontSize: 16, fontWeight: 600, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              >取消</button>
              <button onClick={handleSubmit}
                style={{
                  flex: 1, padding: "14px 0", background: "var(--accent)", color: "#fff",
                  borderRadius: 14, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
