"use client";

import { Component, type ReactNode } from "react";

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
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: "var(--text)",
            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            marginBottom: 8,
          }}>
            页面出现异常
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
            请刷新页面重试
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: "12px 28px", borderRadius: 14,
              background: "var(--accent)", color: "#fff",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", fontFamily: "inherit",
              touchAction: "manipulation",
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
