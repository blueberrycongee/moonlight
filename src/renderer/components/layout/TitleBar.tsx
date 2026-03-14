import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../stores/useThemeStore";

export function TitleBar() {
  const { isDark, toggle } = useThemeStore();

  return (
    <div
      className="h-11 flex items-center justify-between px-4 border-b border-border bg-background"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic lights spacer */}
      <div className="w-[80px]" />

      <span className="text-sm text-text-primary opacity-60 select-none">
        Moonlight
      </span>

      <div className="w-[80px] flex justify-end">
        <button
          onClick={toggle}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-primary transition-colors"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
}
