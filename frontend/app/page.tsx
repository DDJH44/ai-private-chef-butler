"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { uploadImageToOss } from "@/lib/api";
import { Loading } from "@/components/Loading";
import {
  getChatState, subscribeToChat, initChat, newChat,
  sendMessage, stopGeneration, dismissRecipes, confirmSaveRecipes,
  saveCurrentSession,
} from "@/lib/chatStore";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { MultiRecipeSave } from "@/components/MultiRecipeSave";

function Home() {
  const searchParams = useSearchParams();
  const autoMessage = searchParams.get("msg");
  const resumeThread = searchParams.get("thread");

  const [, forceUpdate] = useState(0);
  const hasAutoSent = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevThread = useRef<string | null | undefined>(undefined);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    const unsub = subscribeToChat(() => forceUpdate((n) => n + 1));
    return () => {
      saveCurrentSession();
      unsub();
    };
  }, []);

  useEffect(() => {
    const target = resumeThread || null;
    if (prevThread.current === target) return;
    prevThread.current = target;
    initChat(target || undefined);
  }, [resumeThread]);

  const s = getChatState();

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [s.messages, scrollToBottom]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const diff = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(diff > 120);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (autoMessage && !hasAutoSent.current && s.threadId && !s.loading) {
      hasAutoSent.current = true;
      sendMessage(autoMessage);
    }
  }, [autoMessage, s.threadId, s.loading]);

  const handleSend = useCallback((content: string, imageUrl?: string) => {
    sendMessage(content, imageUrl);
  }, []);

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    try { return await uploadImageToOss(file); }
    catch { return null; }
  }, []);

  if (s.initialLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Header messagesLen={0} onNewChat={newChat} />
        <Loading fullPage text="加载中..." />
      </div>
    );
  }

  const hasMessages = s.messages.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      <Header messagesLen={s.messages.length} onNewChat={newChat} />

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {!hasMessages ? (
          <WelcomeScreen onSend={handleSend} />
        ) : (
          <div style={{ padding: "24px 24px 16px", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {s.messages.map((msg, i) => (
              <ChatMessage key={`${msg.id}-${i}`} message={msg} />
            ))}
            {s.recipesToSave && (
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <MultiRecipeSave
                  recipes={s.recipesToSave.recipes}
                  onConfirm={confirmSaveRecipes}
                  onCancel={dismissRecipes}
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom */}
        <div style={{
          position: "sticky", bottom: 16, left: 0, right: 0,
          display: "flex", justifyContent: "center", zIndex: 10,
          opacity: showScrollBtn ? 1 : 0, pointerEvents: showScrollBtn ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}>
          <button
            onClick={() => scrollToBottom()}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
              border: "none", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "var(--text-secondary)",
              transition: "all 0.25s ease",
            }}
          >↓</button>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: "0 24px 12px", maxWidth: 760, width: "100%", margin: "0 auto" }}>
        <ChatInput
          onSendMessage={handleSend}
          onImageUpload={handleImageUpload}
          disabled={s.loading}
          onStop={stopGeneration}
        />
      </div>
    </div>
  );
}

function Header({ messagesLen, onNewChat }: { messagesLen: number; onNewChat: () => void }) {
  return (
    <header style={{
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 24px", margin: "16px 24px 0", borderRadius: 20,
      background: "var(--bg)", boxShadow: "var(--shadow-raised)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          fontWeight: 700, fontSize: 17, color: "var(--text)",
        }}>对话</span>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--green)", boxShadow: "0 0 8px rgba(0,184,148,0.4)",
        }} />
      </div>
      {messagesLen > 0 && (
        <button
          onClick={onNewChat}
          style={{
            padding: "8px 16px", borderRadius: 12,
            background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
            border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 500, color: "var(--accent)",
            transition: "all 0.25s ease",
          }}
        >＋ 新对话</button>
      )}
    </header>
  );
}

function WelcomeScreen({ onSend }: { onSend: (msg: string) => void }) {
  const actions = [
    { icon: "🥗", text: "推荐几道家常菜" },
    { icon: "📷", text: "拍照识别食材" },
    { icon: "🧊", text: "冰箱有什么菜" },
    { icon: "📅", text: "规划一周膳食" },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100%", padding: "48px 20px",
    }}>
      {/* Hero */}
      <div style={{ marginBottom: 48, textAlign: "center", animation: "fadeUp 0.5s ease both" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, background: "var(--bg)", boxShadow: "var(--shadow-raised-lg)",
        }}>✨</div>
        <h2 style={{
          fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          fontWeight: 700, fontSize: 22, color: "var(--text)", marginBottom: 6,
        }}>今天想吃点什么？</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          拍照识别食材 · AI 智能推荐菜谱 · 膳食规划
        </p>
      </div>

      {/* Quick actions */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        width: "100%", maxWidth: 380,
      }}>
        {actions.map((item, i) => (
          <button
            key={i}
            onClick={() => onSend(item.text)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              padding: 20, borderRadius: 20,
              background: "var(--bg)", boxShadow: "var(--shadow-raised)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.25s ease",
              animation: `fadeUp 0.4s ease both ${0.1 + i * 0.08}s`,
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", lineHeight: 1.4, textAlign: "center" }}>
              {item.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    }>
      <Home />
    </Suspense>
  );
}
