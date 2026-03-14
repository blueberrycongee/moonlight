# Moonlight Desktop — Phase 1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a functional Electron desktop app that wraps Kimi CLI via Wire mode, supporting multi-thread conversations, streaming output, approval workflows, and an embedded terminal.

**Architecture:** Electron Main process spawns `kimi --wire` child processes (one per Thread), communicates via JSON-RPC 2.0 over stdio. React renderer receives events via Electron IPC and renders conversation UI with Kimi brand theming.

**Tech Stack:** Electron Forge, React 18, Vite, TypeScript, Zustand, Tailwind CSS, xterm.js, node-pty, better-sqlite3, Vitest

---

### Task 1: Project Scaffolding

**Files:**
- Create: `moonlight/package.json`
- Create: `moonlight/forge.config.ts`
- Create: `moonlight/vite.main.config.ts`
- Create: `moonlight/vite.renderer.config.ts`
- Create: `moonlight/tsconfig.json`
- Create: `moonlight/tailwind.config.ts`
- Create: `moonlight/postcss.config.js`
- Create: `moonlight/src/main/index.ts`
- Create: `moonlight/src/renderer/index.html`
- Create: `moonlight/src/renderer/main.tsx`
- Create: `moonlight/src/renderer/App.tsx`
- Create: `moonlight/src/preload/index.ts`

**Step 1: Initialize Electron Forge project with Vite template**

```bash
cd /Users/blueberrycongee
npx create-electron-app@latest moonlight -- --template=vite-typescript
cd moonlight
```

**Step 2: Install core dependencies**

```bash
npm install react react-dom zustand tailwindcss @tailwindcss/vite postcss lucide-react framer-motion
npm install -D @types/react @types/react-dom vitest @vitejs/plugin-react
```

**Step 3: Configure Tailwind CSS**

Create `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0071e3', hover: '#0051a2' },
        surface: { dark: '#1d1d1f', light: '#fbfbfd' },
        border: { DEFAULT: '#e5e5e7' },
        text: { primary: '#1d1d1f', secondary: '#6e6e73', inverse: '#f5f5f7' },
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 4: Create minimal React App with Kimi dark theme**

`src/renderer/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="h-screen bg-surface-dark text-text-inverse flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Moonlight</h1>
    </div>
  );
}
```

`src/renderer/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(<App />);
```

`src/renderer/styles/globals.css`:
```css
@import 'tailwindcss';
```

**Step 5: Update Electron main process to load React**

Update `src/main/index.ts` to create a frameless BrowserWindow (for custom title bar) and load the Vite dev server or built HTML.

**Step 6: Configure preload script**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  invoke: (channel: string, data: unknown) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
```

**Step 7: Run dev and verify window opens**

```bash
npm run dev
```

Expected: Electron window opens showing "Moonlight" centered on dark background.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron + React + Vite + Tailwind project"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/shared/types/wire.ts`
- Create: `src/shared/types/thread.ts`
- Create: `src/shared/types/project.ts`
- Create: `src/shared/types/ipc.ts`

**Step 1: Define Wire protocol types**

`src/shared/types/wire.ts`:
```typescript
// JSON-RPC 2.0 base types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: number | string;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// Wire event types
export type WireEventType =
  | 'TurnBegin'
  | 'TurnEnd'
  | 'StepBegin'
  | 'StepInterrupted'
  | 'CompactionBegin'
  | 'CompactionEnd'
  | 'StatusUpdate'
  | 'ContentPart'
  | 'ToolCall'
  | 'ToolCallPart'
  | 'ToolResult'
  | 'ApprovalResponse'
  | 'SubagentEvent'
  | 'SteerInput';

export interface WireEvent {
  type: WireEventType;
  data: unknown;
}

// ContentPart subtypes
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ThinkPart {
  type: 'think';
  text: string;
}

export interface ImageURLPart {
  type: 'image_url';
  url: string;
}

export type ContentPart = TextPart | ThinkPart | ImageURLPart;

// Display blocks
export interface BriefDisplayBlock {
  type: 'brief';
  content: string;
}

export interface DiffDisplayBlock {
  type: 'diff';
  path: string;
  old_text: string;
  new_text: string;
}

export interface TodoDisplayBlock {
  type: 'todo';
  items: Array<{ text: string; status: 'pending' | 'done' | 'failed' }>;
}

export interface ShellDisplayBlock {
  type: 'shell';
  command: string;
  output?: string;
  language?: string;
}

export type DisplayBlock =
  | BriefDisplayBlock
  | DiffDisplayBlock
  | TodoDisplayBlock
  | ShellDisplayBlock;

// Approval
export interface ApprovalRequest {
  id: string;
  type: 'command' | 'file_change';
  description: string;
  display_blocks?: DisplayBlock[];
}

export type ApprovalDecision = 'approve' | 'approve_for_session' | 'reject';

export interface ApprovalResponse {
  id: string;
  decision: ApprovalDecision;
}

// Status
export interface StatusUpdate {
  context_usage?: number;
  token_usage?: { input: number; output: number };
  plan_mode?: boolean;
}

// Wire client options
export interface WireOptions {
  workDir: string;
  sessionId?: string;
  additionalArgs?: string[];
}
```

**Step 2: Define Thread and Project types**

`src/shared/types/thread.ts`:
```typescript
export type ThreadStatus = 'idle' | 'running' | 'waiting' | 'archived';

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
```

`src/shared/types/project.ts`:
```typescript
export interface Project {
  id: string;
  name: string;
  path: string;
  threads: string[];
  createdAt: number;
}
```

**Step 3: Define IPC channel types**

`src/shared/types/ipc.ts`:
```typescript
export const IPC_CHANNELS = {
  // Main → Renderer
  THREAD_EVENT: 'thread:event',
  THREAD_APPROVAL: 'thread:approval',
  THREAD_STATUS: 'thread:status',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',

  // Renderer → Main
  THREAD_CREATE: 'thread:create',
  THREAD_DELETE: 'thread:delete',
  THREAD_PROMPT: 'thread:prompt',
  THREAD_APPROVE: 'thread:approve',
  THREAD_CANCEL: 'thread:cancel',
  THREAD_STEER: 'thread:steer',
  THREAD_LIST: 'thread:list',
  THREAD_RESTORE: 'thread:restore',
  PROJECT_SELECT_DIR: 'project:select-dir',
  PROJECT_GET: 'project:get',
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DESTROY: 'terminal:destroy',
} as const;
```

**Step 4: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared type definitions for Wire protocol, Thread, Project, IPC"
```

---

### Task 3: JSONL Parser

**Files:**
- Create: `src/main/wire/parser.ts`
- Create: `tests/unit/parser.test.ts`

**Step 1: Write failing tests**

`tests/unit/parser.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { JsonlParser } from '../../src/main/wire/parser';

