# Moonlight Desktop — Design Document

> GUI wrapper for Kimi CLI, inspired by CodexApp.

## Project Overview

| Item | Detail |
|------|--------|
| Name | moonlight |
| Type | Desktop application (Electron + React) |
| License | Open source |
| Target users | Kimi CLI users + broader developer audience |
| Platforms | macOS (x64, arm64), Windows (x64), Linux (x64, arm64) |

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tech stack | Electron + React | Mature ecosystem, cross-platform |
| CLI communication | Wire mode (JSON-RPC 2.0 over stdio) | Designed for custom UIs, full event system |
| Model config | Delegated to Kimi CLI config files | GUI does not manage API keys or model selection |
| Terminal | xterm.js + node-pty, per-thread | Matches CodexApp behavior |
| Git worktree | Progressive — manual workdir in MVP, auto worktree in Phase 4 | Kimi CLI has no built-in worktree management |
| Automation | Full implementation with cron/event triggers + Inbox | Feature parity with CodexApp |
| UI style | Moonshot/Kimi brand, dark-first with light toggle | Brand blue `#0071e3`, dark bg `#1d1d1f` |
| Swarm support | No architecture change needed — SubagentEvent via Wire | Swarm runs inside a single kimi process |

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Electron Renderer                    │
│                    (React UI)                        │
│  ┌──────────┬──────────┬──────────┬───────────────┐  │
│  │ Sidebar  │ Chat/    │ Review   │  Terminal     │  │
│  │ Projects │ Thread   │ Panel    │  (xterm.js)   │  │
│  │ Threads  │ View     │ (Diff)   │              │  │
│  │ Inbox    │          │          │              │  │
│  └──────────┴──────────┴──────────┴───────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ Electron IPC (contextBridge)
┌───────────────────────┴─────────────────────────────┐
│                 Electron Main                        │
│                  (Node.js)                           │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Process     │  │ Thread       │  │ Automation │  │
│  │ Manager     │  │ Manager      │  │ Engine     │  │
│  │             │  │              │  │            │  │
│  │ spawn/kill  │  │ CRUD/persist │  │ cron/event │  │
│  │ kimi --wire │  │ state machine│  │ triggers   │  │
│  └──────┬──────┘  └──────────────┘  └─────┬──────┘  │
│         │         ┌──────────────┐        │         │
│         │         │ Worktree     │        │         │
│         │         │ Manager      │        │         │
│         │         │ (Phase 4)    │        │         │
│         │         └──────────────┘        │         │
│  ┌──────┴──────┐  ┌──────────────┐  ┌─────┴──────┐  │
│  │ Terminal    │  │ Inbox        │  │ SQLite     │  │
│  │ Manager    │  │ Service      │  │ Store      │  │
│  │ (node-pty) │  │              │  │            │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ stdin/stdout (JSON-RPC 2.0)
              ┌─────────┴─────────┐
              │  kimi --wire      │  × N (one per Thread)
              │  (child process)  │
              └───────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| ProcessManager | Manage kimi --wire child process lifecycle (spawn/kill/restart), maintain stdin/stdout pipes, parse JSON-RPC messages |
| ThreadManager | Thread CRUD, state machine (idle/running/waiting/archived), metadata persistence, session history |
| TerminalManager | node-pty management, one PTY instance per Thread, bound to corresponding workdir |
| AutomationEngine | Cron jobs and event triggers, creates temporary Threads to run kimi |
| InboxService | Aggregate notifications from Threads and Automations, persist to SQLite |
| WorktreeManager | Phase 4 — git worktree create/cleanup/merge |
| SQLite Store | Local persistence: Thread metadata, Automation rules, Inbox messages, user preferences |

---

## 2. Wire Protocol Communication Layer

### Communication Flow

