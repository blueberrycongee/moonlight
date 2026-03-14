import { X } from "lucide-react";
import { useThreadStore } from "../../stores/useThreadStore";

export function TabBar() {
  const { threads, activeThreadId, openTabs, setActiveThread, closeTab } =
    useThreadStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex border-b border-border overflow-x-auto">
      {openTabs.map((tabId) => {
        const thread = threads.find((t) => t.id === tabId);
        if (!thread) return null;
        const isActive = tabId === activeThreadId;

        return (
          <button
            key={tabId}
            onClick={() => setActiveThread(tabId)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm shrink-0 transition-opacity ${
              isActive
                ? "bg-surface border-b-2 border-brand opacity-100"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            <span className="max-w-[120px] truncate text-text-primary">
              {thread.title}
            </span>
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className="ml-1 rounded p-0.5 hover:bg-surface-hover text-text-secondary"
            >
              <X size={14} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
