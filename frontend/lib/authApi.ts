import { request } from "./api";
import type { LoginRequest, RegisterRequest, AuthResponse, User } from "@/types/user";
import { getToken } from "./authStore";

const AUTH_BASE = "/api/v1/auth";

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>(`${AUTH_BASE}/login`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>(`${AUTH_BASE}/register`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  return request<User>(`${AUTH_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logout(): Promise<void> {
  const token = getToken();
  await request(`${AUTH_BASE}/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
