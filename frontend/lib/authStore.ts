const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Also set as cookie so middleware / <img> requests can auth without custom headers
  const maxAge = 7 * 24 * 60 * 60; // 7 days, same as JWT expire
  const secure = location.protocol === "https:" ? ";secure" : "";
  document.cookie = `${TOKEN_KEY}=${token};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  // Clear the cookie too
  const secure = location.protocol === "https:" ? ";secure" : "";
  document.cookie = `${TOKEN_KEY}=;path=/;max-age=0;SameSite=Lax${secure}`;
}
