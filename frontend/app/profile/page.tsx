"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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

    return (
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
                    {/* Brand Card */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            padding: "18px 20px",
                            borderRadius: "20px",
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-raised-lg)",
                            transition: "all 0.25s ease",
                        }}
                    >
                        <div
                            style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "18px",
                                background: "var(--accent)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "28px",
                                boxShadow: "var(--shadow-raised)",
                            }}
                        >
                            👨‍🍳
                        </div>
                        <div>
                            <h2
                                style={{
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    color: "var(--text)",
                                    margin: 0,
                                    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                                }}
                            >
                                AI 私人厨师
                            </h2>
                            <p
                                style={{
                                    fontSize: "12px",
                                    color: "var(--text-secondary)",
                                    margin: "2px 0 0 0",
                                }}
                            >
                                你的专属美食助手
                            </p>
                        </div>
                    </div>

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
                </div>
            </div>
        </div>
    );
}