```
React UI                  Electron Main              kimi --wire
  │                           │                          │
  │  ipc: sendPrompt(text)    │                          │
  ├──────────────────────────>│                          │
  │                           │  stdin: prompt request   │
  │                           ├─────────────────────────>│
  │                           │                          │
  │                           │  stdout: TurnBegin       │
  │                           │<─────────────────────────┤
  │  ipc: event(TurnBegin)    │                          │
  │<──────────────────────────┤                          │
  │                           │  stdout: ContentPart     │
  │                           │<─────────────────────────┤
  │  ipc: event(ContentPart)  │  (streaming text/think)  │
  │<──────────────────────────┤                          │
  │                           │  stdout: ApprovalRequest │
  │                           │<─────────────────────────┤
  │  ipc: event(Approval)     │                          │
  │<──────────────────────────┤                          │
  │                           │                          │
  │  ipc: approve(id)         │                          │
  ├──────────────────────────>│                          │
  │                           │  stdin: approve response │
  │                           ├─────────────────────────>│
  │                           │                          │
  │                           │  stdout: ToolCall        │
  │                           │<─────────────────────────┤
  │                           │  stdout: ToolResult      │
  │                           │<─────────────────────────┤
  │                           │  stdout: TurnEnd         │
  │                           │<─────────────────────────┤
  │  ipc: event(TurnEnd)      │                          │
  │<──────────────────────────┤                          │
```

### WireClient Interface

```typescript
interface WireClient {
  // Lifecycle
  start(workDir: string, options?: WireOptions): void;
  stop(): void;
  restart(): void;

  // Client → Agent (JSON-RPC requests)
  initialize(): Promise<InitResult>;
  prompt(text: string): Promise<void>;
  steer(message: string): Promise<void>;
  cancel(): Promise<void>;
  setPlanMode(enabled: boolean): Promise<void>;

  // Agent → Client (events via EventEmitter)
  on(event: 'TurnBegin', handler: (data: TurnBeginEvent) => void): void;
  on(event: 'TurnEnd', handler: (data: TurnEndEvent) => void): void;
  on(event: 'ContentPart', handler: (data: ContentPartEvent) => void): void;
  on(event: 'ToolCall', handler: (data: ToolCallEvent) => void): void;
  on(event: 'ToolResult', handler: (data: ToolResultEvent) => void): void;
  on(event: 'SubagentEvent', handler: (data: SubagentEvent) => void): void;
  on(event: 'StatusUpdate', handler: (data: StatusUpdateEvent) => void): void;

  // Agent → Client (requests requiring GUI response)
  onApprovalRequest(handler: (req: ApprovalRequest) => Promise<ApprovalResponse>): void;
  onQuestionRequest(handler: (req: QuestionRequest) => Promise<QuestionResponse>): void;
}
```

### IPC Channels

```typescript
// Main → Renderer (event push)
'thread:event'          // Wire event forwarding (TurnBegin, ContentPart, ToolCall...)
'thread:approval'       // Approval requests
'thread:status'         // Thread status changes
'inbox:notification'    // New Inbox messages
'automation:update'     // Automation execution status

// Renderer → Main (user actions)
'thread:create'         // Create new Thread
'thread:prompt'         // Send user input
'thread:approve'        // Approval response
'thread:cancel'         // Cancel current Turn
'thread:steer'          // Inject steer message
'project:switch'        // Switch project
'automation:create'     // Create Automation rule
'automation:delete'     // Delete Automation rule
```

### DisplayBlock → React Component Mapping

| Wire DisplayBlock | React Component | Purpose |
|---|---|---|
| BriefDisplayBlock | `<BriefCard>` | Plain text content |
| DiffDisplayBlock | `<DiffViewer>` | File change diff (path, old_text, new_text) |
| TodoDisplayBlock | `<TodoList>` | Task checklist with status |
| ShellDisplayBlock | `<ShellOutput>` | Commands and output with syntax highlighting |
| ContentPart:Think | `<ThinkBlock>` | Collapsible thinking process |

---

## 3. Thread Lifecycle & State Management

### State Machine

```
                    create
                      │
                      ▼
    ┌──────────── [idle] ◄───────────────┐
    │                │                    │
    │          prompt │                   │
    │                ▼                    │
    │           [running] ──── cancel ───>│
    │             │    │                  │
    │    approval │    │ turn end         │
    │             ▼    │                  │
    │        [waiting] │                  │
    │          │    │  │                  │
    │  approve │ reject│                  │
    │          ▼    │  │                  │
    │      [running]│  │                  │
    │               ▼  ▼                  │
    │            [idle] ──────────────────┘
    │                │
    │          archive│
    │                ▼
    │          [archived]
    │                │
    │         unarchive
    │                │
    └────────────────┘
```

