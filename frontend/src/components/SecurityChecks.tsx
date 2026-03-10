"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "flowbite-react";
import { api } from "../utils/api";
import { CheckSquareIcon } from "./icons";

export default function SecurityChecks() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
    return (
      <div>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Checks</h1>
        <p className="text-sm text-gray-500">
          Enable or disable individual security checks based on your needs.
        </p>
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <CheckSquareIcon width="40" height="40" stroke="#9ca3af" strokeWidth="1.5" />
          <h2 className="text-lg font-semibold text-gray-700">
            Check Management Coming Soon
          </h2>
          <p className="max-w-sm text-sm text-gray-400">
            You will be able to enable, disable, and configure individual
            security checks from this page.
          </p>
        </div>
      </Card>
    </div>
  );
}
