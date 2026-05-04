"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    visible: boolean;
}

const TOAST_CONFIG = {
    success: {icon: "✓", color: "var(--green)"},
    error: {icon: "✕", color: "var(--rose)"},
    info: {icon: "ℹ", color: "var(--accent)"},
};

let toastListeners: Array<(msg: string, type: ToastType) => void> = [];

export function showToast(message: string, type: ToastType = "info") {
    toastListeners.forEach((fn) => fn(message, type));
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handler = (message: string, type: ToastType) => {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            setToasts((prev) => [...prev, {id, message, type, visible: true}]);
            setTimeout(() => {
                setToasts((prev) => prev.map((t) => t.id === id ? {...t, visible: false} : t));
                setTimeout(() => {
                    setToasts((prev) => prev.filter((t) => t.id !== id));
                }, 300);
            }, 2500);
        };
        toastListeners.push(handler);
        return () => {
            toastListeners = toastListeners.filter((fn) => fn !== handler);
        };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, pointerEvents: "none", width: "100%", maxWidth: 380, padding: "0 16px",
        }}>
            {toasts.map((toast) => {
                const config = TOAST_CONFIG[toast.type];
                return (
                    <div
                        key={toast.id}
                        style={{
                            pointerEvents: "auto",
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 16px", borderRadius: 16,
                            background: "var(--bg)", boxShadow: "var(--shadow-raised)",
                            transition: "all 0.3s ease", width: "100%",
                            opacity: toast.visible ? 1 : 0,
                            transform: toast.visible ? "translateY(0)" : "translateY(-8px)",
                        }}
                    >
                        <span style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700, color: config.color, flexShrink: 0,
                        }}>
                            {config.icon}
                        </span>
                        <span style={{ fontSize: 14, color: "var(--text)", flex: 1 }}>{toast.message}</span>
                        <button
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: 14, color: "var(--text-muted)", padding: 4,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
        </div>,
        document.body
    );
}
