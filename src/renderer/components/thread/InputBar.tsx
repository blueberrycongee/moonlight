import { useRef, useState, useCallback } from "react";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    },
    [],
  );

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="p-3">
      <div
        className={cn(
          "rounded-xl border border-border bg-surface transition-all duration-150",
          "focus-within:ring-1 focus-within:ring-brand focus-within:border-brand",
        )}
      >
        {disabled && (
          <div className="flex items-center gap-2 px-3 pt-2 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            <span>Agent is working...</span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Send a message..."
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-muted"
              disabled
            >
              <Paperclip size={14} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted select-none hidden sm:inline">
              {"\u2318"}Enter
            </span>
            <Button
              onClick={send}
              disabled={!canSend}
              size="icon"
              className="h-7 w-7"
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
