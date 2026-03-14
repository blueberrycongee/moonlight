import { Sparkles } from "lucide-react";
import type { Message } from "../../stores/useMessageStore";
import type {
  DiffDisplayBlock,
  ShellDisplayBlock,
  TodoDisplayBlock,
} from "../../../shared/types/wire";
import { TextContent } from "./TextContent";
import { ThinkBlock } from "./ThinkBlock";
import { ShellOutput } from "./ShellOutput";
import { DiffViewer } from "./DiffViewer";
import { TodoList } from "./TodoList";

interface AssistantMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  return (
    <div className="flex justify-start gap-2.5">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-brand flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Sparkles size={14} className="text-white" />
      </div>

      {/* Content */}
      <div className="max-w-[85%] bg-surface rounded-2xl rounded-bl-md px-4 py-2.5 text-sm shadow-sm">
        {/* Text and Think parts */}
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <TextContent key={i} text={part.text} />;
          }
          if (part.type === "think") {
            return (
              <ThinkBlock key={i} text={part.text} isStreaming={isStreaming} />
            );
          }
          return null;
        })}

        {/* Display blocks */}
        {message.displayBlocks?.map((block, i) => {
          if (block.type === "shell") {
            const shell = block as ShellDisplayBlock;
            return (
              <ShellOutput
                key={`db-${i}`}
                command={shell.command}
                output={shell.output}
              />
            );
          }
          if (block.type === "diff") {
            const diff = block as DiffDisplayBlock;
            return (
              <DiffViewer
                key={`db-${i}`}
                path={diff.path}
                oldText={diff.old_text}
                newText={diff.new_text}
              />
            );
          }
          if (block.type === "todo") {
            const todo = block as TodoDisplayBlock;
            return <TodoList key={`db-${i}`} items={todo.items} />;
          }
          if (block.type === "brief") {
            return (
              <p key={`db-${i}`} className="text-text-secondary text-xs mt-1">
                {block.content}
              </p>
            );
          }
          return null;
        })}

        {/* Streaming indicator */}
        {isStreaming && message.parts.length === 0 && (
          <div className="flex gap-1 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}
