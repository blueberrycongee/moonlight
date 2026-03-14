import { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface ThinkBlockProps {
  text: string;
  isStreaming?: boolean;
}

export function ThinkBlock({ text, isStreaming }: ThinkBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronRight
          size={12}
          className={cn(
            "transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
        <Brain
          size={12}
          className={cn(isStreaming && "animate-pulse text-accent")}
        />
        <span className={cn(isStreaming && "animate-pulse")}>
          {isStreaming ? "Thinking..." : "Thought process"}
        </span>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          expanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-l-2 border-accent pl-3 text-xs text-text-secondary italic whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
