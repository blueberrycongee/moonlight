# Moonlight

GUI wrapper for [Kimi CLI](https://github.com/MoonshotAI/kimi-cli), inspired by [Codex App](https://developers.openai.com/codex/app/).

Moonlight provides a desktop interface for Kimi CLI, enabling multi-thread parallel agent workflows, built-in terminal, diff review, and automation — all with the Kimi brand experience.

## Features

- **Multi-thread conversations** — Run multiple Kimi agent sessions in parallel
- **Streaming output** — Real-time rendering of text, thinking, shell output, diffs, and todos
- **Approval workflow** — Review and approve agent actions before execution
- **Built-in terminal** — Per-thread interactive terminal (xterm.js)
- **Automation engine** — Cron and event-driven background tasks with inbox notifications
- **Git worktree isolation** — Each thread works in an isolated copy of your repo
- **Kimi brand theming** — Dark/light themes following Moonshot AI brand guidelines

## Tech Stack

- **Electron** + **React** + **Vite** + **TypeScript**
- **Zustand** for state management
- **Tailwind CSS** for styling
- **xterm.js** + **node-pty** for terminal
- **better-sqlite3** for local persistence
- Communicates with Kimi CLI via **Wire mode** (JSON-RPC 2.0 over stdio)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Kimi CLI](https://github.com/MoonshotAI/kimi-cli) installed and configured

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## Architecture

```
Electron Renderer (React UI)
    ↕ Electron IPC
Electron Main (Node.js)
    ↕ stdin/stdout (JSON-RPC 2.0)
kimi --wire (child process × N)
```

Each thread spawns a dedicated `kimi --wire` child process. The main process manages lifecycle, persistence, and event bridging. See [design document](docs/plans/2026-03-15-moonlight-desktop-design.md) for details.

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[Apache License 2.0](LICENSE)
