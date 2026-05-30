"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title = "确认操作",
  message,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380,
          background: "var(--surface)", borderRadius: 24,
          boxShadow: "var(--shadow-raised-lg)", overflow: "hidden",
          animation: "scaleIn 0.2s ease both",
        }}
      >
        <div style={{ padding: "20px 20px 12px" }}>
          <h3 style={{
            fontSize: 16, fontWeight: 700, color: "var(--text)",
            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          }}>{title}</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.6 }}>{message}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px 20px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 12,
              background: "var(--surface)", color: "var(--text-secondary)",
              fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 12,
              background: "var(--rose)", color: "#fff",
              fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(212,86,74,0.2)",
              transition: "var(--transition)",
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}

export default ConfirmDialog;
