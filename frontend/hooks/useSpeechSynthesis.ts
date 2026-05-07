"use client";

import { useRef, useCallback, useState } from "react";

import { apiPath } from '@/lib/env';
const SynthesizeAPI = apiPath('/v1/speech/synthesize');

function cleanForSpeech(text: string): string {
  return text
    .replace(/\[SAVE_RECIPE_START\][\s\S]*?\[SAVE_RECIPE_END\]/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")           // images
    .replace(/\[([^\]]*?)\]\(.*?\)/g, "$1")     // links: keep text
    .replace(/[*_~`#>\-|]/g, "")                // markdown symbols
    .replace(/[\p{Emoji_Presentation}\p{Emoji}‍️]/gu, "") // emoji
    .replace(/\|.*?\|/g, "")                    // table rows
    .replace(/\s{2,}/g, " ")                    // collapse whitespace
    .trim();
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakBrowser = useCallback((rawText: string) => {
    const text = cleanForSpeech(rawText);
    if (!text) return false;
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.5;
    utterance.pitch = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const speakApi = useCallback(async (rawText: string) => {
    const text = cleanForSpeech(rawText);
    if (!text) return;
    try {
      const resp = await fetch(SynthesizeAPI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch (e) {
      console.error("TTS synthesis failed:", e);
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!text?.trim()) return;
    const ok = speakBrowser(text);
    if (!ok) speakApi(text);
  }, [speakBrowser, speakApi]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}