### Data Models

```typescript
interface Thread {
  id: string;
  projectId: string;
  title: string;
  status: 'idle' | 'running' | 'waiting' | 'archived';
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

interface Project {
  id: string;
  name: string;
  path: string;
  threads: string[];
  createdAt: number;
}
```

### Persistence Layout

```
~/.moonlight/
├── config.json
├── moonlight.db                   # SQLite
│   ├─ table: projects
│   ├─ table: threads
│   ├─ table: automations
│   └─ table: inbox_messages
└── projects/
    └── {project_id}/
        └── threads/
            └── {thread_id}/
                ├── history.jsonl  # Wire event stream persistence
                └── state.json    # Thread snapshot for restoration
```

### Thread Restoration

```
App startup
  → Read SQLite for all Project/Thread metadata
  → Render sidebar list (no kimi processes spawned)
  → User clicks a Thread
    → Restore UI display from history.jsonl
    → spawn kimi --wire --work-dir <path> --session <id>
    → Call Wire initialize
    → Thread enters idle state, awaiting user input
```

---

## 4. UI Layout & Component Architecture

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Traffic Lights (macOS) │    Title Bar / Drag Region        │
├────────────┬─────────────────────────────────┬───────────────┤
│            │          Tab Bar                │               │
│            │  [Thread 1] [Thread 2] [+]      │   Actions     │
│  Sidebar   ├─────────────────────────────────┤   (plan mode, │
│            │                                 │    settings)  │
│  ┌──────┐  │         Main Content            │               │
│  │Projects│ ├─────────────────────────────────┤               │
│  │  Proj A│ │                                 │  Review Panel │
│  │  Proj B│ │  ContentPart (text)             │  (toggleable) │
│  ├──────┤  │  ThinkBlock (collapsible)        │               │
│  │Threads│ │  ShellOutput                     │  Diff review  │
│  │  T-1  │ │  DiffViewer                      │  File changes │
│  │  T-2  │ │  TodoList                        │  Inline       │
│  │  T-3  │ │  ApprovalCard                    │  comments     │
│  ├──────┤  │  SubagentSwarm (parallel)        │               │
│  │Inbox  │ │                                  │               │
│  │ 3 new │ ├─────────────────────────────────┴───────────────┤
│  ├──────┤  │         Terminal (xterm.js)      [Cmd+J toggle] │
│  │Auto-  │ │  $ npm test                                     │
│  │mation │ │  PASS src/utils.test.ts                         │
│  │  Rule1│ │  $                                               │
│  │  Rule2│ │                                                  │
│  └──────┘  └─────────────────────────────────────────────────┘
└────────────┴─────────────────────────────────────────────────┘
```

### React Component Tree

```
<App>
├── <TitleBar />
├── <MainLayout>
│   ├── <Sidebar>
│   │   ├── <ProjectList />
│   │   ├── <ThreadList />
│   │   ├── <InboxPanel />
│   │   └── <AutomationList />
│   ├── <ContentArea>
│   │   ├── <TabBar />
│   │   ├── <ThreadView>
│   │   │   ├── <MessageList>              # virtual scroll
│   │   │   │   ├── <UserMessage />
│   │   │   │   ├── <AssistantMessage>
│   │   │   │   │   ├── <TextContent />
│   │   │   │   │   ├── <ThinkBlock />
│   │   │   │   │   ├── <ShellOutput />
│   │   │   │   │   ├── <DiffViewer />
│   │   │   │   │   ├── <TodoList />
│   │   │   │   │   └── <SubagentSwarm />
│   │   │   │   └── <ApprovalCard />
│   │   │   └── <InputBar>
│   │   │       ├── <TextArea />
│   │   │       ├── <AttachButton />
│   │   │       └── <SendButton />
│   │   └── <ReviewPanel />
│   │       ├── <FileChangeList />
│   │       ├── <InlineDiff />
│   │       └── <CommitActions />
│   └── <TerminalPanel>
│       └── <XTerminal />
├── <CommandPalette />                     # Cmd+K
├── <SettingsModal />
└── <NotificationToast />
```

### State Management (Zustand)

```typescript
useProjectStore     // Project CRUD, active project
useThreadStore      // Thread state, active Thread, Tab management
useMessageStore     // Current Thread messages, streaming updates
useApprovalStore    // Pending approval queue
useLayoutStore      // Panel expand/collapse, sidebar width, terminal height
useThemeStore       // Light/dark theme toggle
useInboxStore       // Notification messages, unread count
useAutomationStore  // Rule CRUD, execution status
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+J | Toggle terminal panel |
| Cmd+K | Command palette |
| Cmd+N | New Thread |
| Cmd+W | Close current Thread tab |
| Cmd+1-9 | Switch Thread tab |
| Cmd+, | Settings |
| Cmd+Enter | Send message |
| Escape | Cancel current Turn |

