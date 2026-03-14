import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { MoonlightDB } from "../db/database";
import type { Thread, ThreadStatus } from "../../shared/types/thread";
import type { WireEvent } from "../../shared/types/wire";

export class ThreadManager {
  constructor(
    private db: MoonlightDB,
    private dataDir: string,
  ) {}

  create(projectId: string, workDir: string, title?: string): Thread {
    const now = Date.now();
    const thread: Thread = {
      id: randomUUID(),
      projectId,
      title: title ?? "Untitled",
      status: "idle",
      workDir,
      createdAt: now,
      updatedAt: now,
      metadata: {
        tokenUsage: { input: 0, output: 0 },
        turnCount: 0,
      },
    };

    this.db.insertThread(thread);
    fs.mkdirSync(this.historyDir(thread), { recursive: true });
    return thread;
  }

  get(id: string): Thread | undefined {
    return this.db.getThread(id);
  }

  listByProject(projectId: string): Thread[] {
    return this.db.getThreadsByProject(projectId);
  }

  setStatus(id: string, status: ThreadStatus): void {
    this.db.updateThreadStatus(id, status);
  }

  updateMetadata(id: string, metadata: Thread["metadata"]): void {
    this.db.updateThreadMetadata(id, metadata);
  }

  delete(id: string): void {
    const thread = this.db.getThread(id);
    this.db.deleteThread(id);
    if (thread) {
      const dir = this.historyDir(thread);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  appendHistory(threadId: string, event: WireEvent): void {
    const thread = this.db.getThread(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const filePath = this.historyFile(thread);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n");
  }

  readHistory(threadId: string): WireEvent[] {
    const thread = this.db.getThread(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const filePath = this.historyFile(thread);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8").trimEnd();
    if (content === "") return [];
    return content.split("\n").map((line) => JSON.parse(line) as WireEvent);
  }

  private historyDir(thread: Thread): string {
    return path.join(
      this.dataDir,
      "projects",
      thread.projectId,
      "threads",
      thread.id,
    );
  }

  private historyFile(thread: Thread): string {
    return path.join(this.historyDir(thread), "history.jsonl");
  }
}
