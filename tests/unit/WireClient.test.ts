import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";

// Mock child_process before importing WireClient
vi.mock("child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

import { spawn } from "child_process";
import { WireClient } from "../../src/main/wire/WireClient";
import { resetIdCounter } from "../../src/main/wire/protocol";

const mockSpawn = vi.mocked(spawn);

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdin = { write: vi.fn() } as any;
  proc.stdout = new EventEmitter() as any;
  proc.stderr = new EventEmitter() as any;
  proc.kill = vi.fn();
  proc.pid = 12345;
  return proc;
}

describe("WireClient", () => {
  let client: WireClient;
  let proc: ChildProcess;

  beforeEach(() => {
    resetIdCounter();
    proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    client = new WireClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start()", () => {
    it("spawns kimi with correct base args", () => {
      client.start({ workDir: "/test/dir" });

      expect(mockSpawn).toHaveBeenCalledWith(
        "kimi",
        ["--wire", "--work-dir", "/test/dir"],
        expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] }),
      );
    });

    it("includes --session when sessionId is provided", () => {
      client.start({ workDir: "/test/dir", sessionId: "abc-123" });

      expect(mockSpawn).toHaveBeenCalledWith(
        "kimi",
        ["--wire", "--work-dir", "/test/dir", "--session", "abc-123"],
        expect.any(Object),
      );
    });

    it("includes additional args", () => {
      client.start({
        workDir: "/test/dir",
        additionalArgs: ["--verbose", "--no-color"],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        "kimi",
        ["--wire", "--work-dir", "/test/dir", "--verbose", "--no-color"],
        expect.any(Object),
      );
    });
  });

  describe("event parsing", () => {
    it("emits typed events from stdout notifications", () => {
      client.start({ workDir: "/test" });

      const handler = vi.fn();
      client.on("ContentPart", handler);

      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: {
          type: "ContentPart",
          data: { type: "text", text: "hello" },
        },
      });
      proc.stdout!.emit("data", notification + "\n");

      expect(handler).toHaveBeenCalledWith({
        type: "text",
        text: "hello",
      });
    });

    it("emits wireEvent for every event notification", () => {
      client.start({ workDir: "/test" });

      const handler = vi.fn();
      client.on("wireEvent", handler);

      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "event",
        params: {
          type: "TurnBegin",
          data: { turn_id: 1 },
        },
      });
      proc.stdout!.emit("data", notification + "\n");

      expect(handler).toHaveBeenCalledWith({
        type: "TurnBegin",
        data: { turn_id: 1 },
      });
    });
  });

  describe("prompt()", () => {
    it("writes JSON-RPC request to stdin", () => {
      client.start({ workDir: "/test" });
      client.prompt("hello world");

      expect(proc.stdin!.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"prompt"'),
      );
      expect(proc.stdin!.write).toHaveBeenCalledWith(
        expect.stringContaining('"content":"hello world"'),
      );
    });
  });

  describe("response handling", () => {
    it("resolves pending promise when response arrives", async () => {
      client.start({ workDir: "/test" });

      const promise = client.initialize();

      // The initialize request should have id=1
      const response = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { protocol_version: "1.5" },
      });
      proc.stdout!.emit("data", response + "\n");

      const result = await promise;
      expect(result).toEqual({ protocol_version: "1.5" });
    });

    it("rejects pending promise on error response", async () => {
      client.start({ workDir: "/test" });

      const promise = client.initialize();

      const response = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -1, message: "init failed" },
      });
      proc.stdout!.emit("data", response + "\n");

      await expect(promise).rejects.toThrow("init failed");
    });
  });

  describe("approval handling", () => {
    it("calls approval handler on approval request", () => {
      client.start({ workDir: "/test" });

      const approvalHandler = vi.fn();
      client.onApprovalRequest(approvalHandler);

      const request = JSON.stringify({
        jsonrpc: "2.0",
        id: 42,
        method: "approval",
        params: {
          id: "req-1",
          type: "command",
          description: "run npm install",
        },
      });
      proc.stdout!.emit("data", request + "\n");

      expect(approvalHandler).toHaveBeenCalledWith(
        {
          id: "req-1",
          type: "command",
          description: "run npm install",
        },
        expect.any(Function),
      );
    });
  });

  describe("stop()", () => {
    it("kills the child process", () => {
      client.start({ workDir: "/test" });
      client.stop();

      expect(proc.kill).toHaveBeenCalled();
    });
  });

  describe("process exit", () => {
    it("emits exit event when process exits", () => {
      client.start({ workDir: "/test" });

      const handler = vi.fn();
      client.on("exit", handler);

      proc.emit("exit", 0, null);

      expect(handler).toHaveBeenCalledWith(0, null);
    });
  });
});
