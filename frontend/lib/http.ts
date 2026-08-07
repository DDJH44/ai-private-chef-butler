/**
 * 统一 HTTP 层 — 单一数据源
 * 所有 API base / auth header / 401 处理集中在此
 */
import { getToken } from './authStore';

/** 获取后端 API base URL */
export function getBase(): string {
  if (typeof window !== "undefined" && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }
  return process.env.NEXT_PUBLIC_API_URL || "";
}

/** 拼接 API 完整路径，如 apiPath("/v1/recipes") → "http://127.0.0.1:8001/api/v1/recipes" */
export function apiPath(path: string): string {
  return `${getBase()}/api${path}`;
}

/** 纯后端 origin，用于 img src 等非 fetch 场景 */
export function apiOrigin(): string {
  return getBase();
}

/** 获取后端端口号 */
export function apiPort(): string {
  try { return new URL(getBase()).port || "8001"; } catch { return "8001"; }
}

/** 鉴权过期处理：清 token + 跳登录页 */
export function handleAuthExpired(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  document.cookie = "auth_status=; path=/; max-age=0";
  window.location.href = "/login?reason=expired";
}

/** 统一 auth headers（不含 Content-Type，按需在外部添加） */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 带 Content-Type + auth 的 headers */
export function authJsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}

/**
 * 带认证的 fetch — 自动注入 auth header + 401 自动跳登录
 * 替代各 store 中裸 fetch + 自写 authHeaders 的模式
 */
export async function authFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const url = input.startsWith("http") || input.startsWith("/api/")
    ? (input.startsWith("http") ? input : `${getBase()}${input}`)
    : input;

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
    ...authHeaders(),
  };

  const resp = await fetch(url, { ...init, headers });

  if (resp.status === 401 && !url.includes("/api/v1/auth/")) {
    handleAuthExpired();
  }

  return resp;
}
