"use client";

import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function proxyImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/")) return url;
  return `/api/v1/oss/proxy?url=${encodeURIComponent(url)}`;
}

function stripSaveBlocks(content: string): string {
  return content.replace(/\[SAVE_RECIPE_START\][\s\S]*?\[SAVE_RECIPE_END\]/g, "").trim();
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
            {rawContent}
          </ReactMarkdown>
          {isStreaming && <span className="streaming-cursor" />}
        </div>
      </div>
    </div>
  );
});