describe('JsonlParser', () => {
  it('parses a single complete JSON line', () => {
    const handler = vi.fn();
    const parser = new JsonlParser(handler);
    parser.feed('{"jsonrpc":"2.0","method":"event","params":{"type":"TurnBegin"}}\n');
    expect(handler).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'TurnBegin' },
    });
  });

  it('handles chunked input across multiple feeds', () => {
    const handler = vi.fn();
    const parser = new JsonlParser(handler);
    parser.feed('{"jsonrpc":"2.0",');
    expect(handler).not.toHaveBeenCalled();
    parser.feed('"method":"event"}\n');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('handles multiple JSON lines in one chunk', () => {
    const handler = vi.fn();
    const parser = new JsonlParser(handler);
    parser.feed('{"a":1}\n{"b":2}\n');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { a: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { b: 2 });
  });

  it('calls error handler on invalid JSON', () => {
    const handler = vi.fn();
    const errorHandler = vi.fn();
    const parser = new JsonlParser(handler, errorHandler);
    parser.feed('not json\n');
    expect(handler).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/parser.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement JsonlParser**

`src/main/wire/parser.ts`:
```typescript
export class JsonlParser {
  private buffer = '';

  constructor(
    private onMessage: (msg: unknown) => void,
    private onError?: (err: Error, raw: string) => void,
  ) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        this.onMessage(JSON.parse(trimmed));
      } catch (err) {
        this.onError?.(err as Error, trimmed);
      }
    }
  }

  reset(): void {
    this.buffer = '';
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/parser.test.ts
```

Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add src/main/wire/parser.ts tests/unit/parser.test.ts
git commit -m "feat: add JSONL stream parser with tests"
```

---

### Task 4: WireClient

**Files:**
- Create: `src/main/wire/protocol.ts`
- Create: `src/main/wire/WireClient.ts`
- Create: `tests/unit/WireClient.test.ts`

**Step 1: Write Wire protocol helpers**

`src/main/wire/protocol.ts`:
```typescript
import type { JsonRpcRequest, JsonRpcNotification, ApprovalResponse } from '../../shared/types/wire';

let nextId = 1;

export function createRequest(method: string, params?: unknown): JsonRpcRequest {
  return { jsonrpc: '2.0', id: nextId++, method, params };
}

export function createInitialize(): JsonRpcRequest {
  return createRequest('initialize', { protocol_version: '1.5' });
}

export function createPrompt(text: string): JsonRpcRequest {
  return createRequest('prompt', { content: text });
}

export function createCancel(): JsonRpcRequest {
  return createRequest('cancel');
}

export function createSteer(message: string): JsonRpcRequest {
  return createRequest('steer', { content: message });
}

export function createSetPlanMode(enabled: boolean): JsonRpcRequest {
  return createRequest('set_plan_mode', { enabled });
}

export function createApprovalResponse(response: ApprovalResponse): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: response.id,
    result: { decision: response.decision },
  });
}

export function serialize(msg: object): string {
  return JSON.stringify(msg) + '\n';
}
```

**Step 2: Write failing WireClient tests**

`tests/unit/WireClient.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { WireClient } from '../../src/main/wire/WireClient';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.stdin = { write: vi.fn() };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.pid = 12345;
    return proc;
  }),
}));

describe('WireClient', () => {
  let client: WireClient;

  beforeEach(() => {
    client = new WireClient();
  });

  it('starts a kimi --wire process with correct args', async () => {
    const { spawn } = await import('child_process');
    client.start({ workDir: '/tmp/test' });
    expect(spawn).toHaveBeenCalledWith(
      'kimi',
      expect.arrayContaining(['--wire', '--work-dir', '/tmp/test']),
      expect.any(Object),
    );
  });

  it('emits parsed events from stdout', async () => {
    const handler = vi.fn();
    client.on('ContentPart', handler);
    client.start({ workDir: '/tmp/test' });

    const { spawn } = await import('child_process');
    const proc = (spawn as any).mock.results[0].value;
    const msg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'event',
      params: { type: 'ContentPart', data: { type: 'text', text: 'hello' } },
    });
    proc.stdout.emit('data', msg + '\n');

    expect(handler).toHaveBeenCalledWith({ type: 'text', text: 'hello' });
  });

  it('sends prompt via stdin', () => {
    client.start({ workDir: '/tmp/test' });
    const { spawn } = await import('child_process');
    const proc = (spawn as any).mock.results[0].value;
    client.prompt('fix the bug');
    expect(proc.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"method":"prompt"'),
    );
  });
});
```

**Step 3: Implement WireClient**

`src/main/wire/WireClient.ts`:
```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { JsonlParser } from './parser';
import { createInitialize, createPrompt, createCancel, createSteer, createSetPlanMode, serialize } from './protocol';
import type { WireOptions, WireEventType, ApprovalRequest, ApprovalDecision } from '../../shared/types/wire';

