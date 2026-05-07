const BASE = process.env.NEXT_PUBLIC_API_URL || "";

/** 拼接 API 完整路径，如 apiPath("/v1/recipes") → "http://127.0.0.1:8001/api/v1/recipes" */
export function apiPath(path: string): string {
  return `${BASE}/api${path}`;
}

/** 纯后端 origin，用于 img src 等非 fetch 场景 */
export function apiOrigin(): string {
  if (!BASE) return "";
  return BASE;
}

/** 获取后端端口号（用于运行时动态拼接） */
export function apiPort(): string {
  try { return new URL(BASE).port || "8001"; } catch { return "8001"; }
}
