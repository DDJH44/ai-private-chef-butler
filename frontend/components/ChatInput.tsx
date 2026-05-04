"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSendMessage: (message: string, imageUrl?: string) => void;
  onImageUpload: (file: File) => Promise<string | null>;
  disabled?: boolean;
  defaultValue?: string;
}

export function ChatInput({ onSendMessage, onImageUpload, disabled, defaultValue }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasSentDefault, setHasSentDefault] = useState(false);

  useEffect(() => {
    if (defaultValue && !hasSentDefault) {
      setHasSentDefault(true);
      onSendMessage(defaultValue);
    }
  }, [defaultValue, hasSentDefault, onSendMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleSend = () => {
    if ((!message.trim() && !imagePreview) || disabled) return;
    onSendMessage(message.trim(), imagePreview || undefined);
    setMessage("");
    setImagePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) setImagePreview(url);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canSend = !disabled && !uploading && (message.trim() || imagePreview);

  const circleBtn = (accent?: boolean): React.CSSProperties => ({
    width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 17, borderRadius: "50%", border: "none", cursor: "pointer",
    fontFamily: "inherit", flexShrink: 0, transition: "all 0.25s ease",
    background: accent ? "var(--accent)" : "var(--bg)",
    color: accent ? "#fff" : "var(--text-secondary)",
    boxShadow: accent ? "var(--shadow-accent)" : "var(--shadow-raised-sm)",
    opacity: accent && !canSend ? 0.4 : 1,
  });

  return (
    <div style={{ flexShrink: 0 }}>
      {imagePreview && (
        <div style={{ marginBottom: 8, position: "relative", display: "inline-block", animation: "scaleIn 0.2s ease both" }}>
          <img
            src={imagePreview}
            alt="预览"
            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12, boxShadow: "var(--shadow-raised-sm)" }}
          />
          <button
            onClick={() => setImagePreview(null)}
            style={{
              position: "absolute", top: -6, right: -6, width: 20, height: 20,
              background: "var(--text)", color: "var(--bg)", border: "none",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, cursor: "pointer",
            }}
          >✕</button>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 20,
        background: "var(--bg)", boxShadow: "var(--shadow-raised)",
      }}>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={circleBtn()}>📎</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入食材或描述你想吃的..."
          rows={1}
          maxLength={500}
          style={{
            flex: 1, resize: "none", background: "var(--bg)", border: "none",
            padding: "10px 14px", borderRadius: 12, fontFamily: "inherit",
            fontSize: 14, color: "var(--text)", lineHeight: 1.6,
            boxShadow: "var(--shadow-inset-sm)", outline: "none", maxHeight: 120,
          }}
        />

        <button style={circleBtn()}>🎤</button>
        <button onClick={handleSend} disabled={!canSend} style={circleBtn(true)}>➤</button>
      </div>
    </div>
  );
}
