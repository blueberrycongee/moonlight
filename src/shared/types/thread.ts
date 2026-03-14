export type ThreadStatus = "idle" | "running" | "waiting" | "archived";

export interface Thread {
  id: string;
  projectId: string;
  title: string;
  status: ThreadStatus;
  workDir: string;
  createdAt: number;
  updatedAt: number;
  kimiSessionId?: string;
  metadata: {
    tokenUsage: { input: number; output: number };
    turnCount: number;
    lastError?: string;
  };
}
