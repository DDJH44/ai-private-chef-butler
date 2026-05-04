"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShoppingList, ShoppingListItem } from "@/types/shoppingList";
import {
    loadShoppingLists, toggleItemChecked, deleteShoppingList,
    addShoppingList, SHOPPING_LIST_CHANGE_EVENT,
} from "@/lib/shoppingListStore";
import { generateUUID } from "@/lib/utils";
import { showToast } from "@/components/Toast";

export default function ShoppingListPage() {
    const router = useRouter();
    const [lists, setLists] = useState<ShoppingList[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [customTitle, setCustomTitle] = useState("");
    const [customInput, setCustomInput] = useState("");

    const load = useCallback(() => setLists(loadShoppingLists()), []);

    useEffect(() => {
        load();
        const handler = () => load();
        window.addEventListener(SHOPPING_LIST_CHANGE_EVENT, handler);
        return () => window.removeEventListener(SHOPPING_LIST_CHANGE_EVENT, handler);
    }, [load]);

    const handleToggle = useCallback((listId: string, itemId: string) => {
        toggleItemChecked(listId, itemId);
        setLists(loadShoppingLists());
    }, []);

    const handleDelete = useCallback((list: ShoppingList, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteShoppingList(list.id);
        showToast("清单已删除", "success");
    }, []);

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const handleToggleCollapse = useCallback((listId: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(listId) ? next.delete(listId) : next.add(listId);
            return next;
        });
    }, []);

    const handleCopy = useCallback((list: ShoppingList) => {
        const text = list.items
            .map(i => `${i.checked ? "✓" : "○"} ${i.ingredient_name} ${i.required_amount}${i.unit}`)
            .join("\n");
        navigator.clipboard.writeText(text).then(() => showToast("已复制", "success"));
    }, []);

    const handleCreateList = useCallback(() => {
        const lines = customInput.trim().split("\n").filter(Boolean);
        if (lines.length === 0) {
            showToast("请输入至少一种食材", "error");
            return;
        }

        const items: ShoppingListItem[] = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            let name = line.trim();
            let amount = 1;
            let unit = "份";

            if (parts.length >= 2) {
                const num = parseFloat(parts[parts.length - 2]);
                const lastIsUnit = !/^\d+$/.test(parts[parts.length - 1]);
                if (!isNaN(num) && parts.length >= 3) {
                    name = parts.slice(0, -2).join(" ");
                    amount = num;
                    unit = parts[parts.length - 1];
                } else if (!isNaN(parseFloat(parts[parts.length - 1]))) {
                    name = parts.slice(0, -1).join(" ");
                    amount = parseFloat(parts[parts.length - 1]);
                }
            }

            return {
                id: generateUUID(),
                ingredient_name: name,
                required_amount: amount,
                unit,
                in_stock: false,
                stock_amount: 0,
                checked: false,
            };
        });

        const list: ShoppingList = {
            id: `custom_${Date.now()}`,
            created_at: new Date().toISOString(),
            source_recipes: [],
            source_recipe_names: [customTitle.trim() || "自定义清单"],
            items,
            status: "pending",
        };

        addShoppingList(list);
        setLists(loadShoppingLists());
        setShowCreate(false);
        setCustomTitle("");
        setCustomInput("");
        showToast(`已创建清单（${items.length} 种食材）`, "success");
    }, [customInput, customTitle]);

    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "var(--bg)",
            color: "var(--text)",
        }}>
            {/* Header */}
            <header style={{
                flexShrink: 0,
                padding: "14px 16px",
                background: "var(--bg)",
                boxShadow: "var(--shadow-raised)",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    maxWidth: 1280,
                    margin: "0 auto",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                            onClick={() => router.back()}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 14,
                                background: "var(--bg)",
                                boxShadow: "var(--shadow-raised-sm)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 16,
                                color: "var(--text)",
                                transition: "all 0.25s ease",
                            }}
                        >
                            ←
                        </button>
                        <div>
                            <h1 style={{
                                fontSize: 15,
                                fontWeight: 700,
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                color: "var(--text)",
                                letterSpacing: "-0.02em",
                                margin: 0,
                            }}>
                                购物清单
                            </h1>
                            <p style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                margin: "2px 0 0",
                            }}>
                                {lists.length} 个清单
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 14,
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-raised-sm)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--accent)",
                            transition: "all 0.25s ease",
                        }}
                    >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 新建清单
                    </button>
                </div>
            </header>

            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 16px",
                maxWidth: 1280,
                width: "100%",
                margin: "0 auto",
            }}>
                {lists.length === 0 ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: 64,
                        gap: 8,
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: 20,
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-raised)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 28,
                            marginBottom: 8,
                        }}>
                            🛒
                        </div>
                        <h3 style={{
                            fontSize: 16,
                            fontWeight: 700,
                            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            color: "var(--text)",
                            margin: 0,
                        }}>
                            暂无购物清单
                        </h3>
                        <p style={{
                            fontSize: 13,
                            color: "var(--text-muted)",
                            margin: 0,
                        }}>
                            从菜谱生成，或创建自定义清单
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "12px 24px",
                                borderRadius: 16,
                                background: "var(--accent)",
                                boxShadow: "var(--shadow-raised)",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#fff",
                                transition: "all 0.25s ease",
                                marginTop: 8,
                            }}
                        >
                            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> 新建自定义清单
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
                        {lists.map(list => {
                            const checked = list.items.filter(i => i.checked).length;
                            const total = list.items.length;
                            const allDone = total > 0 && checked === total;

                            return (
                                <div
                                    key={list.id}
                                    style={{
                                        padding: 16,
                                        borderRadius: 18,
                                        background: allDone ? "var(--green)" : "var(--bg)",
                                        boxShadow: allDone ? "var(--shadow-raised)" : "var(--shadow-raised)",
                                        transition: "all 0.25s ease",
                                        opacity: allDone ? 0.85 : 1,
                                        ...(allDone ? { background: "color-mix(in srgb, var(--green) 10%, var(--bg))" } : {}),
                                    }}
                                >
                                    {/* List header */}
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 8,
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{
                                                fontSize: 15,
                                                fontWeight: 700,
                                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                                color: "var(--text)",
                                                margin: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}>
                                                {list.source_recipe_names?.join("、") || "购物清单"}
                                            </h3>
                                            <p style={{
                                                fontSize: 11,
                                                color: "var(--text-muted)",
                                                margin: "4px 0 0",
                                            }}>
                                                {new Date(list.created_at).toLocaleDateString("zh-CN")} · {total} 种食材
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleCopy(list)}
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 10,
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    color: "var(--text-muted)",
                                                    fontSize: 13,
                                                    transition: "all 0.25s ease",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                                            >
                                                📋
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(list, e)}
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 10,
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    color: "var(--text-muted)",
                                                    fontSize: 13,
                                                    transition: "all 0.25s ease",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.color = "var(--rose)")}
                                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 12,
                                    }}>
                                        <div style={{
                                            flex: 1,
                                            height: 7,
                                            borderRadius: 999,
                                            background: "var(--bg)",
                                            boxShadow: "var(--shadow-inset-sm)",
                                            overflow: "hidden",
                                        }}>
                                            <div style={{
                                                height: "100%",
                                                borderRadius: 999,
                                                width: `${total > 0 ? (checked / total) * 100 : 0}%`,
                                                background: allDone ? "var(--green)" : "var(--accent)",
                                                transition: "all 0.25s ease",
                                            }} />
                                        </div>
                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: allDone ? "var(--green)" : "var(--text-muted)",
                                            flexShrink: 0,
                                            transition: "all 0.25s ease",
                                        }}>
                                            {allDone ? "全部购齐 ✓" : `${checked}/${total}`}
                                        </span>
                                    </div>

                                    {/* Ingredient list */}
                                    {(() => {
                                        const isLong = total > 8;
                                        const isCollapsed = collapsed.has(list.id);
                                        const visible = isLong && !isCollapsed ? list.items.slice(0, 8) : list.items;

                                        return (
                                            <>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    {visible.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleToggle(list.id, item.id)}
                                                            style={{
                                                                width: "100%",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 12,
                                                                padding: "10px 10px",
                                                                borderRadius: 14,
                                                                background: "transparent",
                                                                border: "none",
                                                                cursor: "pointer",
                                                                transition: "all 0.25s ease",
                                                                textAlign: "left",
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                                        >
                                                            {/* Checkbox */}
                                                            <div style={{
                                                                width: 22,
                                                                height: 22,
                                                                borderRadius: 8,
                                                                flexShrink: 0,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontSize: 12,
                                                                fontWeight: 700,
                                                                transition: "all 0.25s ease",
                                                                ...(item.checked
                                                                    ? {
                                                                        background: "var(--green)",
                                                                        boxShadow: "var(--shadow-raised-xs)",
                                                                        color: "#fff",
                                                                    }
                                                                    : {
                                                                        background: "var(--bg)",
                                                                        boxShadow: "var(--shadow-raised-sm)",
                                                                        color: "transparent",
                                                                    }),
                                                            }}>
                                                                {item.checked ? "✓" : ""}
                                                            </div>
                                                            <span style={{
                                                                fontSize: 14,
                                                                flex: 1,
                                                                color: item.checked ? "var(--text-muted)" : "var(--text)",
                                                                textDecoration: item.checked ? "line-through" : "none",
                                                                textDecorationColor: item.checked ? "var(--green)" : undefined,
                                                                transition: "all 0.25s ease",
                                                            }}>
                                                                {item.ingredient_name}
                                                            </span>
                                                            <span style={{
                                                                fontSize: 11,
                                                                color: "var(--text-muted)",
                                                                flexShrink: 0,
                                                            }}>
                                                                {item.required_amount}{item.unit}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                                {isLong && (
                                                    <button
                                                        onClick={() => handleToggleCollapse(list.id)}
                                                        style={{
                                                            marginTop: 4,
                                                            width: "100%",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: 4,
                                                            padding: "6px 0",
                                                            background: "transparent",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            fontSize: 11,
                                                            color: "var(--text-muted)",
                                                            transition: "all 0.25s ease",
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                                                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                                                    >
                                                        {isCollapsed ? (
                                                            <>▴ 收起 ({total} 种食材)</>
                                                        ) : (
                                                            <>▾ 展开剩余 {total - 8} 种食材</>
                                                        )}
                                                    </button>
                                                )}
                                            </>
                                        );
                                    })()}

                                    {/* All done action */}
                                    {allDone && (
                                        <button
                                            onClick={(e) => handleDelete(list, e)}
                                            style={{
                                                marginTop: 12,
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 8,
                                                padding: "12px 0",
                                                borderRadius: 16,
                                                background: "var(--green)",
                                                boxShadow: "var(--shadow-raised-sm)",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: "#fff",
                                                transition: "all 0.25s ease",
                                            }}
                                        >
                                            ✓ 全部购齐，删除清单
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create custom list modal */}
            {showCreate && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 50,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0, 0, 0, 0.35)",
                        backdropFilter: "blur(6px)",
                        padding: 16,
                        animation: "fade-in 0.2s ease",
                    }}
                    onClick={() => setShowCreate(false)}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 448,
                            borderRadius: 24,
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-raised-lg)",
                            padding: 24,
                            animation: "scale-in 0.25s ease both",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 16,
                        }}>
                            <h3 style={{
                                fontSize: 16,
                                fontWeight: 700,
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                color: "var(--text)",
                                margin: 0,
                            }}>
                                新建自定义清单
                            </h3>
                            <button
                                onClick={() => setShowCreate(false)}
                                style={{
                                    padding: 4,
                                    borderRadius: 10,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    fontSize: 18,
                                    lineHeight: 1,
                                    transition: "all 0.25s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                                ✕
                            </button>
                        </div>

                        <label style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: 8,
                        }}>
                            清单名称
                        </label>
                        <input
                            type="text"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="如：周末采购、烘焙材料..."
                            onFocus={() => setFocusedInput("title")}
                            onBlur={() => setFocusedInput(null)}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                marginBottom: 16,
                                borderRadius: 14,
                                border: "none",
                                outline: "none",
                                background: "var(--bg)",
                                boxShadow: focusedInput === "title" ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
                                fontSize: 14,
                                color: "var(--text)",
                                transition: "all 0.25s ease",
                            }}
                        />

                        <label style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: 8,
                        }}>
                            食材列表
                        </label>
                        <p style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            margin: "0 0 8px",
                        }}>
                            每行一种食材，格式：<code style={{
                                background: "var(--bg)",
                                boxShadow: "var(--shadow-inset-xs)",
                                padding: "2px 6px",
                                borderRadius: 6,
                                fontSize: 10,
                            }}>食材名 数量 单位</code>（如"番茄 3 个"）
                        </p>
                        <textarea
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder={"鸡蛋 12 个\n牛奶 2 升\n面包 1 袋\n苹果 5 个"}
                            rows={8}
                            onFocus={() => setFocusedInput("items")}
                            onBlur={() => setFocusedInput(null)}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 14,
                                border: "none",
                                outline: "none",
                                background: "var(--bg)",
                                boxShadow: focusedInput === "items" ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
                                fontSize: 14,
                                color: "var(--text)",
                                resize: "none",
                                transition: "all 0.25s ease",
                                fontFamily: "inherit",
                            }}
                        />

                        <button
                            onClick={handleCreateList}
                            style={{
                                marginTop: 16,
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "14px 0",
                                borderRadius: 16,
                                background: "var(--accent)",
                                boxShadow: "var(--shadow-raised-sm)",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#fff",
                                transition: "all 0.25s ease",
                            }}
                        >
                            ✓ 创建清单
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
