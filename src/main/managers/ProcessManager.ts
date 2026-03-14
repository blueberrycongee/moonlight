import { WireClient } from "../wire/WireClient";
import { ThreadManager } from "./ThreadManager";
import type {
  WireOptions,
  WireEvent,
  ApprovalRequest,
} from "../../shared/types/wire";
import type { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../shared/types/ipc";

export class ProcessManager {
  private clients = new Map<string, WireClient>();

  constructor(
    private threadManager: ThreadManager,
    private getWindow: () => BrowserWindow | null,
  ) {}

  start(threadId: string, options: WireOptions): WireClient {
    this.stop(threadId);

    const client = new WireClient();
    this.clients.set(threadId, client);

    client.on("wireEvent", (event: WireEvent) => {
      this.threadManager.appendHistory(threadId, event);
      this.send(IPC_CHANNELS.THREAD_EVENT, { threadId, event });
    });

    client.on("TurnBegin", () => {
      this.threadManager.setStatus(threadId, "running");
      this.send(IPC_CHANNELS.THREAD_STATUS, {
        threadId,
        status: "running",
      });
    });

    client.on("TurnEnd", (data: unknown) => {
      this.threadManager.setStatus(threadId, "idle");

      const thread = this.threadManager.get(threadId);
      if (thread) {
        const metadata = { ...thread.metadata };
        metadata.turnCount += 1;

        const turnData = data as Record<string, unknown> | undefined;
        if (turnData?.token_usage) {
          const usage = turnData.token_usage as {
            input: number;
            output: number;
          };
          metadata.tokenUsage = {
            input: metadata.tokenUsage.input + usage.input,
            output: metadata.tokenUsage.output + usage.output,
          };
        }

        this.threadManager.updateMetadata(threadId, metadata);
      }

      this.send(IPC_CHANNELS.THREAD_STATUS, {
        threadId,
        status: "idle",
      });
    });

    client.on("approval", (request: ApprovalRequest) => {
      this.threadManager.setStatus(threadId, "waiting");
      this.send(IPC_CHANNELS.THREAD_APPROVAL, { threadId, request });
      this.send(IPC_CHANNELS.THREAD_STATUS, {
        threadId,
        status: "waiting",
      });
    });

    client.on("exit", () => {
      this.clients.delete(threadId);
      this.threadManager.setStatus(threadId, "idle");
      this.send(IPC_CHANNELS.THREAD_STATUS, {
        threadId,
        status: "idle",
        exited: true,
      });
    });

    client.start(options);
    return client;
  }

  stop(threadId: string): void {
    const client = this.clients.get(threadId);
    if (client) {
      client.stop();
      this.clients.delete(threadId);
    }
  }

  get(threadId: string): WireClient | undefined {
    return this.clients.get(threadId);
  }

  stopAll(): void {
    for (const [threadId, client] of this.clients) {
      client.stop();
      this.clients.delete(threadId);
    }
  }

  private send(channel: string, payload: unknown): void {
    const win = this.getWindow();
    win?.webContents.send(channel, payload);
  }
}
