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
