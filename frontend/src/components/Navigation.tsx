"use client";

import Link from "next/link";
import { useAppStore } from "../store/app";
import { GridIcon, CheckSquareIcon, GearIcon } from "./icons";

interface Props {
  current: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    section: "MAIN",
    icon: <GridIcon />,
  },
  {
    href: "/checks",
    label: "Security Checks",
    section: "MANAGE",
    icon: <CheckSquareIcon />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <GearIcon />,
  },
];

export default function Navigation({ current }: Props) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  let lastSection: string | undefined;

  return (
    <nav
      className={`flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex flex-col gap-0.5 px-3 py-4">
        {ITEMS.map((item, i) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={`${item.href}-${i}`}>
              {showSection && !collapsed && (
                <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 first:mt-0">
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-0" : "gap-2.5 px-3"
                } ${
                  current === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="shrink-0 text-gray-500">{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
