"use client";

import { Breadcrumb, BreadcrumbItem } from "flowbite-react";
import { useAppStore } from "../store/app";
import { ShieldIcon, MenuIcon, ChevronLeftIcon, BellIcon, HelpCircleIcon, UserCircleIcon } from "./icons";

interface Props {
  section: string;
  page: string;
}

export default function Header({ section, page }: Props) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <header className="fixed top-0 z-30 flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <MenuIcon width="18" height="18" /> : <ChevronLeftIcon />}
        </button>
        <ShieldIcon width="24" height="24" stroke="#FF3621" />
        <span className="text-lg font-bold text-gray-900">SAT</span>
      </div>

      <Breadcrumb>
        <BreadcrumbItem>{section}</BreadcrumbItem>
        <BreadcrumbItem>{page}</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex items-center gap-1">
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Notifications"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Help"
          aria-label="Help"
        >
          <HelpCircleIcon />
        </button>
        <div className="ml-2 text-gray-400">
          <UserCircleIcon />
        </div>
      </div>
    </header>
  );
}
