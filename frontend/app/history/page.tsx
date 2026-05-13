"use client";

import {useState, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import {ChatHistorySession, ViewHistoryItem, CookHistoryItem} from "@/types/history";
import {
    loadChatHistory, loadViewHistory, loadCookHistory,
    deleteChatSession, clearViewHistory, deleteCookRecord,
    HISTORY_CHANGE_EVENT,
} from "@/lib/historyStore";
import {showToast} from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";

type TabKey = "chat" | "view" | "cook";

const TABS: {key: TabKey; label: string; icon: string}[] = [
    {key: "chat", label: "对话历史", icon: "💬"},
    {key: "view", label: "浏览记录", icon: "📖"},
    {key: "cook", label: "烹饪记录", icon: "👨‍🍳"},
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
    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    backBtn: {
        width: "36px",
        height: "36px",
        borderRadius: "12px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        fontSize: "16px",
        color: "var(--text)",
        transition: "all 0.25s ease",
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
        transition: "all 0.25s ease",
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
        transition: "all 0.25s ease",
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
        background: "var(--bg)",
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
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
        transition: "all 0.25s ease",
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
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--accent)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    iconBtn: {
        padding: "10px",
        borderRadius: "14px",
        border: "none",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--text-muted)",
        fontSize: "14px",
        cursor: "pointer",
        transition: "all 0.25s ease",
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
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        color: "var(--accent)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    clearBtn: {
        background: "none",
        border: "none",
        fontSize: "10px",
        color: "var(--text-muted)",
        cursor: "pointer",
        transition: "all 0.25s ease",
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
        transition: "all 0.25s ease",
        background: active ? "var(--accent)" : "var(--bg)",
        color: active ? "#fff" : "var(--text-muted)",
        boxShadow: active ? "var(--shadow-raised)" : "var(--shadow-raised-xs)",
    };
}

function deleteBtnHoverStyle(hover: boolean): React.CSSProperties {
    return {
        ...styles.iconBtn,
        color: hover ? "var(--rose)" : "var(--text-muted)",
        boxShadow: hover ? "var(--shadow-inset-sm)" : "var(--shadow-raised-sm)",
    };
}

export default function HistoryPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabKey>("chat");
    const [chatHistory, setChatHistory] = useState<ChatHistorySession[]>([]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [cookHistory, setCookHistory] = useState<CookHistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [hoveredDelete, setHoveredDelete] = useState<string | null>(null);

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
        deleteChatSession(sessionId);
        showToast("对话已删除", "info");
    }, []);

    const handleClearViews = useCallback(() => {
        clearViewHistory();
        showToast("浏览记录已清除", "info");
    }, []);

    const handleDeleteCook = useCallback((id: string) => {
        deleteCookRecord(id);
        showToast("烹饪记录已删除", "info");
    }, []);

    const filteredChat = searchQuery.trim()
        ? chatHistory.filter((s) => s.preview.includes(searchQuery) || s.messages.some((m) => m.content.includes(searchQuery)))
        : chatHistory;

    const filteredView = searchQuery.trim()
        ? viewHistory.filter((v) => v.recipe_name.includes(searchQuery))
        : viewHistory;

    const filteredCook = searchQuery.trim()
        ? cookHistory.filter((c) => c.recipe_name.includes(searchQuery) || c.notes.includes(searchQuery))
        : cookHistory;

    return (
        <AuthGuard>
        <div style={styles.page}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <div style={styles.headerLeft}>
                        <button onClick={() => router.back()} style={styles.backBtn}>
                            <span>←</span>
                        </button>
                        <div>
                            <h1 style={styles.headerTitle}>历史记录</h1>
                            <p style={styles.headerSub}>对话、浏览和烹饪记录</p>
                        </div>
                    </div>
                </div>
            </header>

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
                    <span style={styles.searchIcon}>🔍</span>
                    <input
                        type="text"
                        placeholder="搜索记录..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        style={{
                            ...styles.searchInput,
                            boxShadow: searchFocused
                                ? "var(--shadow-inset-focus)"
                                : "var(--shadow-inset-sm)",
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            style={styles.searchClear}
                        >
                            ✕
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
                                <div style={styles.emptyIcon}>💬</div>
                                <h3 style={styles.emptyTitle}>没有对话历史</h3>
                                <p style={styles.emptyDesc}>开始和AI对话后会自动记录</p>
                            </div>
                        ) : (
                            filteredChat.map((session) => (
                                <div key={session.session_id} style={styles.card}>
                                    <div style={styles.metaRow}>
                                        <span style={{fontSize: "11px"}}>📅</span>
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
                                            <span>💬</span> 继续对话
                                        </button>
                                        <button
                                            onClick={() => handleDeleteChat(session.session_id)}
                                            onMouseEnter={() => setHoveredDelete(session.session_id)}
                                            onMouseLeave={() => setHoveredDelete(null)}
                                            style={deleteBtnHoverStyle(hoveredDelete === session.session_id)}
                                        >
                                            🗑
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
                                <div style={styles.emptyIcon}>📖</div>
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
                                                <span>📖</span> 查看
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
                    <div style={styles.listGap}>
                        {filteredCook.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>👨‍🍳</div>
                                <h3 style={styles.emptyTitle}>没有烹饪记录</h3>
                                <p style={styles.emptyDesc}>做完菜后可记录评分和笔记</p>
                            </div>
                        ) : (
                            filteredCook.map((item) => (
                                <div key={item.id} style={styles.card}>
                                    <div style={styles.cookHeader}>
                                        <div style={styles.cookBody}>
                                            <div style={styles.cookDate}>
                                                <span style={{fontSize: "11px"}}>📅</span>
                                                <span style={styles.metaText}>{item.cook_date}</span>
                                            </div>
                                            <p style={styles.cookName}>{item.recipe_name}</p>
                                            <div style={styles.starRow}>
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <span
                                                        key={s}
                                                        style={{
                                                            fontSize: "14px",
                                                            color: s <= item.rating
                                                                ? "var(--golden)"
                                                                : "var(--text-placeholder)",
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        ★
                                                    </span>
                                                ))}
                                            </div>
                                            {item.notes && (
                                                <p style={styles.notes}>{item.notes}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteCook(item.id)}
                                            onMouseEnter={() => setHoveredDelete(item.id)}
                                            onMouseLeave={() => setHoveredDelete(null)}
                                            style={deleteBtnHoverStyle(hoveredDelete === item.id)}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
        </AuthGuard>
    );
}
