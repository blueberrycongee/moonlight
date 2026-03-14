import { create } from "zustand";
import type { Project } from "../../shared/types/project";

interface ProjectStore {
  project: Project | null;
  setProject: (project: Project) => void;
  selectDirectory: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
  selectDirectory: async () => {
    const result = await window.electronAPI.invoke(
      "project:select-dir",
      undefined,
    );
    if (result) {
      set({ project: result as Project });
    }
  },
}));
