import { Plus, X } from "lucide-react";
import { useThreadStore } from "../../stores/useThreadStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { cn } from "../../lib/utils";
import type { Thread } from "../../../shared/types/thread";

export function TabBar() {
  const {
    threads,
    activeThreadId,
    openTabs,
    setActiveThread,
    closeTab,
    addThread,
  } = useThreadStore();
  const { project } = useProjectStore();

  const handleNewThread = async () => {
    if (!project) return;
    const result = await window.electronAPI.invoke("thread:create", {
      projectId: project.id,
      workDir: project.path,
    });
    if (result) {
      addThread(result as Thread);
    }
  };

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
            className={cn(
              "group flex items-center gap-1.5 px-3 py-2 text-sm shrink-0 transition-colors duration-150 relative",
              isActive
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
            )}
          >
            {/* Active indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
            )}

            <span className="max-w-[140px] truncate">{thread.title}</span>

            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className={cn(
                "ml-1 rounded p-0.5 hover:bg-surface-hover text-text-muted transition-opacity duration-150",
                isActive
                  ? "opacity-60 hover:opacity-100"
                  : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
              )}
            >
              <X size={12} />
            </span>
          </button>
        );
      })}

      {/* New tab button */}
      <button
        onClick={handleNewThread}
        className="flex items-center px-2.5 py-2 text-text-muted hover:text-text-secondary transition-colors duration-150 shrink-0"
        title="New thread"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
