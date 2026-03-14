import { create } from "zustand";
import type { Thread } from "../../shared/types/thread";

interface ThreadStore {
  threads: Thread[];
  activeThreadId: string | null;
  openTabs: string[];
  setThreads: (threads: Thread[]) => void;
  addThread: (thread: Thread) => void;
  removeThread: (threadId: string) => void;
  updateThread: (threadId: string, patch: Partial<Thread>) => void;
  setActiveThread: (threadId: string) => void;
  openTab: (threadId: string) => void;
  closeTab: (threadId: string) => void;
}

export const useThreadStore = create<ThreadStore>((set) => ({
  threads: [],
  activeThreadId: null,
  openTabs: [],
  setThreads: (threads) => set({ threads }),
  addThread: (thread) =>
    set((s) => ({
      threads: [...s.threads, thread],
      openTabs: [...s.openTabs, thread.id],
      activeThreadId: thread.id,
    })),
  removeThread: (threadId) =>
    set((s) => ({
      threads: s.threads.filter((t) => t.id !== threadId),
      openTabs: s.openTabs.filter((id) => id !== threadId),
      activeThreadId:
        s.activeThreadId === threadId
          ? (s.openTabs.filter((id) => id !== threadId).at(-1) ?? null)
          : s.activeThreadId,
    })),
  updateThread: (threadId, patch) =>
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, ...patch } : t,
      ),
    })),
  setActiveThread: (threadId) =>
    set((s) => ({
      activeThreadId: threadId,
      openTabs: s.openTabs.includes(threadId)
        ? s.openTabs
        : [...s.openTabs, threadId],
    })),
  openTab: (threadId) =>
    set((s) => ({
      openTabs: s.openTabs.includes(threadId)
        ? s.openTabs
        : [...s.openTabs, threadId],
    })),
  closeTab: (threadId) =>
    set((s) => {
      const remaining = s.openTabs.filter((id) => id !== threadId);
      return {
        openTabs: remaining,
        activeThreadId:
          s.activeThreadId === threadId
            ? (remaining.at(-1) ?? null)
            : s.activeThreadId,
      };
    }),
}));
