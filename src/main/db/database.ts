import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../../shared/types/project";
import type { Thread, ThreadStatus } from "../../shared/types/thread";

export class MoonlightDB {
  private db: Database.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, "moonlight.db"));
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        workDir TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        kimiSessionId TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );
    `);
  }

  listTables(): string[] {
    const rows = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  insertProject(project: Project): void {
    this.db
      .prepare(
        "INSERT INTO projects (id, name, path, createdAt) VALUES (?, ?, ?, ?)",
      )
      .run(project.id, project.name, project.path, project.createdAt);
  }

  getProjectByPath(
    dirPath: string,
  ): (Project & { threads: string[] }) | undefined {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE path = ?")
      .get(dirPath) as
      | { id: string; name: string; path: string; createdAt: number }
      | undefined;
    if (!row) return undefined;

    const threadRows = this.db
      .prepare("SELECT id FROM threads WHERE projectId = ? ORDER BY createdAt")
      .all(row.id) as { id: string }[];

    return {
      ...row,
      threads: threadRows.map((t) => t.id),
    };
  }

  getProject(id: string): (Project & { threads: string[] }) | undefined {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as
      | { id: string; name: string; path: string; createdAt: number }
      | undefined;
    if (!row) return undefined;

    const threadRows = this.db
      .prepare("SELECT id FROM threads WHERE projectId = ? ORDER BY createdAt")
      .all(id) as { id: string }[];

    return {
      ...row,
      threads: threadRows.map((t) => t.id),
    };
  }

  insertThread(thread: Thread): void {
    this.db
      .prepare(
        `INSERT INTO threads (id, projectId, title, status, workDir, createdAt, updatedAt, kimiSessionId, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        thread.id,
        thread.projectId,
        thread.title,
        thread.status,
        thread.workDir,
        thread.createdAt,
        thread.updatedAt,
        thread.kimiSessionId ?? null,
        JSON.stringify(thread.metadata),
      );
  }

  getThread(id: string): Thread | undefined {
    const row = this.db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToThread(row);
  }

  getThreadsByProject(projectId: string): Thread[] {
    const rows = this.db
      .prepare("SELECT * FROM threads WHERE projectId = ? ORDER BY createdAt")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToThread(r));
  }

  updateThreadStatus(id: string, status: ThreadStatus): void {
    this.db
      .prepare("UPDATE threads SET status = ?, updatedAt = ? WHERE id = ?")
      .run(status, Date.now(), id);
  }

  updateThreadMetadata(id: string, metadata: Thread["metadata"]): void {
    this.db
      .prepare("UPDATE threads SET metadata = ?, updatedAt = ? WHERE id = ?")
      .run(JSON.stringify(metadata), Date.now(), id);
  }

  deleteThread(id: string): void {
    this.db.prepare("DELETE FROM threads WHERE id = ?").run(id);
  }

  close(): void {
    this.db.close();
  }

  private rowToThread(row: Record<string, unknown>): Thread {
    return {
      id: row.id as string,
      projectId: row.projectId as string,
      title: row.title as string,
      status: row.status as ThreadStatus,
      workDir: row.workDir as string,
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
      kimiSessionId: (row.kimiSessionId as string) ?? undefined,
      metadata: JSON.parse(row.metadata as string),
    };
  }
}
