import { FolderOpen, Plus, MessageSquare } from "lucide-react";
import { useProjectStore } from "../../stores/useProjectStore";
import { useThreadStore } from "../../stores/useThreadStore";
import type { Thread } from "../../../shared/types/thread";

export function Sidebar() {
  const { project, selectDirectory } = useProjectStore();
  const { threads, activeThreadId, setActiveThread, addThread } =
    useThreadStore();

  const handleCreateThread = async () => {
    if (!project) return;

    const result = await window.electronAPI.invoke("thread:create", {
      projectId: project.id,
      workDir: project.path,
    });

    if (result) {
      addThread(result as Thread);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-dark/95 border-r border-border">
      {/* Project selector */}
      <div className="p-3">
        <button
          onClick={selectDirectory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition-colors"
        >
          <FolderOpen size={16} className="text-brand shrink-0" />
          <span className="text-sm text-text-inverse truncate">
            {project?.name ?? "Select project..."}
          </span>
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-medium text-text-secondary tracking-wider">
            THREADS
          </span>
          <button
            onClick={handleCreateThread}
            className="p-1 rounded hover:bg-white/10 text-text-secondary hover:text-text-inverse transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors ${
                activeThreadId === thread.id
                  ? "bg-brand text-white"
                  : "text-text-inverse hover:bg-white/10"
              }`}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="text-sm truncate flex-1">{thread.title}</span>
              {thread.status === "running" && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              )}
              {thread.status === "waiting" && (
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
