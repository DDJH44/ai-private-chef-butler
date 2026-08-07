"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Trash2, X, Plus, Clock, Sparkles, Search, AlertTriangle, Snowflake, Camera, Check, Loader2 } from "lucide-react";
import { CATEGORY_ICONS, PageIcon } from "@/lib/icons";
import { classifyIngredient } from "@/lib/ingredientClassifier";
import { cn, generateUUID } from "@/lib/utils";
import {
    Ingredient, IngredientCategory, IngredientUnit, CATEGORY_OPTIONS, UNIT_OPTIONS,
    STATUS_CONFIG, DEFAULT_SHELF_LIFE, calculateExpiryDate, calculateStatus,
} from "@/types/ingredient";
import {
    loadIngredients, addIngredient, updateIngredient, deleteIngredient,
    INGREDIENT_CHANGE_EVENT,
} from "@/lib/ingredientStore";
import { showToast } from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import ConfirmDialog from "@/components/ConfirmDialog";
import { authFetch, authJsonHeaders } from "@/lib/http";

export default function FridgePage() {
    const router = useRouter();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [category, setCategory] = useState<IngredientCategory | "全部">("全部");
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Ingredient>>({
        name: "", category: "蔬菜", quantity: 1, unit: "个",
        purchase_date: new Date().toISOString().split("T")[0],
        shelf_life_days: 7, expiry_date: "",
    });
    const load = useCallback(() => setIngredients(loadIngredients()), []);

    // 拍照识别状态
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [identifying, setIdentifying] = useState(false);
    const [photoItems, setPhotoItems] = useState<Array<{ name: string; category: string; quantity: number; unit: string; shelf_life_days: number; selected: boolean }>>([]);

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener(INGREDIENT_CHANGE_EVENT, handler);
        return () => window.removeEventListener(INGREDIENT_CHANGE_EVENT, handler);
    }, [load]);

    const filtered = useMemo(() => ingredients.filter(i => {
        const matchSearch = !deferredSearch || i.name.includes(deferredSearch);
        const matchCat = category === "全部" || i.category === category;
        return matchSearch && matchCat;
    }), [ingredients, deferredSearch, category]);

    const expiringCount = useMemo(() => ingredients.filter(i => {
        const days = i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - Date.now()) / 86400000) : Infinity;
        return days >= 0 && days <= 3;
    }).length, [ingredients]);

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
            created_at: editId ? (form.created_at || new Date().toISOString()) : new Date().toISOString(),
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
            <header className="flex-shrink-0 px-4 lg:px-6 py-4" style={{ background: "var(--surface)" }}>
                <div className="relative flex items-center justify-between max-w-5xl mx-auto lg:max-w-6xl xl:max-w-7xl">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()}
                            aria-label="返回"
                            style={{
                                width: 36, height: 36,
                                background: "var(--surface)",
                                borderRadius: 12,
                                boxShadow: "var(--shadow-raised-sm)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "none", cursor: "pointer",
                                transition: "var(--transition)",
                            }}
                        >
                            <span style={{ fontSize: 16 }}>←</span>
                        </button>
                        <div>
                            <h1 style={{
                                fontSize: 15, fontWeight: 700, color: "var(--text)",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                letterSpacing: "-0.02em",
                            }}>
                                我的冰箱
                            </h1>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                {ingredients.length} 种食材
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => document.getElementById('photo-upload-input')?.click()}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 16px",
                            background: "var(--surface)",
                            color: "var(--accent)",
                            borderRadius: 12,
                            fontSize: 12, fontWeight: 600,
                            border: "none", cursor: "pointer",
                            boxShadow: "var(--shadow-raised-sm)",
                            transition: "var(--transition)",
                        }}
                    >
                        <Camera size={14} strokeWidth={1.8} /> 拍照识别
                    </button>
                    <input
                        id="photo-upload-input"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            e.target.value = "";
                            setShowPhotoModal(true);
                            setIdentifying(true);
                            setPhotoItems([]);
                            try {
                                const formData = new FormData();
                                formData.append("file", file);
                                const resp = await authFetch(`/api/v1/ingredients/identify-from-photo`, {
                                    method: "POST",
                                    body: formData,
                                });
                                if (resp.ok) {
                                    const data = await resp.json();
                                    setPhotoItems((data.items || []).map((it: Record<string, unknown>) => ({
                                        ...it,
                                        name: String(it.name || ""),
                                        category: String(it.category || "其他"),
                                        quantity: Number(it.quantity) || 1,
                                        unit: String(it.unit || "个"),
                                        shelf_life_days: Number(it.shelf_life_days) || 7,
                                        selected: true,
                                    })));
                                } else {
                                    showToast("识别失败，请重试", "error");
                                    setShowPhotoModal(false);
                                }
                            } catch {
                                showToast("网络错误，识别失败", "error");
                                setShowPhotoModal(false);
                            }
                            setIdentifying(false);
                        }}
                    />
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
                            transition: "var(--transition)",
                        }}
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
                        color: "var(--text-placeholder)", pointerEvents: "none",
                    }}><Search size={16} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} /></span>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="搜索食材..."
                        style={{
                            width: "100%", padding: "10px 14px 10px 36px",
                            background: "var(--bg)", border: "none", borderRadius: 12,
                            boxShadow: "var(--shadow-inset-sm)",
                            fontSize: 14, color: "var(--text)",
                            outline: "none", transition: "var(--transition)",
                        }}
                    />
                </div>
                {expiringCount > 0 && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px",
                        background: "var(--surface)",
                        borderRadius: 12,
                        boxShadow: "var(--shadow-raised-xs)",
                        color: "var(--golden)",
                        fontSize: 12, fontWeight: 500,
                    }}>
                        <AlertTriangle size={16} strokeWidth={1.8} />
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
                                transition: "var(--transition)",
                                background: "var(--surface)",
                                color: category === cat ? "var(--accent)" : "var(--text-secondary)",
                                boxShadow: category === cat ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
                            }}
                        >
                            {cat === "全部" ? "全部" : <>{CATEGORY_ICONS[cat]} {cat}</>}
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
                            background: "var(--surface)", borderRadius: 20,
                            boxShadow: "var(--shadow-raised)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginBottom: 16, fontSize: 32,
                        }}>
                            <Snowflake size={32} strokeWidth={1.5} />
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
                                                aria-label={`编辑 ${item.name}`}
                                                style={{
                                                    width: 28, height: 28,
                                                    background: "var(--surface)",
                                                    borderRadius: 8,
                                                    boxShadow: "var(--shadow-raised-xs)",
                                                    border: "none", cursor: "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 12, color: "var(--text-muted)",
                                                    transition: "var(--transition)",
                                                }}
                                            >
                                                <Pencil size={14} strokeWidth={1.8} />
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(item.id)}
                                                aria-label={`删除 ${item.name}`}
                                                style={{
                                                    width: 28, height: 28,
                                                    background: "var(--surface)",
                                                    borderRadius: 8,
                                                    boxShadow: "var(--shadow-raised-xs)",
                                                    border: "none", cursor: "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 12, color: "var(--text-muted)",
                                                    transition: "var(--transition)",
                                                }}
                                            >
                                                <Trash2 size={14} strokeWidth={1.8} />
                                            </button>
                                        </div>
                                    </div>
                                    {daysLeft !== null && (
                                        <div style={{
                                            marginTop: 10, display: "flex", alignItems: "center", gap: 6,
                                            fontSize: 10, color: "var(--text-muted)",
                                        }}>
                                            <Clock size={14} strokeWidth={1.8} />
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
                                transition: "var(--transition)",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            }}
                        >
                            <Sparkles size={14} strokeWidth={1.8} /> AI 推荐菜品
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
                        background: "var(--surface)",
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
                                {editId ? <><Pencil size={14} strokeWidth={1.8} /> 编辑食材</> : <><Plus size={14} strokeWidth={1.8} /> 添加食材</>}
                            </h3>
                            <button onClick={() => setShowForm(false)}
                                aria-label="关闭"
                                style={{
                                    width: 32, height: 32,
                                    background: "var(--surface)",
                                    borderRadius: 10,
                                    boxShadow: "var(--shadow-raised-xs)",
                                    border: "none", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 16, color: "var(--text-muted)",
                                    transition: "var(--transition)",
                                }}
                            >
                                <X size={16} strokeWidth={1.8} />
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
                                <input value={form.name || ""}
                                    onChange={e => {
                                        const name = e.target.value;
                                        const cat = classifyIngredient(name);
                                        setForm(prev => ({ ...prev, name, category: cat }));
                                    }}
                                    placeholder="例如：西红柿"
                                    style={{
                                        width: "100%", padding: "10px 14px",
                                        background: "var(--bg)", border: "none", borderRadius: 12,
                                        boxShadow: "var(--shadow-inset-sm)",
                                        fontSize: 14, color: "var(--text)",
                                        outline: "none", transition: "var(--transition)",
                                    }}
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
                                            outline: "none", transition: "var(--transition)",
                                        }}
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
                                                transition: "var(--transition)",
                                            }}
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
                                    {form.name && (
                                        <span style={{
                                            marginLeft: 8, padding: "1px 8px", borderRadius: 999,
                                            fontSize: 10, fontWeight: 500,
                                            background: "var(--accent-bg)", color: "var(--accent)",
                                        }}>
                                            自动识别
                                        </span>
                                    )}
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
                                                transition: "var(--transition)",
                                                background: "var(--surface)",
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
                                            outline: "none", transition: "var(--transition)",
                                        }}
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
                                            outline: "none", transition: "var(--transition)",
                                        }}
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
                                            category: classifyIngredient(s.name),
                                            shelf_life_days: s.days,
                                            expiry_date: calculateExpiryDate(
                                                prev.purchase_date || new Date().toISOString().split("T")[0], s.days
                                            ),
                                        }))}
                                        style={{
                                            padding: "6px 12px",
                                            background: "var(--surface)",
                                            color: "var(--accent)",
                                            borderRadius: 10,
                                            fontSize: 11, fontWeight: 600,
                                            border: "none", cursor: "pointer",
                                            boxShadow: "var(--shadow-raised-xs)",
                                            transition: "var(--transition)",
                                        }}
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
                                    background: "var(--surface)",
                                    color: "var(--text-secondary)",
                                    borderRadius: 12,
                                    fontSize: 14, fontWeight: 600,
                                    border: "none", cursor: "pointer",
                                    boxShadow: "var(--shadow-raised-sm)",
                                    transition: "var(--transition)",
                                }}
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
                                    transition: "var(--transition)",
                                }}
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
            {/* 拍照识别食材确认弹窗 */}
            {showPhotoModal && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 60,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 16, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
                    animation: "fadeIn 0.2s ease",
                }} onClick={() => setShowPhotoModal(false)}>
                    <div style={{
                        width: "100%", maxWidth: 480, maxHeight: "85vh",
                        background: "var(--surface)", borderRadius: 24,
                        boxShadow: "var(--shadow-raised-lg)", overflow: "hidden",
                        display: "flex", flexDirection: "column",
                        animation: "scaleIn 0.25s ease both",
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: "20px 24px", display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid var(--border-light)",
                        }}>
                            <h3 style={{
                                fontSize: 18, fontWeight: 700, color: "var(--text)",
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            }}>
                                <Camera size={18} strokeWidth={1.8} style={{ marginRight: 8, verticalAlign: "middle" }} />
                                AI 识别结果
                            </h3>
                            <button onClick={() => setShowPhotoModal(false)}
                                aria-label="关闭"
                                style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    background: "var(--bg)", border: "none", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "var(--text-muted)", fontSize: 16,
                                }}
                            ><X size={16} strokeWidth={1.8}/></button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                            {identifying ? (
                                <div style={{ textAlign: "center", padding: "48px 0" }}>
                                    <Loader2 size={32} strokeWidth={1.5}
                                        style={{ animation: "spin 1s linear infinite", color: "var(--accent)", marginBottom: 16 }} />
                                    <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>AI 正在识别食材...</p>
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>请稍候</p>
                                </div>
                            ) : photoItems.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "48px 0" }}>
                                    <p style={{ fontSize: 15, color: "var(--text-muted)" }}>未识别到食材</p>
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>请确保照片中有清晰的生食材</p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                                        识别到 {photoItems.length} 种食材，勾选需要添加到冰箱的食材：
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {photoItems.map((item, idx) => (
                                            <label key={idx} style={{
                                                display: "flex", alignItems: "center", gap: 12,
                                                padding: "12px 14px", background: "var(--bg)",
                                                borderRadius: 14, cursor: "pointer",
                                                boxShadow: item.selected ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
                                                transition: "var(--transition)",
                                                opacity: item.selected ? 1 : 0.5,
                                            }}>
                                                <input type="checkbox" checked={item.selected}
                                                    onChange={() => {
                                                        setPhotoItems(prev => prev.map((p, i) =>
                                                            i === idx ? { ...p, selected: !p.selected } : p
                                                        ));
                                                    }}
                                                    style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer" }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                                        <span>{item.category}</span>
                                                        <span>{item.quantity} {item.unit}</span>
                                                        <span>保质期 {item.shelf_life_days}天</span>
                                                    </div>
                                                </div>
                                                <button onClick={(e) => {
                                                    e.preventDefault();
                                                    setPhotoItems(prev => prev.filter((_, i) => i !== idx));
                                                }}
                                                    aria-label={`移除 ${item.name}`}
                                                    style={{
                                                        width: 28, height: 28, borderRadius: 8,
                                                        background: "var(--surface)", border: "none", cursor: "pointer",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        color: "var(--text-muted)", fontSize: 12,
                                                        boxShadow: "var(--shadow-raised-xs)",
                                                    }}
                                                ><X size={12} strokeWidth={1.8}/></button>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        {!identifying && photoItems.length > 0 && (
                            <div style={{
                                padding: "16px 24px", display: "flex", gap: 12,
                                borderTop: "1px solid var(--border-light)",
                            }}>
                                <button onClick={() => {
                                    setPhotoItems([]);
                                    setShowPhotoModal(false);
                                }}
                                    style={{
                                        flex: 1, padding: "12px 0", borderRadius: 14,
                                        background: "var(--surface)", color: "var(--text-secondary)",
                                        fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                                        boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
                                    }}
                                >取消</button>
                                <button onClick={async () => {
                                    const selected = photoItems.filter(p => p.selected);
                                    if (selected.length === 0) { showToast("请至少选择一种食材", "error"); return; }
                                    setShowPhotoModal(false);
                                    try {
                                        const resp = await authFetch(`/api/v1/ingredients/batch`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json", ...authJsonHeaders() },
                                            body: JSON.stringify({
                                                items: selected.map(s => ({
                                                    name: s.name,
                                                    category: s.category,
                                                    quantity: s.quantity,
                                                    unit: s.unit,
                                                    shelf_life_days: s.shelf_life_days,
                                                })),
                                            }),
                                        });
                                        if (resp.ok) {
                                            const data = await resp.json();
                                            showToast(`已添加 ${data.total} 种食材到冰箱`, "success");
                                            load();
                                        } else {
                                            showToast("添加失败", "error");
                                        }
                                    } catch {
                                        showToast("网络错误", "error");
                                    }
                                }}
                                    style={{
                                        flex: 2, padding: "12px 0", borderRadius: 14,
                                        background: "var(--accent)", color: "#fff",
                                        fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
                                        boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                    }}
                                >
                                    <Check size={16} strokeWidth={2} /> 确认添加
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AuthGuard>
    );
}
