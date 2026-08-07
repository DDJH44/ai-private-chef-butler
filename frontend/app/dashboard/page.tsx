"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authFetch, authHeaders } from "@/lib/http";
import { proxyImageUrl } from "@/lib/imageUtils";
import { PageHeader } from "@/components/PageHeader";
import { showToast } from "@/components/Toast";
import {
  BookOpen, ChefHat, Flame, ShoppingCart, Snowflake, Calendar,
  Star, TrendingUp, RefreshCw, AlertTriangle, ArrowRight, Clock,
} from "lucide-react";

interface DashboardData {
  stats: {
    recipe_count: number;
    cook_count: number;
    today_calories: number;
    today_protein: number;
    today_carbs: number;
    today_fat: number;
    pending_shopping: number;
    ingredient_count: number;
    expiring_ingredients: number;
    expired_ingredients: number;
    meal_plan_count: number;
    avg_rating: number;
    has_preference: boolean;
  };
  calories_trend: { date: string; calories: number }[];
  cook_trend: { date: string; count: number }[];
  nutrition_breakdown: { protein: number; carbs: number; fat: number };
  recent_recipes: {
    id: string; title: string; image_url: string | null;
    difficulty: string | null; score: number | null; created_at: number;
  }[];
  recent_cooks: {
    recipe_id: string; recipe_name: string;
    cook_date: string; rating: number;
  }[];
  recent_shopping: {
    id: string; status: string;
    source_recipe_names: string[]; item_count: number; created_at: number;
  }[];
  ingredient_categories: { category: string; count: number }[];
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function weekdayOf(dateStr: string): string {
  const d = new Date(dateStr);
  return WEEKDAY_LABELS[d.getDay()];
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await authFetch("/api/v1/dashboard/summary", { headers: authHeaders() });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "加载失败");
      }
      const json = await resp.json();
      setData(json);
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 柱状图（纯 SVG）──
  const maxCal = data ? Math.max(...data.calories_trend.map(d => d.calories), 1) : 1;
  const maxCook = data ? Math.max(...data.cook_trend.map(d => d.count), 1) : 1;

  // 营养素总量（用于百分比）
  const nutriTotal = data
    ? data.nutrition_breakdown.protein + data.nutrition_breakdown.carbs + data.nutrition_breakdown.fat
    : 0;

  const cardStyle: React.CSSProperties = {
    background: "var(--surface)", borderRadius: "var(--radius)",
    padding: 16, boxShadow: "var(--shadow-raised)",
    display: "flex", flexDirection: "column", gap: 8,
    transition: "var(--transition)", cursor: "pointer",
  };

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)", borderRadius: "var(--radius-lg)",
    padding: 20, boxShadow: "var(--shadow-raised)",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15, fontWeight: 700, color: "var(--text)",
    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
    marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
        <PageHeader title="数据概览" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div className="typing-dot" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
        <PageHeader title="数据概览" />
        <div className="empty-state" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>暂无数据</p>
        </div>
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
      <PageHeader
        title="数据概览"
        subtitle="你的私厨数据一览"
        rightAction={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
              color: "var(--text-secondary)", transition: "var(--transition)",
            }}
            className="hover-accent"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>
        }
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── 统计卡片网格 ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}>
          <StatCard
            icon={<BookOpen size={20} />} label="菜谱总数" value={s.recipe_count}
            color="var(--accent)" bg="var(--accent-bg)"
            onClick={() => router.push("/recipes")}
          />
          <StatCard
            icon={<ChefHat size={20} />} label="烹饪次数" value={s.cook_count}
            subValue={s.avg_rating > 0 ? `均分 ${s.avg_rating}` : undefined}
            color="var(--green)" bg="var(--green-bg)"
            onClick={() => router.push("/history")}
          />
          <StatCard
            icon={<Flame size={20} />} label="今日热量" value={s.today_calories.toFixed(0)}
            subValue="kcal" color="var(--golden)" bg="var(--golden-bg)"
            onClick={() => router.push("/nutrition")}
          />
          <StatCard
            icon={<ShoppingCart size={20} />} label="待办清单" value={s.pending_shopping}
            color="var(--teal)" bg="var(--teal-bg)"
            onClick={() => router.push("/shopping-list")}
          />
          <StatCard
            icon={<Snowflake size={20} />} label="冰箱食材" value={s.ingredient_count}
            subValue={
              s.expired_ingredients > 0
                ? `${s.expired_ingredients} 过期`
                : s.expiring_ingredients > 0
                ? `${s.expiring_ingredients} 将过期`
                : undefined
            }
            subColor={s.expired_ingredients > 0 ? "var(--rose)" : s.expiring_ingredients > 0 ? "var(--golden)" : undefined}
            color="var(--blue)" bg="var(--blue-bg)"
            onClick={() => router.push("/fridge")}
          />
          <StatCard
            icon={<Calendar size={20} />} label="膳食计划" value={s.meal_plan_count}
            color="var(--pink)" bg="var(--pink-bg)"
            onClick={() => router.push("/meal-plan")}
          />
        </div>

        {/* ── 图表区 ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {/* 卡路里趋势 */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <TrendingUp size={16} color="var(--accent)" /> 近 7 天热量摄入
            </div>
            <BarChart
              data={data.calories_trend.map(d => ({ label: shortDate(d.date), value: d.calories }))}
              max={maxCal}
              unit="kcal"
              color="var(--accent)"
            />
          </div>

          {/* 烹饪次数趋势 */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <ChefHat size={16} color="var(--green)" /> 近 7 天烹饪次数
            </div>
            <BarChart
              data={data.cook_trend.map(d => ({ label: shortDate(d.date), value: d.count }))}
              max={maxCook}
              unit="次"
              color="var(--green)"
            />
          </div>
        </div>

        {/* ── 今日营养素分布 + 食材分类 ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {/* 营养素分布 */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Flame size={16} color="var(--golden)" /> 今日营养素分布
            </div>
            {nutriTotal > 0 ? (
              <NutritionBars
                protein={data.nutrition_breakdown.protein}
                carbs={data.nutrition_breakdown.carbs}
                fat={data.nutrition_breakdown.fat}
                total={nutriTotal}
              />
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                今日暂无饮食记录
                <button
                  onClick={() => router.push("/nutrition")}
                  style={{
                    display: "block", margin: "12px auto 0", padding: "8px 20px",
                    borderRadius: 12, border: "none", cursor: "pointer",
                    background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600,
                  }}
                >去记录</button>
              </div>
            )}
          </div>

          {/* 食材分类分布 */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Snowflake size={16} color="var(--blue)" /> 冰箱食材分类
            </div>
            {data.ingredient_categories.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.ingredient_categories
                  .sort((a, b) => b.count - a.count)
                  .map(cat => {
                    const maxCat = Math.max(...data.ingredient_categories.map(c => c.count), 1);
                    return (
                      <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 60, flexShrink: 0 }}>
                          {cat.category}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
                          <div style={{
                            width: `${(cat.count / maxCat) * 100}%`,
                            height: "100%",
                            borderRadius: 4,
                            background: "var(--blue)",
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 24, textAlign: "right" }}>
                          {cat.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                冰箱暂无食材
              </div>
            )}
          </div>
        </div>

        {/* ── 最近活动 ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {/* 最近菜谱 */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={sectionTitleStyle}> <BookOpen size={16} color="var(--accent)" /> 最近菜谱 </div>
              <SeeAllBtn onClick={() => router.push("/recipes")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recent_recipes.length > 0 ? data.recent_recipes.slice(0, 4).map(r => (
                <div
                  key={r.id}
                  onClick={() => router.push("/recipes")}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    padding: 8, borderRadius: 12, transition: "var(--transition)",
                  }}
                  className="hover-lift-bg"
                >
                  {r.image_url ? (
                    <img
                      src={proxyImageUrl(r.image_url)}
                      alt={r.title}
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-placeholder)",
                    }}>
                      <ChefHat size={18} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {r.title}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      {r.difficulty && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.difficulty}</span>
                      )}
                      {r.score != null && r.score > 0 && (
                        <span style={{ fontSize: 11, color: "var(--golden)", display: "flex", alignItems: "center", gap: 2 }}>
                          <Star size={10} fill="var(--golden)" /> {r.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <EmptyHint text="还没有收藏菜谱" btnText="去找菜谱" onClick={() => router.push("/")} />
              )}
            </div>
          </div>

          {/* 最近烹饪 */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={sectionTitleStyle}> <Clock size={16} color="var(--green)" /> 最近烹饪 </div>
              <SeeAllBtn onClick={() => router.push("/history")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recent_cooks.length > 0 ? data.recent_cooks.slice(0, 4).map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 12, background: "var(--bg)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {c.recipe_name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {c.cook_date}
                    </div>
                  </div>
                  {c.rating > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          size={12}
                          fill={n <= c.rating ? "var(--golden)" : "none"}
                          color={n <= c.rating ? "var(--golden)" : "var(--text-placeholder)"}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <EmptyHint text="还没有烹饪记录" btnText="去记录" onClick={() => router.push("/history")} />
              )}
            </div>
          </div>

          {/* 最近购物清单 */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={sectionTitleStyle}> <ShoppingCart size={16} color="var(--teal)" /> 最近清单 </div>
              <SeeAllBtn onClick={() => router.push("/shopping-list")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recent_shopping.length > 0 ? data.recent_shopping.map(sh => (
                <div
                  key={sh.id}
                  onClick={() => router.push("/shopping-list")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 12, background: "var(--bg)", cursor: "pointer",
                  }}
                  className="hover-lift-bg"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {sh.source_recipe_names?.length > 0 ? sh.source_recipe_names.join("、") : "购物清单"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {sh.item_count} 项 · {new Date(sh.created_at).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                    background: sh.status === "completed" ? "var(--green-bg)" : "var(--accent-bg)",
                    color: sh.status === "completed" ? "var(--green)" : "var(--accent)",
                  }}>
                    {sh.status === "completed" ? "已完成" : "待办"}
                  </span>
                </div>
              )) : (
                <EmptyHint text="还没有购物清单" btnText="去生成" onClick={() => router.push("/recipes")} />
              )}
            </div>
          </div>
        </div>

        {/* ── 偏好设置引导 ── */}
        {!s.has_preference && (
          <div
            onClick={() => router.push("/preferences")}
            style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              padding: "16px 20px", borderRadius: "var(--radius-lg)",
              background: "var(--accent-bg)", boxShadow: "var(--shadow-raised-sm)",
              transition: "var(--transition)",
            }}
            className="hover-lift"
          >
            <AlertTriangle size={20} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>完善口味偏好</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                设置偏好后，AI 推荐的菜谱会更贴合你的口味
              </div>
            </div>
            <ArrowRight size={16} color="var(--accent)" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}

// ── 统计卡片 ──
function StatCard({
  icon, label, value, subValue, subColor, color, bg, onClick,
}: {
  icon: React.ReactNode; label: string; value: number | string;
  subValue?: string; subColor?: string;
  color: string; bg: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        padding: 16, boxShadow: "var(--shadow-raised)", cursor: "pointer",
        transition: "var(--transition)", display: "flex", flexDirection: "column", gap: 10,
      }}
      className="hover-lift"
    >
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: bg, color, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
          {value}
          {subValue && (
            <span style={{
              fontSize: 12, fontWeight: 500, marginLeft: 4,
              color: subColor || "var(--text-muted)",
            }}>{subValue}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

// ── 柱状图（纯 SVG）──
function BarChart({
  data, max, unit, color,
}: {
  data: { label: string; value: number }[];
  max: number; unit: string; color: string;
}) {
  const chartH = 140;
  const barW = 28;
  const gap = (100 / Math.max(data.length, 1));

  return (
    <div>
      <svg width="100%" height={chartH + 24} viewBox={`0 0 100 ${chartH + 24}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * (chartH - 20) : 0;
          const x = i * gap + gap / 2;
          const y = chartH - h;
          return (
            <g key={i}>
              <rect
                x={x - barW / 4} y={y} width={barW / 2} height={h}
                rx={1.5} fill={color} opacity={d.value > 0 ? 0.85 : 0.2}
                style={{ transition: "height 0.5s ease, y 0.5s ease" }}
              />
              {d.value > 0 && (
                <text
                  x={x} y={y - 1.5} textAnchor="middle"
                  fontSize="4" fill="var(--text-secondary)" fontWeight="600"
                >
                  {d.value.toFixed(0)}
                </text>
              )}
              <text
                x={x} y={chartH + 6} textAnchor="middle"
                fontSize="4" fill="var(--text-muted)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
        单位：{unit}
      </div>
    </div>
  );
}

// ── 营养素条形 ──
function NutritionBars({
  protein, carbs, fat, total,
}: {
  protein: number; carbs: number; fat: number; total: number;
}) {
  const items = [
    { name: "蛋白质", value: protein, color: "var(--green)" },
    { name: "碳水化合物", value: carbs, color: "var(--accent)" },
    { name: "脂肪", value: fat, color: "var(--golden)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 总览堆叠条 */}
      <div style={{
        height: 12, borderRadius: 6, overflow: "hidden", display: "flex",
        background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
      }}>
        {items.map(it => (
          <div key={it.name} style={{
            width: `${(it.value / total) * 100}%`,
            background: it.color,
            transition: "width 0.5s ease",
          }} />
        ))}
      </div>
      {/* 分项 */}
      {items.map(it => (
        <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>{it.name}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {it.value.toFixed(1)} g
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>
            {((it.value / total) * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 查看全部按钮 ──
function SeeAllBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 2, cursor: "pointer",
        background: "none", border: "none", fontSize: 12, fontWeight: 500,
        color: "var(--text-muted)", transition: "var(--transition)", padding: 0,
      }}
      className="hover-text"
    >
      全部 <ArrowRight size={12} />
    </button>
  );
}

// ── 空状态引导 ──
function EmptyHint({ text, btnText, onClick }: { text: string; btnText: string; onClick: () => void }) {
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{text}</p>
      <button
        onClick={onClick}
        style={{
          padding: "8px 20px", borderRadius: 12, border: "none", cursor: "pointer",
          background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600,
          boxShadow: "var(--shadow-raised-sm)",
        }}
      >
        {btnText}
      </button>
    </div>
  );
}
