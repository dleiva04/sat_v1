import AppShell from "../../components/AppShell";
import Dashboard from "../../components/Dashboard";

export default function DashboardPage() {
  return (
    <AppShell current="/dashboard" section="SAT" page="Overview">
      <Dashboard />
    </AppShell>
  );
}
