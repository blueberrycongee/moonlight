import { useRef, useState, useCallback } from "react";
import { Send } from "lucide-react";

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
    <div className="border-t border-border p-3 flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Send a message... (Cmd+Enter to send)"
        rows={1}
        className="flex-1 resize-none bg-surface rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:ring-1 focus:ring-brand"
      />
      <button
        onClick={send}
        disabled={!canSend}
        className="p-2 rounded-lg bg-brand text-white disabled:opacity-40 transition-opacity"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
