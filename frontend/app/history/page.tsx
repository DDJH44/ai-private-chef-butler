"use client";

import {useState, useEffect, useCallback, useMemo, useDeferredValue} from "react";
import {useRouter} from "next/navigation";
import {ChatHistorySession, ViewHistoryItem, CookHistoryItem} from "@/types/history";
import {
    loadChatHistory, loadViewHistory, loadCookHistory,
    deleteChatSession, clearViewHistory, deleteCookRecord,
    HISTORY_CHANGE_EVENT,
} from "@/lib/historyStore";
import {showToast} from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import ConfirmDialog from "@/components/ConfirmDialog";
import DatePicker from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { MessageCircle, BookOpen, ChefHat, Search, X, Trash2, Star, Calendar } from "lucide-react";

type TabKey = "chat" | "view" | "cook";

const TABS: {key: TabKey; label: string; icon: React.ReactNode}[] = [
    {key: "chat", label: "对话历史", icon: <MessageCircle size={18} strokeWidth={1.8} />},
    {key: "view", label: "浏览记录", icon: <BookOpen size={18} strokeWidth={1.8} />},
    {key: "cook", label: "烹饪记录", icon: <ChefHat size={18} strokeWidth={1.8} />},
];

const styles = {
    page: {
        display: "flex",
        flexDirection: "column" as const,
        height: "100%",
        background: "var(--bg)",
    },
    header: {
        flexShrink: 0,
        padding: "14px 24px",
        background: "var(--surface)",
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
    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    backBtn: {
        width: "36px",
        height: "36px",
        borderRadius: "12px",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        fontSize: "16px",
        color: "var(--text)",
        transition: "var(--transition)",
    },
    headerTitle: {
        fontSize: "15px",
        fontWeight: 700,
        color: "var(--text)",
        letterSpacing: "-0.01em",
        fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
        margin: 0,
    },
    headerSub: {
        fontSize: "11px",
        color: "var(--text-muted)",
        marginTop: "2px",
        margin: 0,
    },
    tabBarWrap: {
        flexShrink: 0,
        padding: "12px 16px 8px",
        maxWidth: "1280px",
        width: "100%",
        margin: "0 auto",
    },
    tabTrack: {
        display: "flex",
        gap: "6px",
        padding: "4px",
        borderRadius: "16px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset)",
    },
    searchWrap: {
        position: "relative" as const,
        marginTop: "10px",
    },
    searchIcon: {
        position: "absolute" as const,
        left: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        fontSize: "14px",
        color: "var(--text-placeholder)",
        pointerEvents: "none" as const,
    },
    searchInput: {
        width: "100%",
        padding: "10px 36px 10px 38px",
        borderRadius: "14px",
        border: "none",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        fontSize: "14px",
        color: "var(--text)",
        outline: "none",
        transition: "var(--transition)",
        boxSizing: "border-box" as const,
    },
    searchClear: {
        position: "absolute" as const,
        right: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        padding: "4px",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        color: "var(--text-muted)",
        transition: "var(--transition)",
    },
    content: {
        flex: 1,
        overflowY: "auto" as const,
        padding: "8px 16px",
        maxWidth: "1280px",
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box" as const,
    },
    listGap: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "10px",
        paddingBottom: "16px",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "48px",
    },
    emptyIcon: {
        width: "56px",
        height: "56px",
        borderRadius: "18px",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "26px",
        marginBottom: "14px",
    },
    emptyTitle: {
        fontSize: "14px",
        fontWeight: 700,
        color: "var(--text)",
        marginBottom: "4px",
        fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
    },
    emptyDesc: {
        fontSize: "12px",
        color: "var(--text-muted)",
    },
    card: {
        padding: "16px",
        borderRadius: "18px",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised)",
        transition: "var(--transition)",
    },
    metaRow: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "8px",
    },
    metaText: {
        fontSize: "10px",
        color: "var(--text-muted)",
    },
    preview: {
        fontSize: "12px",
        color: "var(--text)",
        lineHeight: "1.6",
        marginBottom: "12px",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
    },
    btnRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    primaryBtn: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "10px",
        borderRadius: "14px",
        border: "none",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--accent)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "var(--transition)",
    },
    iconBtn: {
        padding: "10px",
        borderRadius: "14px",
        border: "none",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--text-muted)",
        fontSize: "14px",
        cursor: "pointer",
        transition: "var(--transition)",
    },
    viewRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    viewName: {
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--text)",
    },
    viewMeta: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginTop: "4px",
    },
    viewBtn: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 12px",
        borderRadius: "14px",
        border: "none",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--accent)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "var(--transition)",
    },
    clearBtn: {
        background: "none",
        border: "none",
        fontSize: "10px",
        color: "var(--text-muted)",
        cursor: "pointer",
        transition: "var(--transition)",
        alignSelf: "flex-end",
        marginBottom: "4px",
    },
    starRow: {
        display: "flex",
        alignItems: "center",
        gap: "2px",
        marginTop: "4px",
    },
    notes: {
        fontSize: "12px",
        color: "var(--text-secondary)",
        marginTop: "6px",
        lineHeight: "1.5",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
    },
    cookHeader: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    cookBody: {
        flex: 1,
    },
    cookDate: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "4px",
    },
    cookName: {
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--text)",
    },
} as const;