export class WireClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private parser: JsonlParser | null = null;
  private pendingRequests = new Map<number | string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private approvalHandler?: (req: ApprovalRequest) => Promise<ApprovalDecision>;

  start(options: WireOptions): void {
    const args = ['--wire', '--work-dir', options.workDir];
    if (options.sessionId) {
      args.push('--session', options.sessionId);
    }
    if (options.additionalArgs) {
      args.push(...options.additionalArgs);
    }

    this.process = spawn('kimi', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.parser = new JsonlParser(
      (msg) => this.handleMessage(msg),
      (err, raw) => this.emit('error', err, raw),
    );

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.parser?.feed(chunk.toString());
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.emit('stderr', chunk.toString());
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
      this.process = null;
    });
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
    this.parser?.reset();
  }

  async initialize(): Promise<unknown> {
    return this.sendRequest(createInitialize());
  }

  async prompt(text: string): Promise<unknown> {
    return this.sendRequest(createPrompt(text));
  }

  async cancel(): Promise<unknown> {
    return this.sendRequest(createCancel());
  }

  async steer(message: string): Promise<unknown> {
    return this.sendRequest(createSteer(message));
  }

  async setPlanMode(enabled: boolean): Promise<unknown> {
    return this.sendRequest(createSetPlanMode(enabled));
  }

  onApprovalRequest(handler: (req: ApprovalRequest) => Promise<ApprovalDecision>): void {
    this.approvalHandler = handler;
  }

  private sendRequest(request: { jsonrpc: '2.0'; id: number | string; method: string; params?: unknown }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('Process not running'));
        return;
      }
      this.pendingRequests.set(request.id, { resolve, reject });
      this.process.stdin.write(serialize(request));
    });
  }

  private handleMessage(msg: any): void {
    // Response to our request
    if ('id' in msg && ('result' in msg || 'error' in msg)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if ('error' in msg) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Event notification
    if (msg.method === 'event' && msg.params) {
      const { type, data } = msg.params as { type: WireEventType; data: unknown };
      this.emit(type, data);
      this.emit('wireEvent', { type, data });
      return;
    }

    // Approval request from agent
    if (msg.method === 'request' && msg.params?.type === 'ApprovalRequest') {
      this.handleApproval(msg);
      return;
    }
  }

  private async handleApproval(msg: any): Promise<void> {
    if (!this.approvalHandler) {
      this.emit('approval', msg.params);
      return;
    }

    try {
      const decision = await this.approvalHandler(msg.params);
      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { decision },
      }) + '\n';
      this.process?.stdin?.write(response);
    } catch (err) {
      this.emit('error', err);
    }
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/unit/WireClient.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/wire/ tests/unit/WireClient.test.ts
git commit -m "feat: add WireClient for JSON-RPC communication with kimi --wire"
```

---

### Task 5: SQLite Database

**Files:**
- Create: `src/main/db/database.ts`
- Create: `tests/unit/database.test.ts`

**Step 1: Install better-sqlite3**

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

**Step 2: Write failing tests**

`tests/unit/database.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/main/db/database';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Database', () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moonlight-test-'));
    db = new Database(tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates tables on initialization', () => {
    const tables = db.listTables();
    expect(tables).toContain('projects');
    expect(tables).toContain('threads');
  });

  it('inserts and retrieves a project', () => {
    const project = { id: 'p1', name: 'Test', path: '/tmp', createdAt: Date.now() };
    db.insertProject(project);
    const result = db.getProject('p1');
    expect(result?.name).toBe('Test');
  });

  it('inserts and retrieves a thread', () => {
    const project = { id: 'p1', name: 'Test', path: '/tmp', createdAt: Date.now() };
    db.insertProject(project);
    const thread = {
      id: 't1', projectId: 'p1', title: 'Thread 1', status: 'idle' as const,
      workDir: '/tmp', createdAt: Date.now(), updatedAt: Date.now(),
      metadata: { tokenUsage: { input: 0, output: 0 }, turnCount: 0 },
    };
    db.insertThread(thread);
    const result = db.getThread('t1');
    expect(result?.title).toBe('Thread 1');
  });

  it('updates thread status', () => {
    const project = { id: 'p1', name: 'Test', path: '/tmp', createdAt: Date.now() };
    db.insertProject(project);
    const thread = {
      id: 't1', projectId: 'p1', title: 'Thread 1', status: 'idle' as const,
      workDir: '/tmp', createdAt: Date.now(), updatedAt: Date.now(),
      metadata: { tokenUsage: { input: 0, output: 0 }, turnCount: 0 },
    };
    db.insertThread(thread);
    db.updateThreadStatus('t1', 'running');
    expect(db.getThread('t1')?.status).toBe('running');
  });

  it('lists threads by project', () => {
    const project = { id: 'p1', name: 'Test', path: '/tmp', createdAt: Date.now() };
    db.insertProject(project);
    db.insertThread({
      id: 't1', projectId: 'p1', title: 'A', status: 'idle',
      workDir: '/tmp', createdAt: 1, updatedAt: 1,
      metadata: { tokenUsage: { input: 0, output: 0 }, turnCount: 0 },
    });
    db.insertThread({
      id: 't2', projectId: 'p1', title: 'B', status: 'idle',
      workDir: '/tmp', createdAt: 2, updatedAt: 2,
      metadata: { tokenUsage: { input: 0, output: 0 }, turnCount: 0 },
    });
    const threads = db.getThreadsByProject('p1');
    expect(threads).toHaveLength(2);
  });
});
```

**Step 3: Implement Database class**

`src/main/db/database.ts`:
```typescript
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Thread, ThreadStatus } from '../../shared/types/thread';
import type { Project } from '../../shared/types/project';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new BetterSqlite3(path.join(dataDir, 'moonlight.db'));
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
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
    const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    return rows.map(r => r.name);
  }

  insertProject(project: Omit<Project, 'threads'>): void {
    this.db.prepare('INSERT INTO projects (id, name, path, createdAt) VALUES (?, ?, ?, ?)')
      .run(project.id, project.name, project.path, project.createdAt);
  }

  getProject(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    const threads = (this.db.prepare('SELECT id FROM threads WHERE projectId = ?').all(id) as { id: string }[]).map(t => t.id);
    return { ...row, threads };
  }

  insertThread(thread: Thread): void {
    this.db.prepare(
      'INSERT INTO threads (id, projectId, title, status, workDir, createdAt, updatedAt, kimiSessionId, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      thread.id, thread.projectId, thread.title, thread.status,
      thread.workDir, thread.createdAt, thread.updatedAt,
      thread.kimiSessionId ?? null, JSON.stringify(thread.metadata),
    );
  }

  getThread(id: string): Thread | undefined {
    const row = this.db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return { ...row, metadata: JSON.parse(row.metadata) };
  }

  getThreadsByProject(projectId: string): Thread[] {
    const rows = this.db.prepare('SELECT * FROM threads WHERE projectId = ? ORDER BY updatedAt DESC').all(projectId) as any[];
    return rows.map(row => ({ ...row, metadata: JSON.parse(row.metadata) }));
  }

  updateThreadStatus(id: string, status: ThreadStatus): void {
    this.db.prepare('UPDATE threads SET status = ?, updatedAt = ? WHERE id = ?')
      .run(status, Date.now(), id);
  }

  updateThreadMetadata(id: string, metadata: Thread['metadata']): void {
    this.db.prepare('UPDATE threads SET metadata = ?, updatedAt = ? WHERE id = ?')
      .run(JSON.stringify(metadata), Date.now(), id);
  }

  deleteThread(id: string): void {
    this.db.prepare('DELETE FROM threads WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/unit/database.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/db/ tests/unit/database.test.ts package.json package-lock.json
git commit -m "feat: add SQLite database with project and thread persistence"
```

---

### Task 6: ThreadManager

**Files:**
- Create: `src/main/managers/ThreadManager.ts`
- Create: `tests/unit/ThreadManager.test.ts`

**Step 1: Write failing tests**

`tests/unit/ThreadManager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThreadManager } from '../../src/main/managers/ThreadManager';
import { Database } from '../../src/main/db/database';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ThreadManager', () => {
  let manager: ThreadManager;
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moonlight-test-'));
    db = new Database(tmpDir);
    db.insertProject({ id: 'p1', name: 'Test', path: '/tmp/project', createdAt: Date.now() });
    manager = new ThreadManager(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates a thread with idle status', () => {
    const thread = manager.create('p1', '/tmp/project');
    expect(thread.status).toBe('idle');
    expect(thread.projectId).toBe('p1');
  });

  it('lists threads for a project', () => {
    manager.create('p1', '/tmp/project');
    manager.create('p1', '/tmp/project');
    const threads = manager.listByProject('p1');
    expect(threads).toHaveLength(2);
  });

  it('transitions status correctly', () => {
    const thread = manager.create('p1', '/tmp/project');
    manager.setStatus(thread.id, 'running');
    expect(manager.get(thread.id)?.status).toBe('running');
  });

  it('deletes a thread and its history directory', () => {
    const thread = manager.create('p1', '/tmp/project');
    manager.delete(thread.id);
    expect(manager.get(thread.id)).toBeUndefined();
  });

  it('appends to history.jsonl', () => {
    const thread = manager.create('p1', '/tmp/project');
    manager.appendHistory(thread.id, { type: 'TurnBegin', data: {} });
    manager.appendHistory(thread.id, { type: 'ContentPart', data: { type: 'text', text: 'hi' } });
    const history = manager.readHistory(thread.id);
    expect(history).toHaveLength(2);
  });
});
```

**Step 2: Implement ThreadManager**

`src/main/managers/ThreadManager.ts`:
```typescript
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Database } from '../db/database';
import type { Thread, ThreadStatus } from '../../shared/types/thread';
import type { WireEvent } from '../../shared/types/wire';

