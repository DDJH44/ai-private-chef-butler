"use client";

import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo, useState } from "react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

import { apiOrigin, apiPort } from '@/lib/env';

function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/")) return url;
  return `/api/v1/oss/proxy?url=${encodeURIComponent(url)}`;
}

function getBackendOrigin(): string {
  if (typeof window === "undefined") return apiOrigin() || "";
  const base = apiOrigin();
  if (!base) return "";  // production: same origin
  return `${window.location.protocol}//${window.location.hostname}:${apiPort()}`;
}

function rewriteRelativeUrls(markdown: string): string {
  const origin = getBackendOrigin();
  if (!origin) return markdown;
  return markdown.replace(/!\[([^\]]*)\]\(\/api\//g, `![$1](${origin}/api/`);
}

function stripSaveBlocks(content: string): string {
  return content.replace(/\[SAVE_RECIPE_START\][\s\S]*?\[SAVE_RECIPE_END\]/g, "").trim();
}

function SpeakButton({ text }: { text: string }) {
  const { speak, stop, speaking } = useSpeechSynthesis();
  return (
    <button
      onClick={() => (speaking ? stop() : speak(text))}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        border: "none",
        borderRadius: 10,
        background: speaking ? "var(--rose-bg)" : "var(--bg)",
        color: speaking ? "var(--rose)" : "var(--text-muted)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "var(--shadow-raised-xs)",
        transition: "all 0.25s ease",
        marginTop: 4,
      }}
      title={speaking ? "停止朗读" : "朗读此消息"}
    >
      {speaking ? "⏹ 停止" : "🔊 朗读"}
    </button>
  );
}

export const ChatMessage = memo(function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const rawContent = isUser ? (message.content || "") : stripSaveBlocks(message.content || "");

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, animation: "slideInRight 0.3s ease both" }}>
        <div style={{ maxWidth: "70%" }}>
          {message.imageUrl && (
            <div style={{ marginBottom: 8, borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-raised-sm)" }}>
              <img src={message.imageUrl} alt="上传的图片" style={{ width: "100%", maxHeight: 256, objectFit: "cover" }} />
            </div>
          )}
          <div style={{
            padding: "14px 18px", borderRadius: "20px 20px 6px 20px",
            background: "var(--bg)", boxShadow: "var(--shadow-raised)",
            fontSize: 14, lineHeight: 1.75, color: "var(--text)",
          }}>
            {rawContent}
          </div>
        </div>
      </div>
    );
  }

  if (!rawContent) {
    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 16, animation: "fadeIn 0.3s ease both" }}>
        <div className="msg-avatar" style={{ marginTop: 2 }}>👨‍🍳</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px" }}>
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16, animation: "fadeUp 0.35s ease both" }}>
      <div className="msg-avatar" style={{ marginTop: 2 }}>👨‍🍳</div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: "80%" }}>
        {message.imageUrl && (
          <div style={{ marginBottom: 8, borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-raised-sm)" }}>
            <img
              src={proxyImageUrl(message.imageUrl)}
              alt="AI 图片"
              style={{ width: "100%", maxHeight: 256, objectFit: "cover" }}
            />
          </div>
        )}
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {rewriteRelativeUrls(rawContent)}
          </ReactMarkdown>
          {isStreaming && <span className="streaming-cursor" />}
        </div>
        {!isStreaming && rawContent.length > 30 && <SpeakButton text={rawContent} />}
      </div>
    </div>
  );
});
