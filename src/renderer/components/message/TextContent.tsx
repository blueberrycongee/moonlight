import { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface TextContentProps {
  text: string;
}

export function TextContent({ text }: TextContentProps) {
  const copyToClipboard = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
  }, []);

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match && !className;
      const codeString = String(children).replace(/\n$/, "");

      if (isInline) {
        return (
          <code
            className="bg-surface-hover text-accent rounded px-1.5 py-0.5 text-[0.85em] font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="relative group my-2">
          {match && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[rgb(13,17,23)] rounded-t-lg border border-b-0 border-border-muted">
              <span className="text-xs text-text-muted font-mono">
                {match[1]}
              </span>
              <button
                onClick={() => copyToClipboard(codeString)}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors opacity-0 group-hover:opacity-100"
              >
                Copy
              </button>
            </div>
          )}
          <pre
            className={`bg-[rgb(13,17,23)] p-3 overflow-x-auto font-mono text-sm text-text-primary border border-border-muted ${
              match ? "rounded-b-lg" : "rounded-lg"
            }`}
          >
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },
    a({ children, href, ...props }) {
      return (
        <a
          href={href}
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc list-inside space-y-1 my-2" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
          {children}
        </ol>
      );
    },
    p({ children, ...props }) {
      return (
        <p className="my-1.5 leading-relaxed" {...props}>
          {children}
        </p>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-2 border-accent pl-3 my-2 text-text-secondary italic"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full text-sm border-collapse" {...props}>
            {children}
          </table>
        </div>
      );
    },
    th({ children, ...props }) {
      return (
        <th
          className="border border-border px-3 py-1.5 text-left font-medium bg-surface-hover"
          {...props}
        >
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td className="border border-border px-3 py-1.5" {...props}>
          {children}
        </td>
      );
    },
  };

  return (
    <div className="prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