export class ThreadManager {
  constructor(
    private db: Database,
    private dataDir: string,
  ) {}

  create(projectId: string, workDir: string, title?: string): Thread {
    const now = Date.now();
    const thread: Thread = {
      id: randomUUID(),
      projectId,
      title: title ?? `Thread ${new Date(now).toLocaleTimeString()}`,
      status: 'idle',
      workDir,
      createdAt: now,
      updatedAt: now,
      metadata: { tokenUsage: { input: 0, output: 0 }, turnCount: 0 },
    };
    this.db.insertThread(thread);
    this.ensureHistoryDir(thread.id, projectId);
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

  updateMetadata(id: string, metadata: Thread['metadata']): void {
    this.db.updateThreadMetadata(id, metadata);
  }

  delete(id: string): void {
    const thread = this.db.getThread(id);
    if (!thread) return;
    this.db.deleteThread(id);
    const dir = this.historyDir(id, thread.projectId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }

  appendHistory(threadId: string, event: WireEvent): void {
    const thread = this.db.getThread(threadId);
    if (!thread) return;
    const dir = this.ensureHistoryDir(threadId, thread.projectId);
    const filePath = path.join(dir, 'history.jsonl');
    fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
  }

  readHistory(threadId: string): WireEvent[] {
    const thread = this.db.getThread(threadId);
    if (!thread) return [];
    const filePath = path.join(this.historyDir(threadId, thread.projectId), 'history.jsonl');
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line));
  }

  private historyDir(threadId: string, projectId: string): string {
    return path.join(this.dataDir, 'projects', projectId, 'threads', threadId);
  }

  private ensureHistoryDir(threadId: string, projectId: string): string {
    const dir = this.historyDir(threadId, projectId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
```

**Step 3: Run tests**

```bash
npx vitest run tests/unit/ThreadManager.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/main/managers/ThreadManager.ts tests/unit/ThreadManager.test.ts
git commit -m "feat: add ThreadManager with CRUD, state transitions, and history persistence"
```

---

### Task 7: ProcessManager

**Files:**
- Create: `src/main/managers/ProcessManager.ts`

**Step 1: Implement ProcessManager**

`src/main/managers/ProcessManager.ts`:
```typescript
import { WireClient } from '../wire/WireClient';
import { ThreadManager } from './ThreadManager';
import type { WireOptions, WireEvent } from '../../shared/types/wire';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';

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

    client.on('wireEvent', (event: WireEvent) => {
      this.threadManager.appendHistory(threadId, event);
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_EVENT, { threadId, event });
    });

    client.on('TurnBegin', () => {
      this.threadManager.setStatus(threadId, 'running');
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_STATUS, { threadId, status: 'running' });
    });

