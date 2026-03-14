import os from "node:os";
import { spawn, type IPty } from "node-pty";
import type { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../shared/types/ipc";

const defaultShell =
  os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "zsh";

export class TerminalManager {
  private ptys = new Map<string, IPty>();

  constructor(private getWindow: () => BrowserWindow | null) {}

  create(
    termId: string,
    workDir: string,
    shell: string = defaultShell,
  ): { termId: string } {
    this.destroy(termId);

    const pty = spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: workDir,
      env: process.env as Record<string, string>,
    });

    this.ptys.set(termId, pty);

    pty.onData((data: string) => {
      const win = this.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { termId, data });
      }
    });

    pty.onExit(({ exitCode, signal }) => {
      this.ptys.delete(termId);
      const win = this.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, {
          termId,
          exitCode,
          signal,
        });
      }
    });

    return { termId };
  }

  write(termId: string, data: string): void {
    const pty = this.ptys.get(termId);
    if (pty) {
      pty.write(data);
    }
  }

  resize(termId: string, cols: number, rows: number): void {
    const pty = this.ptys.get(termId);
    if (pty) {
      pty.resize(cols, rows);
    }
  }

  destroy(termId: string): void {
    const pty = this.ptys.get(termId);
    if (pty) {
      pty.kill();
      this.ptys.delete(termId);
    }
  }

  destroyAll(): void {
    for (const [id] of this.ptys) {
      this.destroy(id);
    }
  }
}
