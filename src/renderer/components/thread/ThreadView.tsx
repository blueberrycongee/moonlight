import { useCallback } from "react";
import { useThreadStore } from "../../stores/useThreadStore";
import { useMessageStore } from "../../stores/useMessageStore";
import { TabBar } from "./TabBar";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";

export function ThreadView() {
  const { activeThreadId, threads } = useThreadStore();
  const { messagesByThread, streamingMessage, addUserMessage } =
    useMessageStore();

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const messages = activeThreadId
    ? (messagesByThread[activeThreadId] ?? [])
    : [];

  const handleSend = useCallback(
    (text: string) => {
      if (!activeThreadId) return;
      addUserMessage(activeThreadId, text);
      window.electronAPI.invoke("thread:prompt", {
        threadId: activeThreadId,
        text,
      });
    },
    [activeThreadId, addUserMessage],
  );

  if (!activeThreadId || !activeThread) {
    return (
      <div className="h-full flex flex-col">
        <TabBar />
        <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
          Select or create a thread.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TabBar />
      <MessageList messages={messages} streamingMessage={streamingMessage} />
      <InputBar
        onSend={handleSend}
        disabled={activeThread.status === "running"}
      />
    </div>
  );
}
