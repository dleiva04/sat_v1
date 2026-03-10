import AppShell from "../../components/AppShell";
import SecurityChecks from "../../components/SecurityChecks";

export default function ChecksPage() {
  return (
    <AppShell current="/checks" section="Manage" page="Security Checks">
      <SecurityChecks />
    </AppShell>
  );
}
