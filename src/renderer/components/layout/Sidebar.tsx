import { FolderOpen, Plus, MessageSquare } from "lucide-react";
import { useProjectStore } from "../../stores/useProjectStore";
import { useThreadStore } from "../../stores/useThreadStore";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { Thread } from "../../../shared/types/thread";

function ThreadItem({
  thread,
  isActive,
  onSelect,
}: {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors duration-150",
        isActive
          ? "bg-surface-hover border-l-2 border-brand text-text-primary"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-2 border-transparent",
      )}
    >
      <MessageSquare size={14} className="shrink-0" />
      <span className="text-sm truncate flex-1">{thread.title}</span>
      {thread.status === "running" && (
        <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
      )}
      {thread.status === "waiting" && (
        <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
      )}
    </button>
  );
}

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
    <div className="h-full flex flex-col bg-surface border-r border-border">
      {/* Project selector */}
      <div className="p-3">
        <button
          onClick={selectDirectory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover text-left transition-colors duration-150"
        >
          <FolderOpen size={16} className="text-accent shrink-0" />
          <span className="text-sm text-text-primary truncate font-medium">
            {project?.name ?? "Select project..."}
          </span>
        </button>
      </div>

      <Separator />

      {/* Thread list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs font-medium text-text-muted tracking-wider uppercase">
            Threads
          </span>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 pb-2">
            {threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isActive={activeThreadId === thread.id}
                onSelect={() => setActiveThread(thread.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* New thread button */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateThread}
            className="w-full justify-start gap-2"
          >
            <Plus size={14} />
            <span>New Thread</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
