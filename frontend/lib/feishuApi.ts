import { getToken } from './authStore';

const BASE = '/api/v1/feishu';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export interface FeishuConfig {
  configured: boolean;
  has_global: boolean;
  webhook_url_masked?: string;
  onboarding_step: string;
  enabled: boolean;
  created_at?: number;
  onboarding?: {
    step: number;
    title: string;
    steps: Array<{ num: number; title: string; desc: string }>;
  };
}

export async function getFeishuConfig(): Promise<FeishuConfig> {
  const resp = await fetch(`${BASE}/config`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('获取飞书配置失败');
  return resp.json();
}

export async function saveFeishuConfig(webhook_url: string): Promise<{ message: string; onboarding_step: string }> {
  const resp = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ webhook_url }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || '保存失败');
  }
  return resp.json();
}

export async function testFeishuConnection(webhook_url?: string): Promise<{ message: string; enabled: boolean }> {
  const resp = await fetch(`${BASE}/test`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(webhook_url ? { webhook_url } : {}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || '测试失败');
  }
  return resp.json();
}

export async function toggleFeishu(): Promise<{ enabled: boolean }> {
  const resp = await fetch(`${BASE}/toggle`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error('切换失败');
  return resp.json();
}

export async function disconnectFeishu(): Promise<void> {
  const resp = await fetch(`${BASE}/config`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error('断开连接失败');
}