    client.on('TurnEnd', (data: any) => {
      this.threadManager.setStatus(threadId, 'idle');
      if (data?.token_usage) {
        const thread = this.threadManager.get(threadId);
        if (thread) {
          this.threadManager.updateMetadata(threadId, {
            ...thread.metadata,
            tokenUsage: data.token_usage,
            turnCount: thread.metadata.turnCount + 1,
          });
        }
      }
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_STATUS, { threadId, status: 'idle' });
    });

    client.on('approval', (req: unknown) => {
      this.threadManager.setStatus(threadId, 'waiting');
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_APPROVAL, { threadId, request: req });
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_STATUS, { threadId, status: 'waiting' });
    });

    client.on('exit', (code: number) => {
      this.clients.delete(threadId);
      this.threadManager.setStatus(threadId, 'idle');
      this.getWindow()?.webContents.send(IPC_CHANNELS.THREAD_STATUS, { threadId, status: 'idle', exited: true, code });
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
    for (const [id] of this.clients) {
      this.stop(id);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/main/managers/ProcessManager.ts
git commit -m "feat: add ProcessManager bridging WireClient events to Electron IPC"
```

---

### Task 8: IPC Registration & Main Process Wiring

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

**Step 1: Implement IPC handlers**

`src/main/ipc.ts`:
```typescript
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/types/ipc';
import { ProcessManager } from './managers/ProcessManager';
import { ThreadManager } from './managers/ThreadManager';
import { Database } from './db/database';
import type { Project } from '../shared/types/project';
import { randomUUID } from 'crypto';

export function registerIpcHandlers(deps: {
  db: Database;
  threadManager: ThreadManager;
  processManager: ProcessManager;
  getWindow: () => BrowserWindow | null;
}): void {
  const { db, threadManager, processManager } = deps;

  // Select project directory
  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_DIR, async () => {
    const win = deps.getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const dirPath = result.filePaths[0];
    const name = dirPath.split('/').pop() ?? 'Untitled';

    let project = db.getProject(dirPath);
    if (!project) {
      const newProject: Omit<Project, 'threads'> = {
        id: randomUUID(),
        name,
        path: dirPath,
        createdAt: Date.now(),
      };
      db.insertProject(newProject);
      project = { ...newProject, threads: [] };
    }
    return project;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_event, projectId: string) => {
    return db.getProject(projectId);
  });

  // Thread CRUD
  ipcMain.handle(IPC_CHANNELS.THREAD_CREATE, (_event, { projectId, workDir }: { projectId: string; workDir: string }) => {
    return threadManager.create(projectId, workDir);
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_LIST, (_event, projectId: string) => {
    return threadManager.listByProject(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_DELETE, (_event, threadId: string) => {
    processManager.stop(threadId);
    threadManager.delete(threadId);
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_RESTORE, (_event, threadId: string) => {
    return threadManager.readHistory(threadId);
  });

  // Thread interaction
  ipcMain.handle(IPC_CHANNELS.THREAD_PROMPT, async (_event, { threadId, text }: { threadId: string; text: string }) => {
    let client = processManager.get(threadId);
    if (!client) {
      const thread = threadManager.get(threadId);
      if (!thread) throw new Error('Thread not found');
      client = processManager.start(threadId, {
        workDir: thread.workDir,
        sessionId: thread.kimiSessionId,
      });
      await client.initialize();
    }
    return client.prompt(text);
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_APPROVE, (_event, { threadId, decision }: { threadId: string; decision: string }) => {
    const client = processManager.get(threadId);
    if (!client) throw new Error('No active process for thread');
    // Approval response is handled through the WireClient's pending request mechanism
    client.emit('approvalDecision', decision);
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_CANCEL, (_event, threadId: string) => {
    const client = processManager.get(threadId);
    if (client) return client.cancel();
  });

  ipcMain.handle(IPC_CHANNELS.THREAD_STEER, (_event, { threadId, message }: { threadId: string; message: string }) => {
    const client = processManager.get(threadId);
    if (client) return client.steer(message);
  });
}
```

**Step 2: Wire up main process**

Update `src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { Database } from './db/database';
import { ThreadManager } from './managers/ThreadManager';
import { ProcessManager } from './managers/ProcessManager';
import { registerIpcHandlers } from './ipc';

const DATA_DIR = path.join(os.homedir(), '.moonlight');

let mainWindow: BrowserWindow | null = null;
let db: Database;
let threadManager: ThreadManager;
let processManager: ProcessManager;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1d1d1f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  db = new Database(DATA_DIR);
  threadManager = new ThreadManager(db, DATA_DIR);
  processManager = new ProcessManager(threadManager, () => mainWindow);

  registerIpcHandlers({ db, threadManager, processManager, getWindow: () => mainWindow });

  createWindow();
});

app.on('window-all-closed', () => {
  processManager.stopAll();
  db.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

**Step 3: Run dev to verify no crashes**

```bash
npm run dev
```

Expected: App launches without errors.

**Step 4: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts
git commit -m "feat: register IPC handlers and wire up main process lifecycle"
```

---

### Task 9: Zustand Stores

**Files:**
- Create: `src/renderer/stores/useProjectStore.ts`
- Create: `src/renderer/stores/useThreadStore.ts`
- Create: `src/renderer/stores/useMessageStore.ts`
- Create: `src/renderer/stores/useApprovalStore.ts`
- Create: `src/renderer/stores/useLayoutStore.ts`
- Create: `src/renderer/stores/useThemeStore.ts`
- Create: `src/renderer/styles/theme.ts`

**Step 1: Define theme constants**

`src/renderer/styles/theme.ts`:
```typescript
export const KIMI_THEME = {
  brand: '#0071e3',
  brandHover: '#0051a2',
  dark: {
    bg: '#1d1d1f',
    surface: '#2d2d2f',
    border: '#3d3d3f',
    text: '#f5f5f7',
    textSecondary: '#a1a1a6',
  },
  light: {
    bg: '#fbfbfd',
    surface: '#ffffff',
    border: '#e5e5e7',
    text: '#1d1d1f',
    textSecondary: '#6e6e73',
  },
} as const;
```

**Step 2: Implement all stores**

`src/renderer/stores/useThemeStore.ts`:
```typescript
import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: true,
  toggle: () => set((s) => ({ isDark: !s.isDark })),
}));
```

`src/renderer/stores/useLayoutStore.ts`:
```typescript
import { create } from 'zustand';

interface LayoutStore {
  sidebarWidth: number;
  terminalHeight: number;
  terminalVisible: boolean;
  setSidebarWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  toggleTerminal: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: 260,
  terminalHeight: 200,
  terminalVisible: false,
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setTerminalHeight: (h) => set({ terminalHeight: h }),
  toggleTerminal: () => set((s) => ({ terminalVisible: !s.terminalVisible })),
}));
```

`src/renderer/stores/useProjectStore.ts`:
```typescript
import { create } from 'zustand';
import type { Project } from '../../shared/types/project';

interface ProjectStore {
  project: Project | null;
  setProject: (p: Project) => void;
  selectDirectory: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  setProject: (p) => set({ project: p }),
  selectDirectory: async () => {
    const project = await window.electronAPI.invoke('project:select-dir', undefined);
    if (project) set({ project });
  },
}));
```

`src/renderer/stores/useThreadStore.ts`:
```typescript
import { create } from 'zustand';
import type { Thread } from '../../shared/types/thread';

interface ThreadStore {
  threads: Thread[];
  activeThreadId: string | null;
  openTabs: string[];
  setThreads: (threads: Thread[]) => void;
  addThread: (thread: Thread) => void;
  removeThread: (id: string) => void;
  updateThread: (id: string, partial: Partial<Thread>) => void;
  setActiveThread: (id: string) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
}

export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  activeThreadId: null,
  openTabs: [],
  setThreads: (threads) => set({ threads }),
  addThread: (thread) => set((s) => ({
    threads: [thread, ...s.threads],
    openTabs: [...s.openTabs, thread.id],
    activeThreadId: thread.id,
  })),
  removeThread: (id) => set((s) => ({
    threads: s.threads.filter(t => t.id !== id),
    openTabs: s.openTabs.filter(t => t !== id),
    activeThreadId: s.activeThreadId === id ? (s.openTabs.filter(t => t !== id)[0] ?? null) : s.activeThreadId,
  })),
  updateThread: (id, partial) => set((s) => ({
    threads: s.threads.map(t => t.id === id ? { ...t, ...partial } : t),
  })),
  setActiveThread: (id) => {
    const s = get();
    if (!s.openTabs.includes(id)) {
      set({ openTabs: [...s.openTabs, id], activeThreadId: id });
    } else {
      set({ activeThreadId: id });
    }
  },
  openTab: (id) => set((s) => ({
    openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
    activeThreadId: id,
  })),
  closeTab: (id) => set((s) => {
    const newTabs = s.openTabs.filter(t => t !== id);
    return {
      openTabs: newTabs,
      activeThreadId: s.activeThreadId === id ? (newTabs[newTabs.length - 1] ?? null) : s.activeThreadId,
    };
  }),
}));
```

`src/renderer/stores/useMessageStore.ts`:
```typescript
import { create } from 'zustand';
import type { WireEvent, ContentPart, DisplayBlock } from '../../shared/types/wire';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: ContentPart[];
  toolCalls?: Array<{ name: string; args: string; result?: string }>;
  displayBlocks?: DisplayBlock[];
  timestamp: number;
}

interface MessageStore {
  messagesByThread: Record<string, Message[]>;
  streamingMessage: Message | null;

  addUserMessage: (threadId: string, text: string) => void;
  handleWireEvent: (threadId: string, event: WireEvent) => void;
  loadHistory: (threadId: string, events: WireEvent[]) => void;
  clear: (threadId: string) => void;
}

let msgCounter = 0;

