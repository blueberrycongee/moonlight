import { ipcMain, dialog, BrowserWindow } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { IPC_CHANNELS } from "../shared/types/ipc";
import { ProcessManager } from "./managers/ProcessManager";
import { TerminalManager } from "./managers/TerminalManager";
import { ThreadManager } from "./managers/ThreadManager";
import { MoonlightDB } from "./db/database";
import type { Project } from "../shared/types/project";
import type { ApprovalDecision } from "../shared/types/wire";

interface IpcDeps {
  db: MoonlightDB;
  threadManager: ThreadManager;
  processManager: ProcessManager;
  terminalManager: TerminalManager;
  getWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers({
  db,
  threadManager,
  processManager,
  terminalManager,
  getWindow,
}: IpcDeps): void {
  // ── Project ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_DIR, async () => {
    const win = getWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const dirPath = result.filePaths[0];
    const existing = db.getProjectByPath(dirPath);
    if (existing) return existing;

    const project: Project = {
      id: randomUUID(),
      name: path.basename(dirPath),
      path: dirPath,
      threads: [],
      createdAt: Date.now(),
    };

    db.insertProject(project);
    return project;
  });

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GET,
    (_event, { projectId }: { projectId: string }) => {
      return db.getProject(projectId) ?? null;
    },
  );

  // ── Threads ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.THREAD_CREATE,
    (
      _event,
      {
        projectId,
        workDir,
        title,
      }: { projectId: string; workDir: string; title?: string },
    ) => {
      return threadManager.create(projectId, workDir, title);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_LIST,
    (_event, { projectId }: { projectId: string }) => {
      return threadManager.listByProject(projectId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_DELETE,
    (_event, { threadId }: { threadId: string }) => {
      processManager.stop(threadId);
      threadManager.delete(threadId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_RESTORE,
    (_event, { threadId }: { threadId: string }) => {
      return threadManager.readHistory(threadId);
    },
  );

  // ── Prompt / Agent lifecycle ─────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.THREAD_PROMPT,
    async (_event, { threadId, text }: { threadId: string; text: string }) => {
      let client = processManager.get(threadId);

      if (!client) {
        const thread = threadManager.get(threadId);
        if (!thread) throw new Error(`Thread not found: ${threadId}`);

        client = processManager.start(threadId, { workDir: thread.workDir });
        await client.initialize();
      }

      await client.prompt(text);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_APPROVE,
    (
      _event,
      { threadId, decision }: { threadId: string; decision: ApprovalDecision },
    ) => {
      const client = processManager.get(threadId);
      if (!client) throw new Error(`No active client for thread: ${threadId}`);

      // The approval is handled via the approval handler set in ProcessManager,
      // but we need a way to forward it. Use the event emitter pattern:
      // emit the decision so the pending approval handler can respond.
      client.emit("approvalDecision", decision);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_CANCEL,
    async (_event, { threadId }: { threadId: string }) => {
      const client = processManager.get(threadId);
      if (client) {
        await client.cancel();
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.THREAD_STEER,
    async (
      _event,
      { threadId, message }: { threadId: string; message: string },
    ) => {
      const client = processManager.get(threadId);
      if (!client) throw new Error(`No active client for thread: ${threadId}`);
      await client.steer(message);
    },
  );

  // ── Terminal ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    (
      _event,
      {
        termId,
        workDir,
        shell,
      }: { termId: string; workDir: string; shell?: string },
    ) => {
      return terminalManager.create(termId, workDir, shell);
    },
  );

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_INPUT,
    (_event, { termId, data }: { termId: string; data: string }) => {
      terminalManager.write(termId, data);
    },
  );

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_RESIZE,
    (
      _event,
      { termId, cols, rows }: { termId: string; cols: number; rows: number },
    ) => {
      terminalManager.resize(termId, cols, rows);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_DESTROY,
    (_event, { termId }: { termId: string }) => {
      terminalManager.destroy(termId);
    },
  );
}
