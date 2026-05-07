"use client";

import { useState, useRef, useEffect } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

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
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [hasSentDefault, setHasSentDefault] = useState(false);
  const { transcript, isRecording, isSupported, uploading: voiceUploading, start, stop, cancel } = useSpeechRecognition();
  const { speak } = useSpeechSynthesis();
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (transcript) setMessage(transcript);
  }, [transcript]);

  // Voice mode: auto-speak AI reply when streaming completes
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (voiceMode && text) speak(text);
    };
    window.addEventListener('autoSpeak', handler);
    return () => window.removeEventListener('autoSpeak', handler);
  }, [voiceMode, speak]);

  const handleVoiceClick = async () => {
    setShowAttachMenu(false);
    if (isRecording) {
      const text = await stop();
      if (!text) return;
      setMessage(text);
      if (voiceMode && text.trim()) {
        setMessage("");
        onSendMessage(text.trim());
      }
    } else {
      setMessage("");
      if (voiceMode) {
        start((text: string) => {
          setMessage("");
          onSendMessage(text);
        });
      } else {
        start();
      }
    }
  };

  const handleSend = () => {
    setShowAttachMenu(false);
    if ((!message.trim() && !imagePreview) || disabled || uploading) return;
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

  const compressAndToBase64 = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 768;
        const MAX_H = 768;
        let { width: w, height: h } = img;
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.6);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setUploading(true);
    // Compress to base64 first (always needed as fallback)
    let base64: string | null = null;
    try {
      base64 = await compressAndToBase64(localUrl);
    } catch { /* keep localUrl as preview */ }
    // Try OSS in background, but don't block — base64 is the reliable fallback
    try {
      const ossUrl = await onImageUpload(file);
      if (ossUrl) {
        URL.revokeObjectURL(localUrl);
        setImagePreview(ossUrl);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        return;
      }
    } catch { /* OSS unavailable, use base64 */ }
    // Fallback to compressed base64
    if (base64) {
      URL.revokeObjectURL(localUrl);
      setImagePreview(base64);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const canSend = !disabled && !uploading && (message.trim() || imagePreview);
  const barBusy = disabled || uploading || voiceUploading;

  const btnBase: React.CSSProperties = {
    width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, borderRadius: "50%", border: "none", cursor: "pointer",
    fontFamily: "inherit", flexShrink: 0, transition: "all 0.25s ease",
    background: "var(--bg)", color: "var(--text-secondary)",
    boxShadow: "var(--shadow-raised-sm)",
  };

  const attachBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: showAttachMenu ? "var(--accent-bg)" : "var(--bg)",
    color: showAttachMenu ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 22, fontWeight: 300,
  };

  const micBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: isRecording ? "var(--rose)" : voiceMode ? "var(--accent-bg)" : "var(--bg)",
    color: isRecording ? "#fff" : voiceMode ? "var(--accent)" : "var(--text-secondary)",
    animation: isRecording ? "pulse 0.8s ease-in-out infinite" : "none",
    opacity: (!isSupported && !voiceUploading) ? 0.35 : 1,
  };

  const sendBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: canSend ? "var(--accent)" : "var(--bg)",
    color: canSend ? "#fff" : "var(--text-placeholder)",
    boxShadow: canSend ? "var(--shadow-accent)" : "var(--shadow-raised-sm)",
  };

  return (
    <div style={{ flexShrink: 0, padding: "0 8px 8px" }}>
      {/* Image preview */}
      {imagePreview && (
        <div style={{
          marginBottom: 8, marginLeft: 4,
          position: "relative", display: "inline-block",
          animation: "scaleIn 0.2s ease both",
        }}>
          <img
            src={imagePreview}
            alt="预览"
            style={{
              width: 52, height: 52, objectFit: "cover",
              borderRadius: 14, boxShadow: "var(--shadow-raised-sm)",
            }}
          />
          <button
            onClick={() => { setImagePreview(null); }}
            style={{
              position: "absolute", top: -5, right: -5,
              width: 18, height: 18, borderRadius: "50%",
              background: "var(--rose)", color: "#fff", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, cursor: "pointer",
            }}
          >✕</button>
        </div>
      )}

      {/* Main bar */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 8,
        padding: "8px 12px", borderRadius: 24,
        background: "var(--bg)", boxShadow: "var(--shadow-raised)",
      }}>
        {/* + Attach button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowAttachMenu((v) => !v)}
            disabled={barBusy}
            style={attachBtnStyle}
            aria-label="添加图片"
          >+</button>

          {/* Attach popup menu */}
          {showAttachMenu && (
            <div style={{
              position: "absolute", bottom: 46, left: -4,
              display: "flex", gap: 8, padding: 10,
              borderRadius: 18, background: "var(--bg)",
              boxShadow: "var(--shadow-raised-lg)",
              animation: "scaleIn 0.2s ease both", zIndex: 30,
            }}>
              {/* Camera */}
              <div style={{ position: "relative", width: 42, height: 42 }}>
                <button
                  style={{ ...btnBase, width: 42, height: 42, fontSize: 20 }}
                  aria-label="拍照"
                >📷</button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                  onChange={handleFileChange}
                  style={{ position: "absolute", top: 0, left: 0, width: 42, height: 42, opacity: 0.001, cursor: "pointer" }} />
              </div>
              {/* Gallery */}
              <div style={{ position: "relative", width: 42, height: 42 }}>
                <button
                  style={{ ...btnBase, width: 42, height: 42, fontSize: 20 }}
                  aria-label="从相册选择"
                >🖼</button>
                <input ref={fileInputRef} type="file" accept="image/*"
                  onChange={handleFileChange}
                  style={{ position: "absolute", top: 0, left: 0, width: 42, height: 42, opacity: 0.001, cursor: "pointer" }} />
              </div>
            </div>
          )}
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "正在聆听..." : voiceMode ? "说出你想吃的..." : "输入食材或描述你想吃的..."}
          rows={1}
          maxLength={500}
          style={{
            flex: 1, resize: "none", background: "var(--bg)", border: "none",
            padding: "8px 4px", borderRadius: 0, fontFamily: "inherit",
            fontSize: 15, color: "var(--text)", lineHeight: 1.5,
            boxShadow: "none", outline: "none", maxHeight: 120,
            alignSelf: "center",
          }}
        />

        {/* Mic button with integrated voice-mode toggle (long-press) */}
        <button
          onClick={handleVoiceClick}
          onPointerDown={() => {
            voiceModeTimerRef.current = setTimeout(() => {
              setVoiceMode((v) => !v);
            }, 600);
          }}
          onPointerUp={() => {
            if (voiceModeTimerRef.current) clearTimeout(voiceModeTimerRef.current);
          }}
          onPointerLeave={() => {
            if (voiceModeTimerRef.current) clearTimeout(voiceModeTimerRef.current);
          }}
          disabled={voiceUploading}
          style={{ ...micBtnStyle, position: "relative" }}
          title={isRecording ? "停止录音" : voiceMode ? `语音模式开 · 长按0.5秒关闭 · 点按开始对话` : `语音模式关 · 长按0.5秒开启 · 点按语音输入`}
          aria-label={isRecording ? "停止录音" : "语音输入"}
        >
          {voiceUploading ? "⏳" : "🎤"}
          {voiceMode && (
            <span style={{
              position: "absolute", top: 1, right: 1,
              width: 9, height: 9, borderRadius: "50%",
              background: "var(--accent)", border: "1.5px solid var(--bg)",
            }} />
          )}
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={sendBtnStyle}
          title={uploading ? "图片处理中..." : "发送"}
          aria-label="发送"
        >{uploading ? "⏳" : "➤"}</button>
      </div>

    </div>
  );
}
