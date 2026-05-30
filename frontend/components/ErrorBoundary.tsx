"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", padding: 40,
          textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "var(--rose-bg)", display: "flex",
            alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <AlertTriangle size={28} strokeWidth={1.5} color="var(--rose)" />
          </div>
          <h2 style={{
            fontSize: 17, fontWeight: 700, color: "var(--text)",
            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            marginBottom: 6,
          }}>
            页面出现异常
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            请尝试刷新页面，或返回上一页
          </p>
          {this.state.error && (
            <details style={{ marginBottom: 20, maxWidth: 400 }}>
              <summary style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                查看错误详情
              </summary>
              <pre style={{
                fontSize: 11, color: "var(--rose)", textAlign: "left",
                background: "var(--bg)", padding: 10, borderRadius: 10,
                overflowX: "auto", marginTop: 8,
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.history.back()}
              style={{
                padding: "10px 22px", borderRadius: 14,
                background: "var(--surface)", color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "var(--shadow-raised-sm)",
              }}
            >
              ← 返回
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: "10px 22px", borderRadius: 14,
                background: "var(--accent)", color: "#fff",
                fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
