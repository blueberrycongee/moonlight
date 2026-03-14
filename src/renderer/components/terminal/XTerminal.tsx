import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { THEME } from "../../styles/theme";

interface XTerminalProps {
  threadId: string;
  workDir: string;
}

export function XTerminal({ threadId, workDir }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: THEME.background,
        foreground: THEME.textPrimary,
        cursor: THEME.brand,
        selectionBackground: `${THEME.brand}80`,
        black: THEME.background,
        red: THEME.danger,
        green: THEME.success,
        yellow: THEME.warning,
        blue: THEME.accent,
        magenta: "#bf5af2",
        cyan: "#64d2ff",
        white: THEME.textPrimary,
        brightBlack: THEME.textMuted,
        brightRed: "#ff6961",
        brightGreen: "#4cd964",
        brightYellow: "#ffe620",
        brightBlue: "#409cff",
        brightMagenta: "#da8aff",
        brightCyan: "#70d7ff",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Create PTY
    const termId = threadId;
    window.electronAPI.invoke("terminal:create", { termId, workDir });

    // Receive data from PTY
    const unsubData = window.electronAPI.on(
      "terminal:data",
      (payload: unknown) => {
        const { termId: id, data } = payload as {
          termId: string;
          data: string;
        };
        if (id === termId) {
          term.write(data);
        }
      },
    );

    const unsubExit = window.electronAPI.on(
      "terminal:exit",
      (payload: unknown) => {
        const { termId: id } = payload as { termId: string };
        if (id === termId) {
          term.write("\r\n[Process exited]\r\n");
        }
      },
    );

    // Send input to PTY
    const onDataDisposable = term.onData((data: string) => {
      window.electronAPI.send("terminal:input", { termId, data });
    });

    // Send resize to PTY
    const onResizeDisposable = term.onResize(
      ({ cols, rows }: { cols: number; rows: number }) => {
        window.electronAPI.send("terminal:resize", { termId, cols, rows });
      },
    );

    // ResizeObserver to re-fit on container resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore fit errors during teardown
        }
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      unsubData();
      unsubExit();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      window.electronAPI.invoke("terminal:destroy", { termId });
    };
  }, [threadId, workDir]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ backgroundColor: THEME.background }}
    />
  );
}
