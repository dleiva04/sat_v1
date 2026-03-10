"use client";

import Header from "./Header";
import Navigation from "./Navigation";

interface Props {
  current: string;
  section: string;
  page: string;
  children: React.ReactNode;
}

export default function AppShell({ current, section, page, children }: Props) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header section={section} page={page} />

      <div className="flex flex-1 overflow-hidden pt-14">
        <Navigation current={current} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
