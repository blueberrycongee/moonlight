import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";
import { JsonlParser } from "./parser";
import {
  createInitialize,
  createPrompt,
  createCancel,
  createSteer,
  createSetPlanMode,
  serialize,
} from "./protocol";
import type {
  WireOptions,
  ApprovalRequest,
  ApprovalDecision,
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from "../../shared/types/wire";

type ApprovalHandler = (
  request: ApprovalRequest,
  respond: (decision: ApprovalDecision) => void,
) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class WireClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private parser: JsonlParser | null = null;
  private pending = new Map<number | string, PendingRequest>();
  private approvalHandler: ApprovalHandler | null = null;

  start(options: WireOptions): void {
    const args = ["--wire", "--work-dir", options.workDir];

    if (options.sessionId) {
      args.push("--session", options.sessionId);
    }

    if (options.additionalArgs) {
      args.push(...options.additionalArgs);
    }

    this.process = spawn("kimi", args, { stdio: ["pipe", "pipe", "pipe"] });

    this.parser = new JsonlParser(
      (msg) => this.handleMessage(msg),
      (err, raw) => this.emit("error", err, raw),
    );

    this.process.stdout!.on("data", (chunk: Buffer | string) => {
      this.parser!.feed(chunk.toString());
    });

    this.process.stderr!.on("data", (chunk: Buffer | string) => {
      this.emit("stderr", chunk.toString());
    });

    this.process.on("exit", (code, signal) => {
      this.emit("exit", code, signal);
    });

    this.process.on("error", (err) => {
      this.emit("error", err);
    });
  }

  stop(): void {
    this.process?.kill();
  }

  initialize(): Promise<unknown> {
    return this.sendRequest(createInitialize());
  }

  prompt(text: string): Promise<unknown> {
    return this.sendRequest(createPrompt(text));
  }

  cancel(): Promise<unknown> {
    return this.sendRequest(createCancel());
  }

  steer(message: string): Promise<unknown> {
    return this.sendRequest(createSteer(message));
  }

  setPlanMode(enabled: boolean): Promise<unknown> {
    return this.sendRequest(createSetPlanMode(enabled));
  }

  onApprovalRequest(handler: ApprovalHandler): void {
    this.approvalHandler = handler;
  }

  private sendRequest(request: JsonRpcRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      this.process!.stdin!.write(serialize(request));
    });
  }

  private handleMessage(msg: any): void {
    // JSON-RPC response (has id + result or error)
    if ("id" in msg && ("result" in msg || "error" in msg)) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if ("error" in msg) {
          const errResp = msg as JsonRpcErrorResponse;
          pending.reject(new Error(errResp.error.message));
        } else {
          const succResp = msg as JsonRpcSuccessResponse;
          pending.resolve(succResp.result);
        }
      }
      return;
    }

    // JSON-RPC notification (method but no id) — events
    if ("method" in msg && msg.method === "event" && msg.params) {
      const { type, data } = msg.params as { type: string; data: unknown };
      this.emit(type, data);
      this.emit("wireEvent", { type, data });
      return;
    }

    // JSON-RPC request from server (has id + method) — approval requests
    if ("id" in msg && "method" in msg && msg.method === "approval") {
      const approvalReq = msg.params as ApprovalRequest;
      if (this.approvalHandler) {
        this.approvalHandler(approvalReq, (decision: ApprovalDecision) => {
          const response = {
            jsonrpc: "2.0" as const,
            id: msg.id,
            result: { id: approvalReq.id, decision },
          };
          this.process!.stdin!.write(serialize(response));
        });
      }
      return;
    }
  }
}