export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesByThread: {},
  streamingMessage: null,

  addUserMessage: (threadId, text) => set((s) => {
    const messages = s.messagesByThread[threadId] ?? [];
    const msg: Message = {
      id: `msg-${++msgCounter}`,
      role: 'user',
      parts: [{ type: 'text', text }],
      timestamp: Date.now(),
    };
    return { messagesByThread: { ...s.messagesByThread, [threadId]: [...messages, msg] } };
  }),

  handleWireEvent: (threadId, event) => set((s) => {
    const messages = [...(s.messagesByThread[threadId] ?? [])];
    let streaming = s.streamingMessage;

    switch (event.type) {
      case 'TurnBegin':
        streaming = {
          id: `msg-${++msgCounter}`,
          role: 'assistant',
          parts: [],
          toolCalls: [],
          displayBlocks: [],
          timestamp: Date.now(),
        };
        break;

      case 'ContentPart': {
        if (!streaming) break;
        const part = event.data as ContentPart;
        streaming = { ...streaming, parts: [...streaming.parts, part] };
        break;
      }

      case 'ToolCall': {
        if (!streaming) break;
        const tc = event.data as any;
        streaming = {
          ...streaming,
          toolCalls: [...(streaming.toolCalls ?? []), { name: tc.name, args: JSON.stringify(tc.arguments) }],
        };
        break;
      }

      case 'ToolResult': {
        if (!streaming) break;
        const tr = event.data as any;
        if (tr.display_blocks) {
          streaming = {
            ...streaming,
            displayBlocks: [...(streaming.displayBlocks ?? []), ...tr.display_blocks],
          };
        }
        break;
      }

      case 'TurnEnd':
        if (streaming) {
          messages.push(streaming);
          streaming = null;
        }
        break;
    }

    return {
      messagesByThread: { ...s.messagesByThread, [threadId]: messages },
      streamingMessage: streaming,
    };
  }),

  loadHistory: (threadId, events) => {
    for (const event of events) {
      get().handleWireEvent(threadId, event);
    }
  },

  clear: (threadId) => set((s) => {
    const { [threadId]: _, ...rest } = s.messagesByThread;
    return { messagesByThread: rest };
  }),
}));
```

`src/renderer/stores/useApprovalStore.ts`:
```typescript
import { create } from 'zustand';
import type { ApprovalRequest } from '../../shared/types/wire';

interface PendingApproval {
  threadId: string;
  request: ApprovalRequest;
}

interface ApprovalStore {
  pending: PendingApproval[];
  add: (threadId: string, request: ApprovalRequest) => void;
  remove: (requestId: string) => void;
}

export const useApprovalStore = create<ApprovalStore>((set) => ({
  pending: [],
  add: (threadId, request) => set((s) => ({
    pending: [...s.pending, { threadId, request }],
  })),
  remove: (requestId) => set((s) => ({
    pending: s.pending.filter(p => p.request.id !== requestId),
  })),
}));
```

**Step 3: Commit**

```bash
git add src/renderer/stores/ src/renderer/styles/theme.ts
git commit -m "feat: add Zustand stores for project, thread, message, approval, layout, and theme"
```

---

### Task 10: Layout Components — TitleBar, Sidebar, MainLayout

**Files:**
- Create: `src/renderer/components/layout/TitleBar.tsx`
- Create: `src/renderer/components/layout/Sidebar.tsx`
- Create: `src/renderer/components/layout/MainLayout.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1: Implement TitleBar**

`src/renderer/components/layout/TitleBar.tsx`:
```tsx
import { useThemeStore } from '../../stores/useThemeStore';
import { Sun, Moon } from 'lucide-react';

export function TitleBar() {
  const { isDark, toggle } = useThemeStore();

  return (
    <div
      className="h-11 flex items-center justify-between px-4 border-b border-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic lights spacer */}
      <div className="w-20" />
      <span className="text-sm font-medium opacity-60">Moonlight</span>
      <button
        onClick={toggle}
        className="p-1 rounded hover:bg-white/10"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
```

**Step 2: Implement Sidebar**

`src/renderer/components/layout/Sidebar.tsx`:
```tsx
import { useProjectStore } from '../../stores/useProjectStore';
import { useThreadStore } from '../../stores/useThreadStore';
import { FolderOpen, Plus, MessageSquare } from 'lucide-react';

export function Sidebar() {
  const { project, selectDirectory } = useProjectStore();
  const { threads, activeThreadId, setActiveThread } = useThreadStore();

  const handleNewThread = async () => {
    if (!project) return;
    const thread = await window.electronAPI.invoke('thread:create', {
      projectId: project.id,
      workDir: project.path,
    });
    if (thread) {
      useThreadStore.getState().addThread(thread);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-dark/50 border-r border-border">
      {/* Project section */}
      <div className="p-3 border-b border-border">
        <button
          onClick={selectDirectory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm"
        >
          <FolderOpen size={16} className="text-brand" />
          <span className="truncate">{project?.name ?? 'Select project...'}</span>
        </button>
      </div>

      {/* Threads section */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs uppercase tracking-wider opacity-50">Threads</span>
          <button
            onClick={handleNewThread}
            disabled={!project}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="space-y-0.5 px-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors ${
                activeThreadId === thread.id
                  ? 'bg-brand/20 text-brand'
                  : 'hover:bg-white/5'
              }`}
            >
              <MessageSquare size={14} />
              <span className="truncate">{thread.title}</span>
              {thread.status === 'running' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              {thread.status === 'waiting' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-yellow-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Implement MainLayout**

`src/renderer/components/layout/MainLayout.tsx`:
```tsx
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { sidebarWidth } = useLayoutStore();

  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: sidebarWidth }} className="flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx**

`src/renderer/App.tsx`:
```tsx
import { MainLayout } from './components/layout/MainLayout';
import { useThemeStore } from './stores/useThemeStore';

export default function App() {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="h-screen bg-surface-dark text-text-inverse dark:bg-surface-dark dark:text-text-inverse">
        <MainLayout>
          <div className="flex items-center justify-center h-full opacity-30">
            <p>Select a project and create a thread to get started.</p>
          </div>
        </MainLayout>
      </div>
    </div>
  );
}
```

**Step 5: Run dev and verify layout**

```bash
npm run dev
```

Expected: Window shows title bar, sidebar with project selector and thread list, main content area.

**Step 6: Commit**

```bash
git add src/renderer/components/layout/ src/renderer/App.tsx
git commit -m "feat: add TitleBar, Sidebar, and MainLayout components with Kimi theme"
```

---

### Task 11: Thread View — TabBar, InputBar, MessageList

**Files:**
- Create: `src/renderer/components/thread/TabBar.tsx`
- Create: `src/renderer/components/thread/InputBar.tsx`
- Create: `src/renderer/components/thread/MessageList.tsx`
- Create: `src/renderer/components/thread/ThreadView.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1: Implement TabBar**

`src/renderer/components/thread/TabBar.tsx`:
```tsx
import { X } from 'lucide-react';
import { useThreadStore } from '../../stores/useThreadStore';

export function TabBar() {
  const { threads, openTabs, activeThreadId, setActiveThread, closeTab } = useThreadStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border overflow-x-auto">
      {openTabs.map((tabId) => {
        const thread = threads.find(t => t.id === tabId);
        if (!thread) return null;
        const isActive = activeThreadId === tabId;
        return (
          <div
            key={tabId}
            className={`flex items-center gap-1 px-3 py-2 text-sm cursor-pointer border-r border-border ${
              isActive ? 'bg-white/5 border-b-2 border-b-brand' : 'opacity-60 hover:opacity-100'
            }`}
            onClick={() => setActiveThread(tabId)}
          >
            <span className="truncate max-w-[120px]">{thread.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tabId); }}
              className="p-0.5 rounded hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Implement InputBar**

`src/renderer/components/thread/InputBar.tsx`:
```tsx
import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 bg-white/5 rounded-lg px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Send a message... (Cmd+Enter to send)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder:opacity-30"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="p-1.5 rounded-md bg-brand hover:bg-brand-hover disabled:opacity-30 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Implement MessageList (placeholder, detailed message components in Task 12)**

`src/renderer/components/thread/MessageList.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { Message } from '../../stores/useMessageStore';

interface MessageListProps {
  messages: Message[];
  streamingMessage: Message | null;
}

export function MessageList({ messages, streamingMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const allMessages = streamingMessage ? [...messages, streamingMessage] : messages;

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30">
        <p>Start a conversation with Kimi.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {allMessages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand text-white'
                : 'bg-white/5'
            }`}
          >
            {msg.parts.map((part, i) => {
              if (part.type === 'text') return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
              if (part.type === 'think') {
                return (
                  <details key={i} className="opacity-60">
                    <summary className="cursor-pointer text-xs">Thinking...</summary>
                    <p className="whitespace-pre-wrap mt-1">{part.text}</p>
                  </details>
                );
              }
              return null;
            })}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 4: Implement ThreadView**

