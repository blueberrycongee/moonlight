import { useState } from "react";
import type { Message } from "../../stores/useMessageStore";

interface UserMessageProps {
  message: Message;
}

export function UserMessage({ message }: UserMessageProps) {
  const [showTime, setShowTime] = useState(false);
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  return (
    <div className="flex justify-end">
      <div
        className="relative max-w-[70%]"
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
      >
        <div className="bg-gradient-to-br from-brand to-brand-hover text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
        {showTime && (
          <div className="absolute -bottom-5 right-1 text-[10px] text-text-muted">
            {time}
          </div>
        )}
      </div>
    </div>
  );
}
