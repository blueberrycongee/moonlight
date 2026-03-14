import { Check, Circle, X } from "lucide-react";

interface TodoItem {
  text: string;
  status: "pending" | "done" | "failed";
}

interface TodoListProps {
  items: TodoItem[];
}

export function TodoList({ items }: TodoListProps) {
  return (
    <div className="my-2 space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {item.status === "done" && (
            <Check size={14} className="text-success shrink-0" />
          )}
          {item.status === "pending" && (
            <Circle size={14} className="text-text-muted shrink-0" />
          )}
          {item.status === "failed" && (
            <X size={14} className="text-danger shrink-0" />
          )}
          <span
            className={
              item.status === "done"
                ? "line-through text-text-secondary"
                : item.status === "failed"
                  ? "text-danger"
                  : "text-text-primary"
            }
          >
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}
