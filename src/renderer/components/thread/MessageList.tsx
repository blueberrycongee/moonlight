import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { UserMessage } from "../message/UserMessage";
import { AssistantMessage } from "../message/AssistantMessage";
import type { Message } from "../../stores/useMessageStore";

interface MessageListProps {
  messages: Message[];
  streamingMessage: Message | null;
}

export function MessageList({ messages, streamingMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const allMessages = streamingMessage
    ? [...messages, streamingMessage]
    : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, streamingMessage?.parts.length]);

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-3">
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
          <MessageSquare size={24} className="text-text-muted" />
        </div>
        <p className="text-sm">Start a conversation with Kimi.</p>
        <p className="text-xs text-text-muted">
          Use Cmd+Enter to send a message
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {allMessages.map((msg) => {
          const isUser = msg.role === "user";
          const isCurrentStreaming =
            streamingMessage && msg.id === streamingMessage.id;

          if (isUser) {
            return <UserMessage key={msg.id} message={msg} />;
          }
          return (
            <AssistantMessage
              key={msg.id}
              message={msg}
              isStreaming={!!isCurrentStreaming}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
