import { MainLayout } from "./components/layout/MainLayout";
import { ThreadView } from "./components/thread/ThreadView";
import { useThemeStore } from "./stores/useThemeStore";
import { useWireEvents } from "./hooks/useWireEvents";
import { useShortcuts } from "./hooks/useShortcuts";

function App() {
  const { isDark } = useThemeStore();
  useWireEvents();
  useShortcuts();

  return (
    <div
      className={`h-screen w-screen bg-background select-none ${isDark ? "dark" : ""}`}
    >
      <MainLayout>
        <ThreadView />
      </MainLayout>
    </div>
  );
}

export default App;
