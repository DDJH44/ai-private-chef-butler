"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getFeishuConfig, saveFeishuConfig, testFeishuConnection,
  toggleFeishu, disconnectFeishu, type FeishuConfig,
} from "@/lib/feishuApi";
import { showToast } from "@/components/Toast";

export function FeishuSettings() {
  const [config, setConfig] = useState<FeishuConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const cfg = await getFeishuConfig();
      setConfig(cfg);
    } catch { /* 静默 */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!webhookUrl.trim()) return;
    setSaving(true);
    try {
      const res = await saveFeishuConfig(webhookUrl.trim());
      showToast("已保存", "success");
      setWebhookUrl("");
      load();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testFeishuConnection();
      showToast("测试消息已发送，请检查飞书", "success");
      load();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
    setTesting(false);
  };

  const handleToggle = async () => {
    try {
      const res = await toggleFeishu();
      showToast(res.enabled ? "飞书推送已开启" : "飞书推送已关闭", "success");
      load();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("确定要断开飞书连接吗？")) return;
    try {
      await disconnectFeishu();
      showToast("已断开飞书连接", "info");
      load();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const card: React.CSSProperties = {
    background: "var(--bg)", borderRadius: 20, padding: 24,
    boxShadow: "var(--shadow-raised)", marginBottom: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: 14,
    border: "none", outline: "none", fontSize: 14, color: "var(--text)",
    background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
    transition: "all 0.25s ease", boxSizing: "border-box",
  };

  if (loading) {
    return (
      <div style={card}>
        <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>加载中...</div>
      </div>
    );
  }

  if (!config) return null;

  // ── 未配置：显示引导步骤 ──
  if (!config.configured) {
    const steps = config.onboarding?.steps || [];
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🪽</div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0, fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif" }}>连接飞书</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>将饮食报告和菜谱推送到你的飞书群</p>
          </div>
        </div>

        {/* 步骤列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{
              display: "flex", gap: 14, padding: "12px 16px", borderRadius: 14,
              background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
              opacity: i === 0 ? 1 : 0.55, transition: "all 0.25s ease",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: i === 0 ? "var(--accent)" : "var(--bg)",
                color: i === 0 ? "#fff" : "var(--text-muted)",
                boxShadow: i === 0 ? "var(--shadow-raised-sm)" : "var(--shadow-inset-sm)",
              }}>
                {i === 0 ? "▶" : s.num}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Webhook URL 输入框 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Webhook 地址</label>
          <input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxx"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving || !webhookUrl.trim()}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700, color: "#fff",
              background: "var(--accent)", boxShadow: "var(--shadow-raised-sm)",
              opacity: saving || !webhookUrl.trim() ? 0.6 : 1, transition: "all 0.25s ease",
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
          {webhookUrl.trim() && (
            <button
              onClick={async () => {
                if (!webhookUrl.trim()) return;
                setSaving(true);
                try {
                  await saveFeishuConfig(webhookUrl.trim());
                  setTesting(true);
                  try {
                    await testFeishuConnection();
                    showToast("连接成功！", "success");
                    load();
                  } catch { showToast("已保存，请稍后测试", "info"); }
                  setTesting(false);
                } catch (e) {
                  showToast((e as Error).message, "error");
                }
                setSaving(false);
                setWebhookUrl("");
              }}
              disabled={saving}
              style={{
                padding: "12px 20px", borderRadius: 14, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600, color: "#fff",
                background: "#00d6b9", boxShadow: "var(--shadow-raised-sm)",
                opacity: saving ? 0.6 : 1, transition: "all 0.25s ease",
              }}
            >
              保存并测试
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── 已配置：显示状态管理 ──
  const stepLabels: Record<string, string> = {
    webhook_saved: "已填写地址",
    test_success: "已测试",
    active: "已激活",
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: config.enabled ? "#e6f7f1" : "var(--bg)", boxShadow: config.enabled ? "var(--shadow-raised-sm)" : "var(--shadow-inset-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            🪽
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0, fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif" }}>
              飞书集成
              <span style={{
                marginLeft: 10, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                background: config.enabled ? "#e6f7f1" : "var(--bg)",
                color: config.enabled ? "#00b37a" : "var(--text-muted)",
                boxShadow: "var(--shadow-inset-xs)",
              }}>
                {config.enabled ? "已开启" : "已关闭"}
              </span>
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{config.webhook_url_masked}</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button
          onClick={handleToggle}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600, transition: "all 0.25s ease",
            background: config.enabled ? "var(--bg)" : "var(--accent)",
            color: config.enabled ? "var(--text-secondary)" : "#fff",
            boxShadow: config.enabled ? "var(--shadow-raised-sm)" : "var(--shadow-accent)",
          }}
        >
          {config.enabled ? "暂停推送" : "开启推送"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600, color: "#00d6b9", opacity: testing ? 0.6 : 1,
            background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
          }}
        >
          {testing ? "发送中..." : "发送测试"}
        </button>
      </div>

      <button
        onClick={handleDisconnect}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 14, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 500, color: "var(--text-muted)",
          background: "transparent", transition: "all 0.25s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--rose)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        断开飞书连接
      </button>
    </div>
  );
}
