"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/profile";

  const handleSubmit = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("请填写所有字段");
      return;
    }
    if (username.trim().length < 2) {
      setError("用户名至少需要2个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要6个字符");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(username.trim(), email.trim(), password);
      router.replace(redirectTo);
    } catch (e) {
      setError((e as Error).message || "注册失败");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="flex-shrink-0 px-6 sm:px-8 lg:px-12 xl:px-20 py-4">
        <div className="flex items-center gap-5 max-w-5xl mx-auto">
          <button onClick={() => router.back()}
            style={{
              width: 42, height: 42, background: "var(--bg)", borderRadius: 14,
              boxShadow: "var(--shadow-raised-sm)", display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)",
            }}
          >←</button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>注册</h1>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div style={{
          width: "100%", maxWidth: 400, padding: 32,
          background: "var(--bg)", borderRadius: 24, boxShadow: "var(--shadow-raised-lg)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span style={{ fontSize: 40 }}>👨‍🍳</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 8 }}>创建账号</h2>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", background: "var(--rose-bg)", color: "var(--rose)",
              borderRadius: 12, fontSize: 13, marginBottom: 16, boxShadow: "var(--shadow-inset-sm)",
            }}>{error}</div>
          )}

          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="用户名" autoComplete="username"
            style={{
              width: "100%", padding: "14px 16px", background: "var(--bg)", border: "none",
              borderRadius: 14, boxShadow: "var(--shadow-inset-sm)", fontSize: 15, color: "var(--text)",
              outline: "none", marginBottom: 16, boxSizing: "border-box",
            }}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
          />

          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="邮箱" type="email" autoComplete="email"
            style={{
              width: "100%", padding: "14px 16px", background: "var(--bg)", border: "none",
              borderRadius: 14, boxShadow: "var(--shadow-inset-sm)", fontSize: 15, color: "var(--text)",
              outline: "none", marginBottom: 16, boxSizing: "border-box",
            }}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
          />

          <input value={password} onChange={e => setPassword(e.target.value)}
            type="password" placeholder="密码 (6位以上)" autoComplete="new-password"
            style={{
              width: "100%", padding: "14px 16px", background: "var(--bg)", border: "none",
              borderRadius: 14, boxShadow: "var(--shadow-inset-sm)", fontSize: 15, color: "var(--text)",
              outline: "none", marginBottom: 24, boxSizing: "border-box",
            }}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
          />

          <button onClick={handleSubmit} disabled={loading}
            style={{
              width: "100%", padding: "14px 0", background: "var(--accent)", color: "#fff",
              borderRadius: 14, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", opacity: loading ? 0.7 : 1, marginBottom: 20,
            }}
          >
            {loading ? "注册中..." : "注册"}
          </button>

          <div style={{ textAlign: "center" }}>
            <Link href="/login" style={{
              fontSize: 14, color: "var(--accent)", textDecoration: "none", fontWeight: 500,
            }}>
              已有账号？立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
