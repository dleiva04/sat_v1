"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "flowbite-react";
import { api } from "../utils/api";
import { FileTextIcon } from "./icons";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
      <FileTextIcon />
      <p className="text-sm">{message}</p>
    </div>
  );
}

const SEVERITY_LEVELS = [
  { label: "Critical", color: "bg-red-600" },
  { label: "High", color: "bg-orange-500" },
  { label: "Medium", color: "bg-yellow-400" },
  { label: "Low", color: "bg-blue-500" },
  { label: "Informative", color: "bg-teal-500" },
];

const TOOLS = [
  { name: "SAT Core", status: "Not run yet" },
  { name: "Permissions Analyzer", status: "Not run yet" },
  { name: "Secret Scanner", status: "Not run yet" },
];

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/state").then((res) => {
      if (res.status !== "ok" || !res.data?.is_configured) {
        router.push("/");
        return;
      }
      setReady(true);
    });
  }, [router]);

  if (!ready) {
    if (error) {
      return (
        <div>
          <p className="text-red-600">{error}</p>
        </div>
      );
    }
    return (
      <div>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">
          Security posture and check results across all tools.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Severity breakdown */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Check Results by Severity
            </h2>
            <Badge color="gray">Last 7 days</Badge>
          </div>
          <div className="flex flex-wrap gap-4">
            {SEVERITY_LEVELS.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-sm text-gray-600">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.color}`} />
                {s.label}
              </span>
            ))}
          </div>
          <EmptyState message="No check results yet. Run a tool to see severity breakdown." />
        </Card>

        {/* Latest results */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900">
            Latest Check Results
          </h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Tool</TableHeadCell>
                <TableHeadCell>Check</TableHeadCell>
                <TableHeadCell>Severity</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState message="No results to display. Checks will appear here after a tool run." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        {/* Checks by tool */}
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Checks by Tool
            </h2>
            <p className="text-xs text-gray-400">
              Installed tools and last run status
            </p>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Tool</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {TOOLS.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="font-medium text-gray-900">
                    {t.name}
                  </TableCell>
                  <TableCell className="text-gray-500">{t.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Failed checks */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Failed Checks Summary
          </h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Check</TableHeadCell>
                <TableHeadCell>Resource</TableHeadCell>
                <TableHeadCell>Severity</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState message="No failed checks. Run security tools to populate this view." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
