import { create } from "zustand";

interface LayoutStore {
  sidebarWidth: number;
  terminalHeight: number;
  terminalVisible: boolean;
  setSidebarWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  toggleTerminal: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: 260,
  terminalHeight: 200,
  terminalVisible: false,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
  toggleTerminal: () => set((s) => ({ terminalVisible: !s.terminalVisible })),
}));
