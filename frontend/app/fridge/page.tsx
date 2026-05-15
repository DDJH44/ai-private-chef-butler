"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn, generateUUID } from "@/lib/utils";
import {
    Ingredient, IngredientCategory, IngredientUnit, CATEGORY_OPTIONS, UNIT_OPTIONS,
    STATUS_CONFIG, CATEGORY_ICONS, DEFAULT_SHELF_LIFE, calculateExpiryDate, calculateStatus,
} from "@/types/ingredient";
import {
    loadIngredients, addIngredient, updateIngredient, deleteIngredient,
    INGREDIENT_CHANGE_EVENT,
} from "@/lib/ingredientStore";
import { showToast } from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function FridgePage() {
    const router = useRouter();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<IngredientCategory | "全部">("全部");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Ingredient>>({
        name: "", category: "蔬菜", quantity: 1, unit: "个",
        purchase_date: new Date().toISOString().split("T")[0],
        shelf_life_days: 7, expiry_date: "",
    });
    const load = useCallback(() => setIngredients(loadIngredients()), []);

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener(INGREDIENT_CHANGE_EVENT, handler);
        return () => window.removeEventListener(INGREDIENT_CHANGE_EVENT, handler);
    }, [load]);

    const filtered = ingredients.filter(i => {
        const matchSearch = !search || i.name.includes(search);
        const matchCat = category === "全部" || i.category === category;
        return matchSearch && matchCat;
    });

    const expiringCount = ingredients.filter(i => {
        const days = i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - Date.now()) / 86400000) : Infinity;
        return days >= 0 && days <= 3;
    }).length;

    const openAdd = () => {
        setEditId(null);
        setForm({
            name: "", category: "蔬菜", quantity: 1, unit: "个",
            purchase_date: new Date().toISOString().split("T")[0],
            shelf_life_days: 7, expiry_date: "",
        });
        setShowForm(true);
    };

    const openEdit = (item: Ingredient) => {
        setEditId(item.id);
        setForm({ ...item });
        setShowForm(true);
    };

    const handleSave = () => {
        if (!form.name?.trim()) {
            showToast("请输入食材名称", "error");
            return;
        }
        const expiry = form.expiry_date || calculateExpiryDate(
            form.purchase_date || new Date().toISOString().split("T")[0],
            form.shelf_life_days || 7
        );
        const data: Ingredient = {
            id: editId || generateUUID(),
            name: form.name!.trim(),
            category: form.category || "蔬菜",
            quantity: form.quantity || 1,
            unit: form.unit || "个",
            purchase_date: form.purchase_date || new Date().toISOString().split("T")[0],
            shelf_life_days: form.shelf_life_days || 7,
            expiry_date: expiry,
            status: calculateStatus(expiry),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (editId) {
            updateIngredient(editId, data);
            showToast("食材已更新", "success");
        } else {
            addIngredient(data);
            showToast("食材已添加", "success");
        }
        setShowForm(false);
        setEditId(null);
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const doDelete = (id: string) => {
        deleteIngredient(id);
        showToast("食材已删除", "success");
    };

    const handleAIRecommend = () => {
        const names = ingredients.slice(0, 8).map(i => i.name).join("、");
        router.push(`/?msg=我冰箱里有${names}，推荐几道菜`);
    };

    return (
        <AuthGuard>
        <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
            {/* Header */}
            <header className="flex-shrink-0 px-4 lg:px-6 py-4" style={{ background: "var(--bg)" }}>
                <div className="relative flex items-center justify-between max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            style={{
                                width: 36, height: 36,
                                background: "var(--bg)",
                                borderRadius: 12,
                                boxShadow: "var(--shadow-raised-sm)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "none", cursor: "pointer",
                                transition: "all 0.25s ease",
                            }}
                            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                        >
                            <span style={{ fontSize: 16 }}>←</span>
                        </button>
                        <div>
                            <h1 style={{
                                fontSize: 15, fontWeight: 700, color: "var(--text)",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                letterSpacing: "-0.02em",
                            }}>
                                🧊 我的冰箱
                            </h1>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                {ingredients.length} 种食材
                            </p>
                        </div>
                    </div>
                    <button onClick={openAdd}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px",
                            background: "var(--accent)",
                            color: "#fff",
                            borderRadius: 12,
                            fontSize: 12, fontWeight: 600,
                            border: "none", cursor: "pointer",
                            boxShadow: "var(--shadow-accent)",
                            transition: "all 0.25s ease",
                        }}
                        onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
                        onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
                    >
                        <span style={{ fontSize: 14 }}>＋</span> 添加
                    </button>
                </div>
            </header>

            {/* Search & filters */}
            <div className="flex-shrink-0 px-4 lg:px-0 py-2 space-y-2 max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
                <div className="relative" style={{ borderRadius: 12 }}>
                    <span style={{
                        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                        fontSize: 14, color: "var(--text-placeholder)", pointerEvents: "none",
                    }}>🔍</span>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="搜索食材..."
                        style={{
                            width: "100%", padding: "10px 14px 10px 36px",
                            background: "var(--bg)", border: "none", borderRadius: 12,
                            boxShadow: "var(--shadow-inset-sm)",
                            fontSize: 14, color: "var(--text)",
                            outline: "none", transition: "all 0.25s ease",
                        }}
                        onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                        onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                    />
                </div>
                {expiringCount > 0 && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px",
                        background: "var(--bg)",
                        borderRadius: 12,
                        boxShadow: "var(--shadow-raised-xs)",
                        color: "var(--golden)",
                        fontSize: 12, fontWeight: 500,
                    }}>
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <span>{expiringCount} 种食材即将过期</span>
                    </div>
                )}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {(["全部", ...CATEGORY_OPTIONS] as const).map(cat => (
                        <button key={cat} onClick={() => setCategory(cat)}
                            style={{
                                flexShrink: 0,
                                padding: "7px 14px",
                                borderRadius: 999,
                                fontSize: 12, fontWeight: 600,
                                border: "none", cursor: "pointer",
                                transition: "all 0.25s ease",
                                background: "var(--bg)",
                                color: category === cat ? "var(--accent)" : "var(--text-secondary)",
                                boxShadow: category === cat ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
                            }}
                        >
                            {cat === "全部" ? "全部" : `${CATEGORY_ICONS[cat]} ${cat}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 lg:px-0 py-2 max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
                {filtered.length === 0 ? (
                    <div className="empty-state pt-16">
                        <div style={{
                            width: 72, height: 72,
                            background: "var(--bg)", borderRadius: 20,
                            boxShadow: "var(--shadow-raised)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginBottom: 16, fontSize: 32,
                        }}>
                            ❄️
                        </div>
                        <h3 style={{
                            fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4,
                            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                        }}>
                            冰箱是空的
                        </h3>
                        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                            点击上方 &quot;添加&quot; 按钮录入你的食材
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                        {filtered.map(item => {
                            const statusCfg = STATUS_CONFIG[item.status];
                            const daysLeft = item.expiry_date
                                ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000)
                                : null;
                            return (
                                <div key={item.id} className="card-base" style={{ padding: 14 }}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start" style={{ gap: 10 }}>
                                            <div style={{
                                                width: 40, height: 40,
                                                background: "var(--bg)",
                                                borderRadius: 12,
                                                boxShadow: "var(--shadow-inset-sm)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 18,
                                            }}>
                                                {CATEGORY_ICONS[item.category]}
                                            </div>
                                            <div>
                                                <h3 style={{
                                                    fontSize: 14, fontWeight: 600, color: "var(--text)",
                                                    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                                }}>
                                                    {item.name}
                                                </h3>
                                                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                                                    {item.quantity} {item.unit} · {item.category}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center" style={{ gap: 4 }}>
                                            <span style={{
                                                fontSize: 10, padding: "3px 10px",
                                                borderRadius: 999, fontWeight: 600,
                                                background: "var(--bg)",
                                                boxShadow: "var(--shadow-raised-xs)",
                                                color: statusCfg.color === "text-green-600" ? "var(--green)"
                                                     : statusCfg.color === "text-red-600" ? "var(--rose)"
                                                     : "var(--golden)",
                                            }}>
                                                {statusCfg.label}
                                            </span>
                                            <button onClick={() => openEdit(item)}
                                                style={{
                                                    width: 28, height: 28,
                                                    background: "var(--bg)",
                                                    borderRadius: 8,
                                                    boxShadow: "var(--shadow-raised-xs)",
                                                    border: "none", cursor: "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 12, color: "var(--text-muted)",
                                                    transition: "all 0.25s ease",
                                                }}
                                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                            >
                                                ✏️
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(item.id)}
                                                style={{
                                                    width: 28, height: 28,
                                                    background: "var(--bg)",
                                                    borderRadius: 8,
                                                    boxShadow: "var(--shadow-raised-xs)",
                                                    border: "none", cursor: "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 12, color: "var(--text-muted)",
                                                    transition: "all 0.25s ease",
                                                }}
                                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    {daysLeft !== null && (
                                        <div style={{
                                            marginTop: 10, display: "flex", alignItems: "center", gap: 6,
                                            fontSize: 10, color: "var(--text-muted)",
                                        }}>
                                            <span style={{ fontSize: 10 }}>⏱️</span>
                                            <span>
                                                {daysLeft < 0 ? `已过期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? "今天到期" : `还剩 ${daysLeft} 天`}
                                            </span>
                                            {item.expiry_date && (
                                                <span style={{ color: "var(--text-placeholder)" }}>· {item.expiry_date}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* AI Recommend button */}
            {ingredients.length > 0 && (
                <div className="flex-shrink-0 sticky bottom-16 lg:bottom-0 px-4 py-3 pointer-events-none"
                    style={{ background: "linear-gradient(to top, var(--bg) 50%, transparent)" }}
                >
                    <div className="max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
                        <button onClick={handleAIRecommend}
                            className="pointer-events-auto"
                            style={{
                                width: "100%",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                padding: "14px 24px",
                                background: "var(--golden-bg)",
                                color: "var(--golden)",
                                borderRadius: 16,
                                fontSize: 14, fontWeight: 700,
                                border: "none", cursor: "pointer",
                                boxShadow: "var(--shadow-raised)",
                                transition: "all 0.25s ease",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            }}
                            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset)"; }}
                            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                        >
                            ✨ AI 推荐菜品
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 50,
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    padding: "max(16px, 5vh)", overflowY: "auto",
                    background: "rgba(0,0,0,0.25)",
                    backdropFilter: "blur(4px)",
                    animation: "fadeIn 0.2s ease",
                }} onClick={() => setShowForm(false)}>
                    <div style={{
                        width: "100%", maxWidth: 440,
                        background: "var(--bg)",
                        borderRadius: 24,
                        boxShadow: "var(--shadow-raised-lg)",
                        overflow: "hidden",
                        animation: "scaleIn 0.25s ease both",
                    }} onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div style={{
                            padding: "16px 20px",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: "none",
                        }}>
                            <h3 style={{
                                fontSize: 16, fontWeight: 700, color: "var(--text)",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            }}>
                                {editId ? "✏️ 编辑食材" : "➕ 添加食材"}
                            </h3>
                            <button onClick={() => setShowForm(false)}
                                style={{
                                    width: 32, height: 32,
                                    background: "var(--bg)",
                                    borderRadius: 10,
                                    boxShadow: "var(--shadow-raised-xs)",
                                    border: "none", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 16, color: "var(--text-muted)",
                                    transition: "all 0.25s ease",
                                }}
                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal body */}
                        <div style={{ padding: "16px 20px", maxHeight: "60vh", overflowY: "auto" }}>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{
                                    display: "block", fontSize: 12, fontWeight: 500,
                                    color: "var(--text-secondary)", marginBottom: 6,
                                }}>
                                    食材名称 *
                                </label>
                                <input value={form.name || ""} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="例如：西红柿"
                                    style={{
                                        width: "100%", padding: "10px 14px",
                                        background: "var(--bg)", border: "none", borderRadius: 12,
                                        boxShadow: "var(--shadow-inset-sm)",
                                        fontSize: 14, color: "var(--text)",
                                        outline: "none", transition: "all 0.25s ease",
                                    }}
                                    onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                    onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                <div>
                                    <label style={{
                                        display: "block", fontSize: 12, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        数量
                                    </label>
                                    <input type="number" min={0} step={0.1} value={form.quantity || 1}
                                        onChange={e => setForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                                        style={{
                                            width: "100%", padding: "10px 14px",
                                            background: "var(--bg)", border: "none", borderRadius: 12,
                                            boxShadow: "var(--shadow-inset-sm)",
                                            fontSize: 14, color: "var(--text)",
                                            outline: "none", transition: "all 0.25s ease",
                                        }}
                                        onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: "block", fontSize: 12, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        单位
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <select value={form.unit || "个"}
                                            onChange={e => setForm(prev => ({ ...prev, unit: e.target.value as IngredientUnit }))}
                                            style={{
                                                width: "100%", padding: "10px 14px",
                                                background: "var(--bg)", border: "none", borderRadius: 12,
                                                boxShadow: "var(--shadow-inset-sm)",
                                                fontSize: 14, color: "var(--text)",
                                                outline: "none", appearance: "none",
                                                transition: "all 0.25s ease",
                                            }}
                                            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                        >
                                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <span style={{
                                            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                            fontSize: 12, color: "var(--text-placeholder)", pointerEvents: "none",
                                        }}>▾</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{
                                    display: "block", fontSize: 12, fontWeight: 500,
                                    color: "var(--text-secondary)", marginBottom: 6,
                                }}>
                                    分类
                                </label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {CATEGORY_OPTIONS.map(cat => (
                                        <button key={cat} type="button"
                                            onClick={() => setForm(prev => ({ ...prev, category: cat }))}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 10,
                                                fontSize: 11, fontWeight: 600,
                                                border: "none", cursor: "pointer",
                                                transition: "all 0.25s ease",
                                                background: "var(--bg)",
                                                color: form.category === cat ? "var(--accent)" : "var(--text-secondary)",
                                                boxShadow: form.category === cat ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
                                            }}
                                        >
                                            {CATEGORY_ICONS[cat]} {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                <div>
                                    <label style={{
                                        display: "block", fontSize: 12, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        购买日期
                                    </label>
                                    <input type="date" value={form.purchase_date || ""}
                                        onChange={e => setForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                                        style={{
                                            width: "100%", padding: "10px 14px",
                                            background: "var(--bg)", border: "none", borderRadius: 12,
                                            boxShadow: "var(--shadow-inset-sm)",
                                            fontSize: 14, color: "var(--text)",
                                            outline: "none", transition: "all 0.25s ease",
                                        }}
                                        onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: "block", fontSize: 12, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        保质期(天)
                                    </label>
                                    <input type="number" min={1} value={form.shelf_life_days || 7}
                                        onChange={e => setForm(prev => ({ ...prev, shelf_life_days: parseInt(e.target.value) || 7 }))}
                                        style={{
                                            width: "100%", padding: "10px 14px",
                                            background: "var(--bg)", border: "none", borderRadius: 12,
                                            boxShadow: "var(--shadow-inset-sm)",
                                            fontSize: 14, color: "var(--text)",
                                            outline: "none", transition: "all 0.25s ease",
                                        }}
                                        onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                                        onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {[
                                    { name: "西红柿", days: 7 }, { name: "鸡蛋", days: 30 }, { name: "牛奶", days: 7 },
                                    { name: "鸡胸肉", days: 3 }, { name: "土豆", days: 14 }, { name: "大米", days: 180 },
                                ].map(s => (
                                    <button key={s.name} type="button"
                                        onClick={() => setForm(prev => ({
                                            ...prev,
                                            name: s.name,
                                            shelf_life_days: s.days,
                                            expiry_date: calculateExpiryDate(
                                                prev.purchase_date || new Date().toISOString().split("T")[0], s.days
                                            ),
                                        }))}
                                        style={{
                                            padding: "6px 12px",
                                            background: "var(--bg)",
                                            color: "var(--accent)",
                                            borderRadius: 10,
                                            fontSize: 11, fontWeight: 600,
                                            border: "none", cursor: "pointer",
                                            boxShadow: "var(--shadow-raised-xs)",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                        onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div style={{
                            padding: "16px 20px",
                            display: "flex", gap: 12,
                        }}>
                            <button onClick={() => setShowForm(false)}
                                style={{
                                    flex: 1, padding: "10px 0",
                                    background: "var(--bg)",
                                    color: "var(--text-secondary)",
                                    borderRadius: 12,
                                    fontSize: 14, fontWeight: 600,
                                    border: "none", cursor: "pointer",
                                    boxShadow: "var(--shadow-raised-sm)",
                                    transition: "all 0.25s ease",
                                }}
                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                            >
                                取消
                            </button>
                            <button onClick={handleSave}
                                style={{
                                    flex: 1, padding: "10px 0",
                                    background: "var(--accent)",
                                    color: "#fff",
                                    borderRadius: 12,
                                    fontSize: 14, fontWeight: 700,
                                    border: "none", cursor: "pointer",
                                    boxShadow: "var(--shadow-accent)",
                                    transition: "all 0.25s ease",
                                }}
                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
                            >
                                {editId ? "保存修改" : "添加食材"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
            {confirmDeleteId && (
                <ConfirmDialog
                    isOpen={!!confirmDeleteId}
                    title="删除食材"
                    message="确定要删除这个食材吗？此操作不可撤销。"
                    onCancel={() => setConfirmDeleteId(null)}
                    onConfirm={() => {
                        doDelete(confirmDeleteId);
                        setConfirmDeleteId(null);
                    }}
                />
            )}
        </AuthGuard>
    );
}
