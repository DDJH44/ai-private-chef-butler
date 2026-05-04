export interface ChatHistorySession {
    session_id: string;
    created_at: string;
    message_count: number;
    preview: string;
    messages: ChatHistoryMessage[];
}

export interface ChatHistoryMessage {
    id: string;
    role: "user" | "ai";
    content: string;
    timestamp: string;
}

export interface ViewHistoryItem {
    recipe_id: string;
    recipe_name: string;
    view_count: number;
    last_viewed_at: string;
}

export interface CookHistoryItem {
    id: string;
    recipe_id: string;
    recipe_name: string;
    cook_date: string;
    rating: number;
    notes: string;
    photos: string[];
    created_at: string;
}

export interface HistoryStore {
    chat_history: ChatHistorySession[];
    view_history: ViewHistoryItem[];
    cook_history: CookHistoryItem[];
    lastUpdated: number;
}