`src/renderer/components/thread/ThreadView.tsx`:
```tsx
import { TabBar } from './TabBar';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { useThreadStore } from '../../stores/useThreadStore';
import { useMessageStore } from '../../stores/useMessageStore';

export function ThreadView() {
  const { activeThreadId, threads } = useThreadStore();
  const { messagesByThread, streamingMessage } = useMessageStore();

  const activeThread = threads.find(t => t.id === activeThreadId);
  const messages = activeThreadId ? (messagesByThread[activeThreadId] ?? []) : [];

  const handleSend = async (text: string) => {
    if (!activeThreadId) return;
    useMessageStore.getState().addUserMessage(activeThreadId, text);
    await window.electronAPI.invoke('thread:prompt', { threadId: activeThreadId, text });
  };

  return (
    <div className="h-full flex flex-col">
      <TabBar />
      {activeThread ? (
        <>
          <MessageList messages={messages} streamingMessage={streamingMessage} />
          <InputBar
            onSend={handleSend}
            disabled={activeThread.status === 'running'}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-30">
          <p>Select or create a thread.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Update App.tsx to use ThreadView**

Replace the placeholder in `App.tsx`'s MainLayout children with `<ThreadView />`.

```tsx
import { MainLayout } from './components/layout/MainLayout';
import { ThreadView } from './components/thread/ThreadView';
import { useThemeStore } from './stores/useThemeStore';

