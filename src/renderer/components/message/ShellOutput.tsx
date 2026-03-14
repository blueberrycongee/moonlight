import { useCallback, useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface ShellOutputProps {
  command: string;
  output?: string;
}

export function ShellOutput({ command, output }: ShellOutputProps) {
  const [copied, setCopied] = useState(false);

  const copyCommand = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [command]);

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border-muted group">
      {/* Command line */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[rgb(10,13,18)]">
        <Terminal size={12} className="text-text-muted shrink-0" />
        <code className="flex-1 text-sm font-mono text-accent truncate">
          <span className="text-text-muted mr-2">$</span>
          {command}
        </code>
        <button
          onClick={copyCommand}
          className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      {/* Output */}
      {output && (
        <pre className="px-3 py-2 bg-[rgb(13,17,23)] text-xs font-mono text-text-secondary overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
