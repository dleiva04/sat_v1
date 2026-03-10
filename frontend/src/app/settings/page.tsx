import AppShell from "../../components/AppShell";
import Settings from "../../components/Settings";

export default function SettingsPage() {
  return (
    <AppShell current="/settings" section="Manage" page="Settings">
      <Settings />
    </AppShell>
  );
}
