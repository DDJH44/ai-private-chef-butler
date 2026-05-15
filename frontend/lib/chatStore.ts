import { Message } from "@/types/chat";
import { Recipe } from "@/types/recipe";
import { streamChat as streamChatApi, getChatHistory } from "./api";
import { generateUUID } from "./utils";
import { saveChatSession, loadChatHistory } from "./historyStore";
import { addRecipesBatch } from "./recipeStore";
import { containsRecipe, parseAllRecipesFromMessage } from "./recipeParser";
import { showToast } from "@/components/Toast";

const THREAD_ID_KEY = "ai_chef_thread_id";

function getPersistedThreadId(): string {
    if (typeof window === "undefined") return generateUUID();
    const stored = localStorage.getItem(THREAD_ID_KEY);
    if (stored) return stored;
    const newId = generateUUID();
    localStorage.setItem(THREAD_ID_KEY, newId);
    return newId;
}

function persistThreadId(id: string) {
    if (typeof window !== "undefined") {
        localStorage.setItem(THREAD_ID_KEY, id);
    }
}

interface ChatState {
    messages: Message[];
    threadId: string;
    loading: boolean;
    recipesToSave: { recipes: Recipe[] } | null;
    initialLoading: boolean;
}

type Listener = () => void;

const state: ChatState = {
    messages: [],
    threadId: "",
    loading: false,
    recipesToSave: null,
    initialLoading: true,
};

const listeners = new Set<Listener>();
let abortController: AbortController | null = null;

if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
        saveCurrentSession();
    });
}

function notify() {
    listeners.forEach((fn) => fn());
}

export function getChatState(): Readonly<ChatState> {
    return state;
}

export function subscribeToChat(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

export async function initChat(resumeThreadId?: string): Promise<void> {
    const targetId = resumeThreadId || getPersistedThreadId();

    // 同一 thread 已加载，跳过
    if (state.threadId === targetId && !state.initialLoading) return;

    // 切换前保存当前会话
    if (state.threadId && state.threadId !== targetId) {
        saveCurrentSession();
    }

    state.threadId = targetId;
    persistThreadId(targetId);
    state.messages = [];
    state.recipesToSave = null;
    state.initialLoading = true;
    notify();

    try {
        let history = await getChatHistory(state.threadId);
        if (!Array.isArray(history) || history.length === 0) {
            // 后端无记录时从 localStorage 恢复
            const sessions = loadChatHistory();
            const cached = sessions.find(s => s.session_id === state.threadId);
            if (cached?.messages?.length) {
                history = cached.messages.map(m => ({
                    role: m.role === "ai" ? "assistant" : "user",
                    content: m.content,
                }));
            }
        }
        if (Array.isArray(history) && history.length > 0) {
            state.messages = history.map(
                (msg: { role: string; content: unknown }) => {
                    let text: string;
                    if (typeof msg.content === "string") {
                        text = msg.content;
                    } else if (Array.isArray(msg.content)) {
                        text = (msg.content as Array<{type?: string; text?: string}>)
                            .filter(item => item.type === "text" && item.text)
                            .map(item => item.text)
                            .join(" ");
                    } else {
                        text = String(msg.content || "");
                    }
                    return {
                        id: generateUUID(),
                        role: (msg.role === "human" ? "user" : msg.role === "ai" ? "assistant" : msg.role) as "user" | "assistant",
                        content: text,
                        timestamp: Date.now(),
                    };
                }
            );
        }
    } catch (e) {
        console.error("加载历史消息失败:", e);
    } finally {
        state.initialLoading = false;
        notify();
    }
}

export function saveCurrentSession() {
    if (state.messages.length === 0) return;
    const firstUser = state.messages.find((m) => m.role === "user");
    const preview = firstUser?.content?.toString().slice(0, 50) || "新对话";
    saveChatSession({
        session_id: state.threadId,
        created_at: new Date().toISOString(),
        message_count: state.messages.length,
        preview,
        messages: state.messages.map((m) => ({
            id: m.id,
            role: m.role === "assistant" ? "ai" : "user",
            content: m.content,
            timestamp: new Date(m.timestamp).toISOString(),
        })),
    });
}

export async function newChat(): Promise<void> {
    saveCurrentSession();
    const newId = generateUUID();
    persistThreadId(newId);
    state.threadId = newId;
    state.messages = [];
    state.recipesToSave = null;
    if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("thread");
        window.history.replaceState(null, "", url.toString());
    }
    notify();
}

export function stopGeneration(): void {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    state.loading = false;
    notify();
}

export async function sendMessage(content: string, imageUrl?: string): Promise<void> {
    if (state.loading) return;

    const userMsg: Message = {
        id: generateUUID(),
        role: "user",
        content: content || "请分析这张图片",
        imageUrl,
        timestamp: Date.now(),
    };

    const assistantId = generateUUID();
    const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
    };

    state.messages = [...state.messages, userMsg, assistantMsg];
    state.loading = true;
    abortController = new AbortController();
    notify();

    try {
        await streamChatApi(
            content,
            (chunk: string) => {
                state.messages = state.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: chunk } : m
                );
                notify();
            },
            imageUrl,
            (error: Error) => {
                state.messages = state.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: error.message === "请先登录" ? "" : `抱歉，${error.message}` } : m
                );
                notify();
            },
            () => {
                const final = state.messages.find((m) => m.id === assistantId);
                const reply = final?.content || "";
                window.dispatchEvent(new CustomEvent('autoSpeak', { detail: reply }));
                if (containsRecipe(reply)) {
                    const parsed = parseAllRecipesFromMessage(reply);
                    if (parsed.length > 0) {
                        state.recipesToSave = {
                            recipes: parsed.map((p, i) => ({
                                id: p.recipe.id || generateUUID(),
                                title: p.recipe.title || `菜谱${i + 1}`,
                                content: p.content,
                                ingredients: p.recipe.ingredients || [],
                                seasonings: p.recipe.seasonings || [],
                                difficulty: p.recipe.difficulty,
                                cookingTime: p.recipe.cookingTime,
                                score: p.recipe.score,
                                reason: p.recipe.reason,
                                videoUrl: p.recipe.videoUrl,
                                tags: p.recipe.tags || [],
                                createdAt: p.recipe.createdAt || Date.now(),
                                updatedAt: p.recipe.updatedAt || Date.now(),
                            })),
                        };
                    }
                }
                notify();
            },
            state.threadId,
            abortController.signal,
        );
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        state.messages = state.messages.map((m) =>
            m.id === assistantId ? { ...m, content: "抱歉，发生了错误" } : m
        );
        notify();
    } finally {
        state.loading = false;
        abortController = null;
        notify();
    }
}

export function dismissRecipes() {
    state.recipesToSave = null;
    notify();
}

export async function confirmSaveRecipes(selected: Recipe[]) {
    let ok = false;
    try {
      const saved = await addRecipesBatch(selected);
      ok = saved.length > 0;
      if (ok) {
        showToast(`已添加 ${saved.length} 道菜品到菜谱栏`, "success");
      } else {
        showToast("保存失败，请重试", "error");
      }
    } catch {
      showToast("保存失败，请重试", "error");
    }
    state.recipesToSave = null;
    notify();
}
