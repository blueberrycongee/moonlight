import { MainLayout } from "./components/layout/MainLayout";
import { useThemeStore } from "./stores/useThemeStore";

function App() {
  const { isDark } = useThemeStore();

  return (
    <div
      className={`h-screen w-screen bg-surface-dark select-none ${isDark ? "dark" : ""}`}
    >
      <MainLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-text-inverse tracking-tight">
              Moonlight
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              A GUI wrapper for Kimi CLI
            </p>
          </div>
        </div>
      </MainLayout>
    </div>
  );
}

export default App;
