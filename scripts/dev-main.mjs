import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { builtinModules } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const nodeExternals = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  "electron",
  "node-pty",
  "better-sqlite3",
  "electron-squirrel-startup",
];

const outDir = resolve(root, ".vite/build");

// Build main process
await build({
  configFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    ssr: resolve(root, "src/main/index.ts"),
    rollupOptions: {
      external: nodeExternals,
      output: {
        format: "cjs",
        entryFileNames: "index.js",
      },
    },
  },
});

// Build preload
await build({
  configFile: false,
  build: {
    outDir,
    emptyOutDir: false,
    ssr: resolve(root, "src/preload/index.ts"),
    rollupOptions: {
      external: nodeExternals,
      output: {
        format: "cjs",
        entryFileNames: "preload.js",
      },
    },
  },
});

console.log("Build complete: index.js + preload.js");

const electron = resolve(root, "node_modules/.bin/electron");
const child = spawn(electron, ["."], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    MAIN_WINDOW_VITE_DEV_SERVER_URL: "http://localhost:5173",
    MAIN_WINDOW_VITE_NAME: "main_window",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