---

## 5. Automation Engine & Inbox

### Architecture

```
┌─────────────────────────────────────────┐
│            AutomationEngine             │
│                                         │
│  ┌───────────┐    ┌──────────────────┐  │
│  │ Scheduler │    │ EventBus         │  │
│  │ (cron)    │    │ (event triggers) │  │
│  └─────┬─────┘    └────────┬─────────┘  │
│        │                   │            │
│        └─────────┬─────────┘            │
│                  ▼                      │
│         ┌────────────────┐              │
│         │ RuleExecutor   │              │
│         │                │              │
│         │ 1. Create temp Thread         │
│         │ 2. spawn kimi --wire          │
│         │ 3. Send preset prompt         │
│         │ 4. Collect results            │
│         │ 5. Push to Inbox              │
│         └────────────────┘              │
└─────────────────────────────────────────┘
```

### Data Models

```typescript
interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;

  trigger:
    | { type: 'cron'; expression: string }
    | { type: 'file_change'; patterns: string[] }
    | { type: 'git_event'; event: 'push' | 'pull' | 'merge' }
    | { type: 'manual' };

  action: {
    prompt: string;
    workDir?: string;
    autoApprove: boolean;
    timeout: number;
  };

  notification: {
    onSuccess: 'inbox' | 'silent' | 'archive';
    onFailure: 'inbox' | 'silent';
    onNeedsApproval: 'inbox';
  };

  createdAt: number;
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'failure' | 'timeout';
}

interface InboxMessage {
  id: string;
  threadId?: string;
  automationId?: string;
  type: 'completion' | 'failure' | 'approval_needed' | 'info';
  title: string;
  summary: string;
  read: boolean;
  createdAt: number;
  actions?: InboxAction[];
}

interface InboxAction {
  label: string;
  action: 'open_thread' | 'approve' | 'rerun' | 'dismiss';
  payload?: Record<string, unknown>;
}
```

### Trigger Implementations

| Trigger | Implementation |
|---------|---------------|
| cron | `node-cron` scheduler |
| file_change | `chokidar` filesystem watcher with glob matching |
| git_event | Monitor `.git/` changes + `git log` polling |
| manual | User click in UI |

---

## 6. Terminal Integration

### Architecture

```
Renderer                    Main Process
┌──────────────┐           ┌──────────────────┐
│  <XTerminal> │           │  TerminalManager │
│  xterm.js    │◄── IPC ──►│                  │
│  + fit addon │           │  ┌────────────┐  │
│  + webgl     │           │  │ PTY Pool   │  │
│              │           │  │            │  │
│              │           │  │  T1: pty1  │  │
│              │           │  │  T2: pty2  │  │
│              │           │  │  T3: pty3  │  │
│              │           │  └────────────┘  │
└──────────────┘           └──────────────────┘
```

### Interface

```typescript
interface TerminalManager {
  create(threadId: string, workDir: string, shell?: string): string;
  write(termId: string, data: string): void;
  resize(termId: string, cols: number, rows: number): void;
  destroy(termId: string): void;

  onData(termId: string, handler: (data: string) => void): void;
  onExit(termId: string, handler: (code: number) => void): void;
}
```

