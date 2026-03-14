import { useEffect, useRef } from "react";
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
  }, [allMessages.length]);

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        Start a conversation with Kimi.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {allMessages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                isUser ? "bg-brand text-white" : "bg-surface text-text-primary"
              }`}
            >
              {msg.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  );
                }
                if (part.type === "think") {
                  return (
                    <details key={i} className="mt-1 text-text-secondary">
                      <summary className="cursor-pointer text-xs opacity-70">
                        Thinking...
                      </summary>
                      <span className="whitespace-pre-wrap text-xs mt-1 block">
                        {part.text}
                      </span>
                    </details>
                  );
                }
                return null;
              })}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
