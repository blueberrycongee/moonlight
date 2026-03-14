import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MoonlightDB } from "../../src/main/db/database";
import type { Project } from "../../src/shared/types/project";
import type { Thread } from "../../src/shared/types/thread";

let tmpDir: string;
let db: MoonlightDB;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "moonlight-test-"));
  db = new MoonlightDB(tmpDir);
}

afterEach(() => {
  db?.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    path: "/tmp/test",
    threads: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeThread(overrides?: Partial<Thread>): Thread {
  return {
    id: "thread-1",
    projectId: "proj-1",
    title: "Test Thread",
    status: "idle",
    workDir: "/tmp/work",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      tokenUsage: { input: 0, output: 0 },
      turnCount: 0,
    },
    ...overrides,
  };
}

describe("MoonlightDB", () => {
  it("creates tables on initialization", () => {
    setup();
    const tables = db.listTables();
    expect(tables).toContain("projects");
    expect(tables).toContain("threads");
  });

  it("inserts and retrieves a project", () => {
    setup();
    const project = makeProject();
    db.insertProject(project);

    const result = db.getProject("proj-1");
    expect(result).toBeDefined();
    expect(result!.id).toBe("proj-1");
    expect(result!.name).toBe("Test Project");
    expect(result!.path).toBe("/tmp/test");
    expect(result!.threads).toEqual([]);
  });

  it("inserts and retrieves a thread", () => {
    setup();
    db.insertProject(makeProject());
    const thread = makeThread();
    db.insertThread(thread);

    const result = db.getThread("thread-1");
    expect(result).toBeDefined();
    expect(result!.id).toBe("thread-1");
    expect(result!.projectId).toBe("proj-1");
    expect(result!.title).toBe("Test Thread");
    expect(result!.status).toBe("idle");
    expect(result!.metadata.tokenUsage).toEqual({ input: 0, output: 0 });
    expect(result!.metadata.turnCount).toBe(0);
  });

  it("updates thread status", () => {
    setup();
    db.insertProject(makeProject());
    db.insertThread(makeThread());

    db.updateThreadStatus("thread-1", "running");

    const result = db.getThread("thread-1");
    expect(result!.status).toBe("running");
  });

  it("lists threads by project", () => {
    setup();
    db.insertProject(makeProject());
    db.insertThread(makeThread({ id: "t-1", createdAt: 1000 }));
    db.insertThread(makeThread({ id: "t-2", createdAt: 2000 }));

    const threads = db.getThreadsByProject("proj-1");
    expect(threads).toHaveLength(2);
    expect(threads[0].id).toBe("t-1");
    expect(threads[1].id).toBe("t-2");
  });

  it("deletes a thread", () => {
    setup();
    db.insertProject(makeProject());
    db.insertThread(makeThread());

    db.deleteThread("thread-1");

    const result = db.getThread("thread-1");
    expect(result).toBeUndefined();
  });

  it("updates thread metadata", () => {
    setup();
    db.insertProject(makeProject());
    db.insertThread(makeThread());

    db.updateThreadMetadata("thread-1", {
      tokenUsage: { input: 100, output: 200 },
      turnCount: 5,
      lastError: "timeout",
    });

    const result = db.getThread("thread-1");
    expect(result!.metadata.tokenUsage).toEqual({ input: 100, output: 200 });
    expect(result!.metadata.turnCount).toBe(5);
    expect(result!.metadata.lastError).toBe("timeout");
  });

  it("getProject returns thread IDs", () => {
    setup();
    db.insertProject(makeProject());
    db.insertThread(makeThread({ id: "t-1", createdAt: 1000 }));
    db.insertThread(makeThread({ id: "t-2", createdAt: 2000 }));

    const project = db.getProject("proj-1");
    expect(project!.threads).toEqual(["t-1", "t-2"]);
  });
});
