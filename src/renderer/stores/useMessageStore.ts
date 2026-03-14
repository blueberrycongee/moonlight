import { create } from "zustand";
import type {
  ContentPart,
  DisplayBlock,
  WireEvent,
} from "../../shared/types/wire";

interface ToolCall {
  id: string;
  name: string;
  args: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: ContentPart[];
  toolCalls?: ToolCall[];
  displayBlocks?: DisplayBlock[];
  timestamp: number;
}

interface MessageStore {
  messagesByThread: Record<string, Message[]>;
  streamingMessage: Message | null;
  addUserMessage: (threadId: string, text: string) => void;
  handleWireEvent: (threadId: string, event: WireEvent) => void;
  loadHistory: (threadId: string, events: WireEvent[]) => void;
  clear: (threadId: string) => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesByThread: {},
  streamingMessage: null,

  addUserMessage: (threadId, text) =>
    set((s) => {
      const msg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      const existing = s.messagesByThread[threadId] ?? [];
      return {
        messagesByThread: {
          ...s.messagesByThread,
          [threadId]: [...existing, msg],
        },
      };
    }),

  handleWireEvent: (threadId, event) => {
    const { type, data } = event;

    switch (type) {
      case "TurnBegin": {
        set({
          streamingMessage: {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [],
            toolCalls: [],
            displayBlocks: [],
            timestamp: Date.now(),
          },
        });
        break;
      }
      case "ContentPart": {
        set((s) => {
          if (!s.streamingMessage) return s;
          return {
            streamingMessage: {
              ...s.streamingMessage,
              parts: [...s.streamingMessage.parts, data as ContentPart],
            },
          };
        });
        break;
      }
      case "ToolCall": {
        set((s) => {
          if (!s.streamingMessage) return s;
          return {
            streamingMessage: {
              ...s.streamingMessage,
              toolCalls: [
                ...(s.streamingMessage.toolCalls ?? []),
                data as ToolCall,
              ],
            },
          };
        });
        break;
      }
      case "ToolResult": {
        set((s) => {
          if (!s.streamingMessage) return s;
          const result = data as { display_blocks?: DisplayBlock[] };
          return {
            streamingMessage: {
              ...s.streamingMessage,
              displayBlocks: [
                ...(s.streamingMessage.displayBlocks ?? []),
                ...(result.display_blocks ?? []),
              ],
            },
          };
        });
        break;
      }
      case "TurnEnd": {
        set((s) => {
          if (!s.streamingMessage) return s;
          const existing = s.messagesByThread[threadId] ?? [];
          return {
            messagesByThread: {
              ...s.messagesByThread,
              [threadId]: [...existing, s.streamingMessage],
            },
            streamingMessage: null,
          };
        });
        break;
      }
    }
  },

  loadHistory: (threadId, events) => {
    const store = get();
    // Clear existing messages for this thread before replaying
    set((s) => ({
      messagesByThread: { ...s.messagesByThread, [threadId]: [] },
    }));
    for (const event of events) {
      store.handleWireEvent(threadId, event);
    }
  },

  clear: (threadId) =>
    set((s) => ({
      messagesByThread: { ...s.messagesByThread, [threadId]: [] },
    })),
}));
