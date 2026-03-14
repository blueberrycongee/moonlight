import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MoonlightDB } from "../../src/main/db/database";
import { ThreadManager } from "../../src/main/managers/ThreadManager";
import type { WireEvent } from "../../src/shared/types/wire";

let tmpDir: string;
let db: MoonlightDB;
let manager: ThreadManager;

const PROJECT_ID = "proj-1";

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "moonlight-tm-test-"));
  db = new MoonlightDB(tmpDir);
  db.insertProject({
    id: PROJECT_ID,
    name: "Test Project",
    path: "/tmp/test",
    threads: [],
    createdAt: Date.now(),
  });
  manager = new ThreadManager(db, tmpDir);
}

afterEach(() => {
  db?.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ThreadManager", () => {
  it("creates a thread with idle status", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");

    expect(thread.id).toBeDefined();
    expect(thread.projectId).toBe(PROJECT_ID);
    expect(thread.status).toBe("idle");
    expect(thread.workDir).toBe("/tmp/work");
    expect(thread.metadata.tokenUsage).toEqual({ input: 0, output: 0 });
    expect(thread.metadata.turnCount).toBe(0);

    // Should also be persisted in DB
    const fromDb = db.getThread(thread.id);
    expect(fromDb).toBeDefined();
    expect(fromDb!.status).toBe("idle");
  });

  it("creates a thread with a custom title", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work", "My Thread");
    expect(thread.title).toBe("My Thread");
  });

  it("creates history directory on create", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");
    const historyDir = path.join(
      tmpDir,
      "projects",
      PROJECT_ID,
      "threads",
      thread.id,
    );
    expect(fs.existsSync(historyDir)).toBe(true);
  });

  it("gets a thread by id", () => {
    setup();
    const created = manager.create(PROJECT_ID, "/tmp/work");
    const fetched = manager.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
  });

  it("lists threads for a project", () => {
    setup();
    manager.create(PROJECT_ID, "/tmp/work", "Thread A");
    manager.create(PROJECT_ID, "/tmp/work", "Thread B");

    const threads = manager.listByProject(PROJECT_ID);
    expect(threads).toHaveLength(2);
  });

  it("transitions status correctly", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");

    manager.setStatus(thread.id, "running");
    expect(manager.get(thread.id)!.status).toBe("running");

    manager.setStatus(thread.id, "waiting");
    expect(manager.get(thread.id)!.status).toBe("waiting");

    manager.setStatus(thread.id, "archived");
    expect(manager.get(thread.id)!.status).toBe("archived");
  });

  it("updates metadata", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");

    manager.updateMetadata(thread.id, {
      tokenUsage: { input: 500, output: 1000 },
      turnCount: 3,
      lastError: "rate_limit",
    });

    const updated = manager.get(thread.id)!;
    expect(updated.metadata.tokenUsage).toEqual({ input: 500, output: 1000 });
    expect(updated.metadata.turnCount).toBe(3);
    expect(updated.metadata.lastError).toBe("rate_limit");
  });

  it("deletes a thread and its history directory", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");
    const historyDir = path.join(
      tmpDir,
      "projects",
      PROJECT_ID,
      "threads",
      thread.id,
    );

    // Write something to history to confirm dir exists
    manager.appendHistory(thread.id, { type: "TurnBegin", data: {} });
    expect(fs.existsSync(historyDir)).toBe(true);

    manager.delete(thread.id);

    expect(manager.get(thread.id)).toBeUndefined();
    expect(fs.existsSync(historyDir)).toBe(false);
  });

  it("appends to and reads from history.jsonl", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");

    const event1: WireEvent = { type: "TurnBegin", data: { turn: 1 } };
    const event2: WireEvent = {
      type: "ContentPart",
      data: { text: "hello" },
    };
    const event3: WireEvent = { type: "TurnEnd", data: { turn: 1 } };

    manager.appendHistory(thread.id, event1);
    manager.appendHistory(thread.id, event2);
    manager.appendHistory(thread.id, event3);

    const history = manager.readHistory(thread.id);
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual(event1);
    expect(history[1]).toEqual(event2);
    expect(history[2]).toEqual(event3);
  });

  it("readHistory returns empty array when no history exists", () => {
    setup();
    const thread = manager.create(PROJECT_ID, "/tmp/work");
    const history = manager.readHistory(thread.id);
    expect(history).toEqual([]);
  });
});