### IPC Channels

```typescript
// Renderer → Main
'terminal:create'    // { threadId, workDir }
'terminal:input'     // { termId, data }
'terminal:resize'    // { termId, cols, rows }
'terminal:destroy'   // { termId }

// Main → Renderer
'terminal:data'      // { termId, data }
'terminal:exit'      // { termId, code }
```

### Details

- Shell detection: macOS defaults to zsh, Windows to PowerShell, configurable in settings
- Working directory: PTY cwd matches Thread workDir; binds to worktree path in Phase 4
- xterm.js addons: `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-search`
- Panel behavior: Cmd+J toggle, draggable resize, switches terminal instance with Thread

---

## 7. Tech Stack & Dependencies

### Core Dependencies

| Category | Package | Purpose |
|----------|---------|---------|
| Framework | electron | Desktop shell |
| | electron-forge | Build, package, distribute |
| | react 18 | UI framework |
| | vite | Frontend build |
| State | zustand | State management |
| UI | tailwindcss | Styling |
| | lucide-react | Icons |
| | framer-motion | Animations |
| Terminal | xterm.js | Terminal rendering |
| | node-pty | PTY backend |
| Editor/Diff | react-diff-viewer | Diff display |
| | shiki | Code syntax highlighting |
| Markdown | react-markdown | Markdown rendering |
| | remark-gfm | GFM support |
| | rehype-katex | Math formulas |
| Storage | better-sqlite3 | SQLite wrapper |
| Automation | node-cron | Scheduled tasks |
| | chokidar | File watching |
| Utils | simple-git | Git operations |
| | uuid | ID generation |

### Project Structure

```
moonlight/
├── package.json
├── forge.config.ts
├── vite.main.config.ts
├── vite.renderer.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc.ts
│   │   ├── wire/
│   │   │   ├── WireClient.ts
│   │   │   ├── protocol.ts
│   │   │   └── parser.ts
│   │   ├── managers/
│   │   │   ├── ProcessManager.ts
│   │   │   ├── ThreadManager.ts
│   │   │   ├── TerminalManager.ts
│   │   │   ├── WorktreeManager.ts
│   │   │   └── AutomationEngine.ts
│   │   ├── services/
│   │   │   ├── InboxService.ts
│   │   │   └── ProjectService.ts
│   │   └── db/
│   │       ├── database.ts
│   │       └── migrations/
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── TitleBar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── CommandPalette.tsx
│   │   │   ├── thread/
│   │   │   │   ├── ThreadView.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── InputBar.tsx
│   │   │   │   └── TabBar.tsx
│   │   │   ├── message/
│   │   │   │   ├── UserMessage.tsx
│   │   │   │   ├── AssistantMessage.tsx
│   │   │   │   ├── TextContent.tsx
│   │   │   │   ├── ThinkBlock.tsx
│   │   │   │   ├── ShellOutput.tsx
│   │   │   │   ├── DiffViewer.tsx
│   │   │   │   ├── TodoList.tsx
│   │   │   │   ├── ApprovalCard.tsx
│   │   │   │   └── SubagentSwarm.tsx
│   │   │   ├── sidebar/
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ThreadList.tsx
│   │   │   │   ├── InboxPanel.tsx
│   │   │   │   └── AutomationList.tsx
│   │   │   ├── review/
│   │   │   │   ├── ReviewPanel.tsx
│   │   │   │   ├── FileChangeList.tsx
│   │   │   │   └── InlineDiff.tsx
│   │   │   ├── terminal/
│   │   │   │   └── XTerminal.tsx
│   │   │   └── settings/
│   │   │       └── SettingsModal.tsx
│   │   ├── stores/
│   │   │   ├── useProjectStore.ts
│   │   │   ├── useThreadStore.ts
│   │   │   ├── useMessageStore.ts
│   │   │   ├── useApprovalStore.ts
│   │   │   ├── useLayoutStore.ts
│   │   │   ├── useThemeStore.ts
│   │   │   ├── useInboxStore.ts
│   │   │   └── useAutomationStore.ts
│   │   ├── hooks/
│   │   │   ├── useWireEvents.ts
│   │   │   ├── useTerminal.ts
│   │   │   └── useShortcuts.ts
│   │   └── styles/
│   │       ├── globals.css
│   │       └── theme.ts
│   │
│   ├── shared/
│   │   └── types/
│   │       ├── wire.ts
│   │       ├── thread.ts
│   │       ├── project.ts
│   │       ├── automation.ts
│   │       ├── inbox.ts
│   │       └── ipc.ts
│   │
│   └── preload/
│       └── index.ts
│
├── resources/
│   ├── icon.icns
│   ├── icon.ico
│   └── icon.png
│
└── tests/
    ├── unit/
    │   ├── WireClient.test.ts
    │   ├── ThreadManager.test.ts
    │   └── AutomationEngine.test.ts
    └── e2e/
        └── basic.test.ts
```

