import { FileCode } from "lucide-react";

interface DiffViewerProps {
  path: string;
  oldText: string;
  newText: string;
}

function computeInlineDiff(oldText: string, newText: string) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: Array<{
    type: "removed" | "added" | "unchanged";
    text: string;
  }> = [];

  // Simple line-based diff: show removed then added
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length) {
      if (oldLines[oi] === newLines[ni]) {
        result.push({ type: "unchanged", text: oldLines[oi] });
        oi++;
        ni++;
      } else {
        result.push({ type: "removed", text: oldLines[oi] });
        oi++;
        if (ni < newLines.length) {
          result.push({ type: "added", text: newLines[ni] });
          ni++;
        }
      }
    } else if (oi < oldLines.length) {
      result.push({ type: "removed", text: oldLines[oi] });
      oi++;
    } else {
      result.push({ type: "added", text: newLines[ni] });
      ni++;
    }
  }

  return result;
}

export function DiffViewer({ path, oldText, newText }: DiffViewerProps) {
  const lines = computeInlineDiff(oldText, newText);
  const fileName = path.split("/").pop() || path;

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border-muted">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover text-xs">
        <FileCode size={12} className="text-text-muted shrink-0" />
        <span className="font-mono text-text-secondary truncate" title={path}>
          {fileName}
        </span>
        <span className="text-text-muted truncate ml-auto" title={path}>
          {path}
        </span>
      </div>

      {/* Diff lines */}
      <div className="bg-[rgb(13,17,23)] overflow-x-auto text-xs font-mono">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex ${
              line.type === "removed"
                ? "bg-danger/10 text-danger"
                : line.type === "added"
                  ? "bg-success/10 text-success"
                  : "text-text-secondary"
            }`}
          >
            <span className="w-10 shrink-0 text-right pr-2 text-text-muted select-none border-r border-border-muted py-0.5">
              {i + 1}
            </span>
            <span className="w-5 shrink-0 text-center select-none py-0.5">
              {line.type === "removed"
                ? "-"
                : line.type === "added"
                  ? "+"
                  : " "}
            </span>
            <span className="py-0.5 pr-3 whitespace-pre">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
