import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../stores/useThemeStore";
import { useThreadStore } from "../../stores/useThreadStore";

export function TitleBar() {
  const { isDark, toggle } = useThemeStore();
  const { threads } = useThreadStore();

  const runningCount = threads.filter((t) => t.status === "running").length;

  return (
    <div
      className="h-11 flex items-center justify-between px-4 border-b border-border bg-background shadow-sm"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic lights spacer */}
      <div className="w-[80px]" />

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-primary opacity-60 select-none font-medium tracking-tight">
          Moonlight
        </span>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-full select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {runningCount}
          </span>
        )}
      </div>

      <div className="w-[80px] flex justify-end">
        <button
          onClick={toggle}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors duration-200"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="relative w-4 h-4">
            <Sun
              size={16}
              className={`absolute inset-0 transition-all duration-300 ${
                isDark
                  ? "opacity-100 rotate-0 scale-100"
                  : "opacity-0 rotate-90 scale-0"
              }`}
            />
            <Moon
              size={16}
              className={`absolute inset-0 transition-all duration-300 ${
                isDark
                  ? "opacity-0 -rotate-90 scale-0"
                  : "opacity-100 rotate-0 scale-100"
              }`}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
