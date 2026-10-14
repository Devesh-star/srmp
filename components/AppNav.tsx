"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Risk Register", href: "/risks" },
  { label: "Risk Matrix", href: "/risks/matrix" },
  { label: "Assessments", href: "/assessments" },
  { label: "Assets", href: "/assets" },
  { label: "Threats", href: "/threats" },
  { label: "Vulnerabilities", href: "/vulnerabilities" },
  { label: "Controls", href: "/controls" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              CR
            </div>
            <Link href="/" className="font-bold text-lg tracking-tight text-white hover:text-indigo-400">
              CyberRisk
            </Link>
          </div>

          <nav className="hidden md:flex space-x-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-800 text-indigo-400 border border-slate-700"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              Demo Workspace
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