function tabBtnStyle(active: boolean): React.CSSProperties {
    return {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "10px",
        borderRadius: "14px",
        border: "none",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "var(--transition)",
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-muted)",
        boxShadow: active ? "var(--shadow-raised)" : "var(--shadow-raised-xs)",
    };
}

export default function HistoryPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabKey>("chat");
    const [chatHistory, setChatHistory] = useState<ChatHistorySession[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [cookHistory, setCookHistory] = useState<CookHistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const deferredQuery = useDeferredValue(searchQuery);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterMonth, setFilterMonth] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ title: string; message: string; action: () => void } | null>(null);

    const refresh = useCallback(() => {
        setChatHistory(loadChatHistory());
        setViewHistory(loadViewHistory());
        setCookHistory(loadCookHistory());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const handler = () => refresh();
        window.addEventListener(HISTORY_CHANGE_EVENT, handler);
        return () => window.removeEventListener(HISTORY_CHANGE_EVENT, handler);
    }, [refresh]);

    const handleDeleteChat = useCallback((sessionId: string) => {
        setConfirmDelete({
            title: "删除对话",
            message: "确定要删除这个对话吗？此操作不可撤销。",
            action: () => {
                deleteChatSession(sessionId);
                showToast("对话已删除", "info");
            },
        });
    }, []);

    const handleClearViews = useCallback(() => {
        setConfirmDelete({
            title: "清除全部浏览记录",
            message: "确定要清除所有浏览记录吗？此操作不可撤销。",
            action: () => {
                clearViewHistory();
                showToast("浏览记录已清除", "info");
            },
        });
    }, []);

    const handleDeleteCook = useCallback((id: string) => {
        setConfirmDelete({
            title: "删除烹饪记录",
            message: "确定要删除这条烹饪记录吗？此操作不可撤销。",
            action: () => {
                deleteCookRecord(id);
                showToast("烹饪记录已删除", "info");
            },
        });
    }, []);

    const filteredChat = useMemo(() => deferredQuery.trim()
        ? chatHistory.filter((s) => s.preview.includes(deferredQuery) || s.messages.some((m) => m.content.includes(deferredQuery)))
        : chatHistory, [chatHistory, deferredQuery]);

    const filteredView = useMemo(() => deferredQuery.trim()
        ? viewHistory.filter((v) => v.recipe_name.includes(deferredQuery))
        : viewHistory, [viewHistory, deferredQuery]);

    const filteredCook = useMemo(() => {
        let list = cookHistory;
        if (deferredQuery.trim()) {
            list = list.filter((c) => c.recipe_name.includes(deferredQuery) || c.notes.includes(deferredQuery));
        }
        if (filterMonth) {
            list = list.filter((c) => (c.cook_date || "").startsWith(filterMonth));
        }
        return list;
    }, [cookHistory, deferredQuery, filterMonth]);

    return (
        <AuthGuard>
        <div style={styles.page}>
            <PageHeader title="历史记录" subtitle="查看和管理你的历史数据" />

            {/* Tab bar + search */}
            <div style={styles.tabBarWrap}>
                <div style={styles.tabTrack}>
                    {TABS.map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={tabBtnStyle(active)}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div style={styles.searchWrap}>
                    <Search size={16} strokeWidth={1.8} style={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="搜索记录..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                        style={styles.searchInput}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            aria-label="清空搜索"
                            style={styles.searchClear}
                        >
                                <X size={14} strokeWidth={1.8} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={styles.content}>
                {/* Chat tab */}
                {activeTab === "chat" && (
                    <div style={styles.listGap}>
                        {filteredChat.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}><MessageCircle size={32} strokeWidth={1.5} /></div>
                                <h3 style={styles.emptyTitle}>没有对话历史</h3>
                                <p style={styles.emptyDesc}>开始和AI对话后会自动记录</p>
                            </div>
                        ) : (
                            filteredChat.map((session) => (
                                <div key={session.session_id} style={styles.card}>
                                    <div style={styles.metaRow}>
                                        <Calendar size={14} strokeWidth={1.8} />
                                        <span style={styles.metaText}>
                                            {new Date(session.created_at).toLocaleString("zh-CN")}
                                        </span>
                                        <span style={styles.metaText}>
                                            · {session.message_count}条
                                        </span>
                                    </div>
                                    <p style={styles.preview}>{session.preview}</p>
                                    <div style={styles.btnRow}>
                                        <button
                                            onClick={() => router.push(`/?thread=${session.session_id}`)}
                                            style={styles.primaryBtn}
                                        >
                                            <MessageCircle size={14} strokeWidth={1.8} /> 继续对话
                                        </button>
                                        <button
                                            onClick={() => handleDeleteChat(session.session_id)}
                                            aria-label="删除对话"
                                            className="hover-rose" style={{...styles.iconBtn, color: "var(--text-muted)", boxShadow: "var(--shadow-raised-sm)"}}
                                        >
                                            <Trash2 size={14} strokeWidth={1.8} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* View tab */}
                {activeTab === "view" && (
                    <div style={styles.listGap}>
                        {filteredView.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}><BookOpen size={32} strokeWidth={1.5} /></div>
                                <h3 style={styles.emptyTitle}>没有浏览记录</h3>
                                <p style={styles.emptyDesc}>浏览菜谱后会自动记录</p>
                            </div>
                        ) : (
                            <>
                                <button onClick={handleClearViews} style={styles.clearBtn}>
                                    清除全部
                                </button>
                                {filteredView.map((item) => (
                                    <div key={item.recipe_id} style={styles.card}>
                                        <div style={styles.viewRow}>
                                            <div>
                                                <p style={styles.viewName}>{item.recipe_name}</p>
                                                <div style={styles.viewMeta}>
                                                    <span style={styles.metaText}>
                                                        浏览 {item.view_count} 次
                                                    </span>
                                                    <span style={styles.metaText}>
                                                        {new Date(item.last_viewed_at).toLocaleDateString("zh-CN")}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => router.push("/recipes")}
                                                style={styles.viewBtn}
                                            >
                                                <BookOpen size={14} strokeWidth={1.8} /> 查看
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Cook tab */}
                {activeTab === "cook" && (
                    <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 8px" }}>
                        <button
                            onClick={() => setShowDatePicker(true)}
                            style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "6px 12px", borderRadius: 10,
                                background: "var(--surface)", boxShadow: "var(--shadow-raised-sm)",
                                border: "none", cursor: "pointer", fontSize: 13,
                                fontWeight: 500, color: "var(--accent)",
                                fontFamily: "inherit", touchAction: "manipulation",
                            }}
                        >
                            <Calendar size={14} strokeWidth={1.8} /> 按月份筛选
                        </button>
                    </div>
                    {filterMonth && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "0 4px 8px", fontSize: 13, color: "var(--text-secondary)",
                        }}>
                            <span>筛选：{filterMonth.replace("-", "年")}月</span>
                            <button onClick={() => setFilterMonth(null)} style={{
                                padding: "2px 8px", borderRadius: 8, border: "none",
                                background: "var(--surface)", boxShadow: "var(--shadow-raised-sm)",
                                cursor: "pointer", fontSize: 12, color: "var(--rose)",
                                fontFamily: "inherit", touchAction: "manipulation",
                            }}>清除</button>
                        </div>
                    )}
                    <div style={styles.listGap}>
                        {filteredCook.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}><ChefHat size={32} strokeWidth={1.5} /></div>
                                <h3 style={styles.emptyTitle}>没有烹饪记录</h3>
                                <p style={styles.emptyDesc}>做完菜后可记录评分和笔记</p>
                            </div>
                        ) : (
                            filteredCook.map((item) => (
                                <div key={item.id} style={styles.card}>
                                    <div style={styles.cookHeader}>
                                        <div style={styles.cookBody}>
                                            <div style={styles.cookDate}>
                                                <Calendar size={14} strokeWidth={1.8} />
                                                <span style={styles.metaText}>{item.cook_date}</span>
                                            </div>
                                            <p style={styles.cookName}>{item.recipe_name}</p>
                                            <div style={styles.starRow}>
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <Star
                                                        key={s}
                                                        size={14}
                                                        strokeWidth={1.8}
                                                        fill={s <= item.rating ? "var(--golden)" : "none"}
                                                        style={{
                                                            color: s <= item.rating
                                                                ? "var(--golden)"
                                                                : "var(--text-placeholder)",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            {item.notes && (
                                                <p style={styles.notes}>{item.notes}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCook(item.id)}
                                            aria-label="删除烹饪记录"
                                            className="hover-rose" style={{...styles.iconBtn, color: "var(--text-muted)", boxShadow: "var(--shadow-raised-sm)"}}
                                        >
                                            <Trash2 size={14} strokeWidth={1.8} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    </>
                )}
            </div>
        </div>
            {showDatePicker && (
                <DatePicker
                    value={filterMonth ? new Date(filterMonth + "-01") : new Date()}
                    onChange={(date) => {
                        setFilterMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
                        setShowDatePicker(false);
                    }}
                    onClose={() => setShowDatePicker(false)}
                />
            )}

            {confirmDelete && (
                <ConfirmDialog
                    isOpen={!!confirmDelete}
                    title={confirmDelete.title}
                    message={confirmDelete.message}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => {
                        confirmDelete.action();
                        setConfirmDelete(null);
                    }}
                />
            )}

        </AuthGuard>
    );
}
