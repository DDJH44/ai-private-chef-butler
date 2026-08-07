"use client";

import { useState, useEffect } from "react";
import { getFeishuConfig } from "@/lib/feishuApi";
import { useAuth } from "@/hooks/useAuth";

export function useFeishuStatus() {
  const { token } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getFeishuConfig()
      .then(cfg => { setConfigured(cfg.configured); setEnabled(cfg.enabled); })
      .catch((e) => { console.warn('获取飞书配置失败:', e); })
      .finally(() => setLoading(false));
  }, [token]);

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    getFeishuConfig()
      .then(cfg => { setConfigured(cfg.configured); setEnabled(cfg.enabled); })
      .catch((e) => { console.warn('刷新飞书配置失败:', e); })
      .finally(() => setLoading(false));
  };

  return { configured, enabled, loading, refresh };
}
