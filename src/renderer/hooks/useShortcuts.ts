import { useEffect } from "react";
import { useLayoutStore } from "../stores/useLayoutStore";
import { useThreadStore } from "../stores/useThreadStore";
import { useProjectStore } from "../stores/useProjectStore";

export function useShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          useLayoutStore.getState().toggleTerminal();
          break;

        case "n": {
          e.preventDefault();
          const project = useProjectStore.getState().project;
          if (!project) break;
          window.electronAPI
            .invoke("thread:create", {
              projectId: project.id,
              workDir: project.path,
            })
            .then((thread: any) => {
              if (thread) useThreadStore.getState().addThread(thread);
            });
          break;
        }

        case "w":
          e.preventDefault();
          const activeId = useThreadStore.getState().activeThreadId;
          if (activeId) useThreadStore.getState().closeTab(activeId);
          break;

        default:
          if (e.key >= "1" && e.key <= "9") {
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

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
