"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  maxWidth?: string | number;
}

export function PageHeader({ title, subtitle, rightAction, maxWidth }: PageHeaderProps) {
  const router = useRouter();
  return (
    <header
      style={{
        flexShrink: 0,
        padding: "14px 16px",
        background: "var(--surface)",
        boxShadow: "var(--shadow-raised)",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: maxWidth || 1280,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 36,
              height: 36,
              background: "var(--surface)",
              borderRadius: 14,
              boxShadow: "var(--shadow-raised-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--text)",
              transition: "var(--transition)",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div>
            <h1
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: "-0.02em",
                margin: 0,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "2px 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightAction}
      </div>
    </header>
  );
}
