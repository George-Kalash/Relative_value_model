import { AppShell } from "./components/AppShell";
import { MonitorPage } from "./features/monitor/MonitorPage";

export function App() {
  return (
    <AppShell>
      <MonitorPage />
    </AppShell>
  );
}
