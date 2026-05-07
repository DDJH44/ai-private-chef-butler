"use client";

import { useState, useRef, useCallback } from "react";

import { apiPath } from '@/lib/env';
const WhisperAPI = apiPath('/v1/speech/transcribe');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef<AnyRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((t: string) => void) | null>(null);
  const transcriptRef = useRef("");
  const isRecordingRef = useRef(false);

  const onAutoEndRef = useRef<((text: string) => void) | null>(null);

  const startBrowser = useCallback(() => {
    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => AnyRecognition)
      | undefined;
    if (!SR) {
      setIsSupported(false);
      return false;
    }
    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: AnyRecognition) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const text = finalText + interim;
      transcriptRef.current = text;
      setTranscript(text);
    };

    recognition.onerror = (event: AnyRecognition) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setIsSupported(true);
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      onAutoEndRef.current = null;
    };

    recognition.onend = () => {
      const finalText = transcriptRef.current;
      const cb = onAutoEndRef.current;
      isRecordingRef.current = false;
      setIsRecording(false);
      if (cb && finalText.trim()) {
        onAutoEndRef.current = null;
        setTimeout(() => cb(finalText.trim()), 100);
      }
    };

    recognition.start();
    isRecordingRef.current = true;
    setIsRecording(true);
    return true;
  }, []);

  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      return new Promise<string>((resolve) => {
        resolveRef.current = resolve;
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setUploading(true);
          try {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            const resp = await fetch(WhisperAPI, { method: "POST", body: formData });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const text = data.text || "";
            transcriptRef.current += text;
            setTranscript((prev) => prev + text);
            resolve(text);
          } catch (e) {
            console.error("Whisper transcription failed:", e);
            resolve("");
          } finally {
            setUploading(false);
          }
        };
        recorder.start();
        isRecordingRef.current = true;
        setIsRecording(true);
      });
    } catch (e) {
      console.error("Microphone access denied");
      setIsSupported(false);
      return "";
    }
  }, []);

  const start = useCallback((onAutoEnd?: (text: string) => void): Promise<string> => {
    onAutoEndRef.current = onAutoEnd || null;
    transcriptRef.current = "";
    setTranscript("");
    const ok = startBrowser();
    if (ok) {
      if (!onAutoEnd) return Promise.resolve("");
      // voice mode: respond to onAutoEnd in onend handler
      return Promise.resolve("");
    }
    // Whisper fallback: onAutoEnd won't fire via onend, handle manually
    const p = startWhisper();
    if (onAutoEnd) {
      p.then((text) => { if (text.trim()) onAutoEnd(text.trim()); });
    }
    return p;
  }, [startBrowser, startWhisper]);

  const stop = useCallback((): Promise<string> => {
    onAutoEndRef.current = null; // manual stop cancels auto-send
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolveRef.current?.("");
        resolve(transcriptRef.current);
      }, 200);
    });
  }, []);

  const cancel = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    resolveRef.current = null;
    transcriptRef.current = "";
    setTranscript("");
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  return { transcript, isRecording, isSupported, uploading, start, stop, cancel };
}