### Build Outputs

| Platform | Format | Arch |
|----------|--------|------|
| macOS | .dmg | x64, arm64 |
| Windows | .exe (NSIS) | x64 |
| Linux | .AppImage, .deb | x64, arm64 |

---

## 8. Phased Delivery Plan

### Phase 1 — MVP (Core Usable)

Single project, multi-thread conversations, basic approval, terminal integration.

Includes:
- Electron app skeleton + Kimi brand theme (dark/light)
- WireClient wrapper + JSONL parser
- Single project, manual workdir selection
- Thread CRUD + Tab switching
- Message stream rendering (Text, Think, Shell, Diff, Todo)
- Approval interaction (ApprovalCard)
- Streaming output + virtual scrolling
- Embedded terminal (xterm.js + node-pty)
- SQLite persistence (Thread metadata)
- Conversation history persistence + app restart recovery
- Basic shortcuts (Cmd+J/K/N/W)

Does not include:
- Multi-project management
- Review Panel
- Automation / Inbox
- Git worktree
- SubagentSwarm visualization
- Command palette

### Phase 2 — Multi-Project & Review

Multi-project management, diff review, SubagentSwarm display.

Adds:
- Multi-project support (sidebar project list, project switching)
- Review Panel (file change list, InlineDiff, inline comments)
- Commit actions (stage/revert/commit via simple-git)
- SubagentSwarm parallel task visualization
- Command palette (Cmd+K, quick action search)
- Thread archive/restore

### Phase 3 — Automation & Inbox

Background automated tasks, notification inbox.

Adds:
- AutomationEngine (cron + file_change + git_event triggers)
- Automation rule CRUD UI
- Inbox notification panel (unread count, quick actions)
- Temporary Thread management for Automation runs
- System notifications (macOS Notification Center / Windows Toast)

### Phase 4 — Git Worktree Isolation

Automatic workspace isolation per Thread.

Adds:
- WorktreeManager (auto create/cleanup git worktree)
- Auto-assign worktree on new Thread creation
- Worktree → main branch merge/PR actions
- Worktree status visualization (branch, change count)
- Terminal cwd auto-binds to worktree

### Phase 5 — Polish & Extensions

Adds:
- Update system (electron-updater auto-update)
- Plugin system (custom Automation templates)
- Draggable panel layout
- Internationalization (zh-CN / en)
- Performance optimization (large message counts / Swarm scenarios)
- CI/CD (GitHub Actions multi-platform builds)

---

## Design References

- [Kimi CLI Wire Mode](https://moonshotai.github.io/kimi-cli/en/customization/wire-mode.html)
- [Kimi CLI Print Mode](https://moonshotai.github.io/kimi-cli/en/customization/print-mode.html)
- [Kimi CLI Subagent System](https://deepwiki.com/MoonshotAI/kimi-cli/5.3-multi-agent-coordination)
- [KIMI Brand Guidelines](https://moonshotai.github.io/Branding-Guide/)
- [Codex App](https://developers.openai.com/codex/app/)
- [Codex App Server Architecture](https://developers.openai.com/codex/app-server/)
- [CodexDesktop-Rebuild](https://github.com/Haleclipse/CodexDesktop-Rebuild)
