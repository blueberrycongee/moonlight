import { app, BrowserWindow } from "electron";
import path from "node:path";
import os from "node:os";
import { MoonlightDB } from "./db/database";
import { ThreadManager } from "./managers/ThreadManager";
import { ProcessManager } from "./managers/ProcessManager";
import { TerminalManager } from "./managers/TerminalManager";
import { registerIpcHandlers } from "./ipc";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const DATA_DIR = path.join(os.homedir(), ".moonlight");

let mainWindow: BrowserWindow | null = null;
let db: MoonlightDB;
let threadManager: ThreadManager;
let processManager: ProcessManager;
let terminalManager: TerminalManager;

const getWindow = (): BrowserWindow | null => mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1d1d1f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In development, load from Vite dev server; in production, load built HTML.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.on("ready", () => {
  db = new MoonlightDB(DATA_DIR);
  threadManager = new ThreadManager(db, DATA_DIR);
  processManager = new ProcessManager(threadManager, getWindow);
  terminalManager = new TerminalManager(getWindow);

  registerIpcHandlers({
    db,
    threadManager,
    processManager,
    terminalManager,
    getWindow,
  });

  createWindow();
});

app.on("window-all-closed", () => {
  terminalManager.destroyAll();
  processManager.stopAll();
  db.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
