function getBase(): string {
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
  const base = getBase();
  if (!base) return "";
  return base;
}

/** 获取后端端口号（用于运行时动态拼接） */
export function apiPort(): string {
  try { return new URL(getBase()).port || "8001"; } catch { return "8001"; }
}
