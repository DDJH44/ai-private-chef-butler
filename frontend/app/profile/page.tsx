"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";
import { FeishuSettings } from "@/components/FeishuSettings";

const menuItems = [
    {
        href: "/preferences",
        emoji: "❤",
        title: "口味偏好",
        description: "忌口、过敏源、口味倾向、家庭成员",
    },
    {
        href: "/history",
        emoji: "⏱",
        title: "历史记录",
        description: "对话历史、浏览记录、烹饪记录",
    },
    {
        href: "/shopping-list",
        emoji: "🛒",
        title: "购物清单",
        description: "查看和管理你的购物清单",
    },
];

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout } = useAuth();

    const formatDate = (ts: number) => {
        return new Date(ts * 1000).toLocaleDateString("zh-CN");
    };

    return (
        <AuthGuard>
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "var(--bg)",
            }}
        >
            {/* Header */}
            <header
                style={{
                    flexShrink: 0,
                    padding: "14px 20px",
                    background: "var(--bg)",
                    boxShadow: "var(--shadow-raised)",
                    borderRadius: "0 0 24px 24px",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        maxWidth: "896px",
                        margin: "0 auto",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            onClick={() => router.back()}
                            style={{
                                width: "36px",
                                height: "36px",
                                background: "var(--bg)",
                                borderRadius: "14px",
                                boxShadow: "var(--shadow-raised-sm)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "18px",
                                color: "var(--text)",
                                transition: "all 0.25s ease",
                            }}
                        >
                            ←
                        </button>
                        <div>
                            <h1
                                style={{
                                    fontSize: "15px",
                                    fontWeight: 700,
                                    color: "var(--text)",
                                    letterSpacing: "-0.02em",
                                    margin: 0,
                                    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                }}
                            >
                                个人中心
                            </h1>
                            <p
                                style={{
                                    fontSize: "11px",
                                    color: "var(--text-muted)",
                                    margin: "2px 0 0 0",
                                }}
                            >
                                管理你的偏好和数据
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px 16px",
                    maxWidth: "896px",
                    margin: "0 auto",
                    width: "100%",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* User Card — when logged in */}
                    {user ? (
                        <div
                            style={{
                                padding: "22px 20px",
                                borderRadius: "20px",
                                background: "var(--bg)",
                                boxShadow: "var(--shadow-raised-lg)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                                <div
                                    style={{
                                        width: 56, height: 56, borderRadius: 18,
                                        background: "var(--accent)", display: "flex", alignItems: "center",
                                        justifyContent: "center", fontSize: 28,
                                        boxShadow: "var(--shadow-raised)",
                                    }}
                                >
                                    👤
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                                        {user.username}
                                    </h2>
                                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                                        {user.email}
                                    </p>
                                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                                        注册于 {formatDate(user.created_at)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                style={{
                                    padding: "10px 18px", borderRadius: 12,
                                    background: "var(--bg)", color: "var(--rose)",
                                    boxShadow: "var(--shadow-raised-sm)", border: "none",
                                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                                }}
                                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                            >
                                退出登录
                            </button>
                        </div>
                    ) : (
                        /* Login/Register card — when not logged in */
                        <div
                            style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "18px 20px", borderRadius: "20px",
                                background: "var(--bg)", boxShadow: "var(--shadow-raised-lg)",
                            }}
                        >
                            <div
                                style={{
                                    width: 56, height: 56, borderRadius: 18,
                                    background: "var(--bg)", display: "flex", alignItems: "center",
                                    justifyContent: "center", fontSize: 28,
                                    boxShadow: "var(--shadow-inset)",
                                }}
                            >
                                👤
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
                                    登录后可同步数据
                                </p>
                            </div>
                            <Link
                                href="/login"
                                style={{
                                    padding: "10px 20px", background: "var(--accent)", color: "#fff",
                                    borderRadius: 14, fontSize: 14, fontWeight: 600, textDecoration: "none",
                                    boxShadow: "var(--shadow-accent)",
                                }}
                            >
                                登录
                            </Link>
                        </div>
                    )}

                    {/* Menu Items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {menuItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "14px",
                                    padding: "16px 18px",
                                    borderRadius: "16px",
                                    background: "var(--bg)",
                                    boxShadow: "var(--shadow-raised)",
                                    textDecoration: "none",
                                    color: "inherit",
                                    transition: "all 0.25s ease",
                                }}
                            >
                                <div
                                    style={{
                                        width: "42px",
                                        height: "42px",
                                        borderRadius: "14px",
                                        background: "var(--bg)",
                                        boxShadow: "var(--shadow-inset)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px",
                                        flexShrink: 0,
                                    }}
                                >
                                    {item.emoji}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3
                                        style={{
                                            fontSize: "14px",
                                            fontWeight: 600,
                                            color: "var(--text)",
                                            margin: 0,
                                        }}
                                    >
                                        {item.title}
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: "11px",
                                            color: "var(--text-muted)",
                                            margin: "2px 0 0 0",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {item.description}
                                    </p>
                                </div>
                                <span
                                    style={{
                                        fontSize: "16px",
                                        color: "var(--text-muted)",
                                        flexShrink: 0,
                                        opacity: 0.5,
                                    }}
                                >
                                    →
                                </span>
                            </Link>
                        ))}
                    </div>

                    {/* 飞书集成 — 仅登录后可见 */}
                    {user && <FeishuSettings />}
                </div>
            </div>
        </div>
        </AuthGuard>
    );
}