export default function App() {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="h-screen bg-surface-dark text-text-inverse">
        <MainLayout>
          <ThreadView />
        </MainLayout>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/renderer/components/thread/ src/renderer/App.tsx
git commit -m "feat: add ThreadView with TabBar, MessageList, and InputBar"
```

---

### Task 12: Wire Event Hook

**Files:**
- Create: `src/renderer/hooks/useWireEvents.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Implement useWireEvents hook**

`src/renderer/hooks/useWireEvents.ts`:
```typescript
import { useEffect } from 'react';
import { useThreadStore } from '../stores/useThreadStore';
import { useMessageStore } from '../stores/useMessageStore';
import { useApprovalStore } from '../stores/useApprovalStore';

export function useWireEvents() {
  useEffect(() => {
    const unsubEvent = window.electronAPI.on('thread:event', (payload: any) => {
      const { threadId, event } = payload;
      useMessageStore.getState().handleWireEvent(threadId, event);
    });

    const unsubStatus = window.electronAPI.on('thread:status', (payload: any) => {
      const { threadId, status } = payload;
      useThreadStore.getState().updateThread(threadId, { status });
    });

    const unsubApproval = window.electronAPI.on('thread:approval', (payload: any) => {
      const { threadId, request } = payload;
      useApprovalStore.getState().add(threadId, request);
    });

    return () => {
      unsubEvent();
      unsubStatus();
      unsubApproval();
    };
  }, []);
}
```

**Step 2: Use hook in App.tsx**

Add `useWireEvents()` call inside `App` component.

```tsx
import { useWireEvents } from './hooks/useWireEvents';

export default function App() {
  const isDark = useThemeStore((s) => s.isDark);
  useWireEvents();
  // ...rest unchanged
}
```

**Step 3: Commit**

```bash
git add src/renderer/hooks/useWireEvents.ts src/renderer/App.tsx
git commit -m "feat: add useWireEvents hook to bridge Main process events to Zustand stores"
```

---

### Task 13: Terminal Integration

**Files:**
- Create: `src/main/managers/TerminalManager.ts`
- Create: `src/renderer/components/terminal/XTerminal.tsx`
- Create: `src/renderer/hooks/useTerminal.ts`
- Modify: `src/main/ipc.ts` (add terminal IPC handlers)
- Modify: `src/renderer/App.tsx` (add terminal panel)

**Step 1: Install terminal dependencies**

```bash
npm install node-pty @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-search
```

**Step 2: Implement TerminalManager**

`src/main/managers/TerminalManager.ts`:
```typescript
import * as pty from 'node-pty';
import os from 'os';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';

interface PtyEntry {
  pty: pty.IPty;
  threadId: string;
}

export class TerminalManager {
  private ptys = new Map<string, PtyEntry>();

  constructor(private getWindow: () => BrowserWindow | null) {}

  create(threadId: string, workDir: string, shell?: string): string {
    this.destroy(threadId);

    const defaultShell = shell ?? (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL ?? '/bin/zsh');
    const term = pty.spawn(defaultShell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workDir,
      env: process.env as Record<string, string>,
    });

    this.ptys.set(threadId, { pty: term, threadId });

    term.onData((data) => {
      this.getWindow()?.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { termId: threadId, data });
    });

    term.onExit(({ exitCode }) => {
      this.ptys.delete(threadId);
      this.getWindow()?.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { termId: threadId, code: exitCode });
    });

    return threadId;
  }

  write(termId: string, data: string): void {
    this.ptys.get(termId)?.pty.write(data);
  }

  resize(termId: string, cols: number, rows: number): void {
    this.ptys.get(termId)?.pty.resize(cols, rows);
  }

  destroy(termId: string): void {
    const entry = this.ptys.get(termId);
    if (entry) {
      entry.pty.kill();
      this.ptys.delete(termId);
    }
  }

  destroyAll(): void {
    for (const [id] of this.ptys) {
      this.destroy(id);
    }
  }
}
```

**Step 3: Add terminal IPC handlers to `src/main/ipc.ts`**

Add to the `registerIpcHandlers` function:

```typescript
// In registerIpcHandlers, add TerminalManager to deps and register:
ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, (_event, { threadId, workDir }: { threadId: string; workDir: string }) => {
  return deps.terminalManager.create(threadId, workDir);
});

ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_event, { termId, data }: { termId: string; data: string }) => {
  deps.terminalManager.write(termId, data);
});

ipcMain.on(IPC_CHANNELS.TERMINAL_RESIZE, (_event, { termId, cols, rows }: { termId: string; cols: number; rows: number }) => {
  deps.terminalManager.resize(termId, cols, rows);
});

ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, (_event, termId: string) => {
  deps.terminalManager.destroy(termId);
});
```

**Step 4: Implement XTerminal React component**

`src/renderer/components/terminal/XTerminal.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface XTerminalProps {
  threadId: string;
  workDir: string;
}

export function XTerminal({ threadId, workDir }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1d1d1f',
        foreground: '#f5f5f7',
        cursor: '#0071e3',
        selectionBackground: '#0071e344',
      },
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Create PTY in main process
    window.electronAPI.invoke('terminal:create', { threadId, workDir });

    // PTY output → xterm
    const unsubData = window.electronAPI.on('terminal:data', (payload: any) => {
      if (payload.termId === threadId) {
        term.write(payload.data);
      }
    });

    // xterm input → PTY
    term.onData((data) => {
      window.electronAPI.send('terminal:input', { termId: threadId, data });
    });

    // Resize
    term.onResize(({ cols, rows }) => {
      window.electronAPI.send('terminal:resize', { termId: threadId, cols, rows });
    });

    const resizeObserver = new ResizeObserver(() => fit.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      unsubData();
      term.dispose();
      window.electronAPI.invoke('terminal:destroy', threadId);
    };
  }, [threadId, workDir]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

**Step 5: Add terminal panel to App layout**

Update `src/renderer/components/thread/ThreadView.tsx` to include the terminal:

```tsx
import { useLayoutStore } from '../../stores/useLayoutStore';
import { XTerminal } from '../terminal/XTerminal';

// Inside ThreadView, after InputBar, add:
{activeThread && layoutStore.terminalVisible && (
  <div style={{ height: layoutStore.terminalHeight }} className="border-t border-border">
    <XTerminal threadId={activeThread.id} workDir={activeThread.workDir} />
  </div>
)}
```

**Step 6: Commit**

```bash
git add src/main/managers/TerminalManager.ts src/renderer/components/terminal/ src/renderer/hooks/useTerminal.ts src/main/ipc.ts
git commit -m "feat: add terminal integration with node-pty and xterm.js"
```

---

### Task 14: Keyboard Shortcuts

**Files:**
- Create: `src/renderer/hooks/useShortcuts.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Implement useShortcuts**

`src/renderer/hooks/useShortcuts.ts`:
```typescript
import { useEffect } from 'react';
import { useLayoutStore } from '../stores/useLayoutStore';
import { useThreadStore } from '../stores/useThreadStore';
import { useProjectStore } from '../stores/useProjectStore';

export function useShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          useLayoutStore.getState().toggleTerminal();
          break;

        case 'n': {
          e.preventDefault();
          const project = useProjectStore.getState().project;
          if (!project) break;
          window.electronAPI.invoke('thread:create', {
            projectId: project.id,
            workDir: project.path,
          }).then((thread: any) => {
            if (thread) useThreadStore.getState().addThread(thread);
          });
          break;
        }

        case 'w':
          e.preventDefault();
          const activeId = useThreadStore.getState().activeThreadId;
          if (activeId) useThreadStore.getState().closeTab(activeId);
          break;

        default:
          // Cmd+1-9: switch tabs
          if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const idx = parseInt(e.key) - 1;
            const tabs = useThreadStore.getState().openTabs;
            if (idx < tabs.length) {
              useThreadStore.getState().setActiveThread(tabs[idx]);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

**Step 2: Use in App.tsx**

```tsx
import { useShortcuts } from './hooks/useShortcuts';

// Inside App component:
useShortcuts();
```

**Step 3: Commit**

```bash
git add src/renderer/hooks/useShortcuts.ts src/renderer/App.tsx
git commit -m "feat: add keyboard shortcuts (Cmd+J/N/W/1-9)"
```

---

### Task 15: Preload Type Declaration

**Files:**
- Create: `src/renderer/types/electron.d.ts`

**Step 1: Add type declaration for window.electronAPI**

`src/renderer/types/electron.d.ts`:
```typescript
interface ElectronAPI {
  send: (channel: string, data: unknown) => void;
  invoke: (channel: string, data: unknown) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

**Step 2: Commit**

```bash
git add src/renderer/types/electron.d.ts
git commit -m "feat: add TypeScript declarations for Electron preload API"
```

---

### Task 16: End-to-End Smoke Test

**Files:**
- Create: `tests/e2e/basic.test.ts`

**Step 1: Write a basic smoke test**

`tests/e2e/basic.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Build', () => {
  it('compiles TypeScript without errors', () => {
    const root = path.resolve(__dirname, '../..');
    expect(() => {
      execSync('npx tsc --noEmit', { cwd: root, stdio: 'pipe' });
    }).not.toThrow();
  });
});
```

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All unit and smoke tests pass.

**Step 3: Commit**

```bash
git add tests/e2e/basic.test.ts
git commit -m "feat: add build smoke test"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project scaffolding | Electron + React + Vite + Tailwind |
| 2 | Shared types | Wire protocol, Thread, Project, IPC types |
| 3 | JSONL parser | Stream parser with tests |
| 4 | WireClient | JSON-RPC client for kimi --wire with tests |
| 5 | SQLite database | Schema, migrations, CRUD with tests |
| 6 | ThreadManager | Thread lifecycle, history persistence with tests |
| 7 | ProcessManager | Child process management, event bridging |
| 8 | IPC registration | Main process wiring |
| 9 | Zustand stores | Project, Thread, Message, Approval, Layout, Theme |
| 10 | Layout components | TitleBar, Sidebar, MainLayout |
| 11 | Thread view | TabBar, InputBar, MessageList, ThreadView |
| 12 | Wire event hook | useWireEvents — bridges IPC to stores |
| 13 | Terminal integration | TerminalManager + XTerminal component |
| 14 | Keyboard shortcuts | Cmd+J/N/W/1-9 |
| 15 | Preload types | TypeScript declarations |
| 16 | Smoke test | Build verification |
