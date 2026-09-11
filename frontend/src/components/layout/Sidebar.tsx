import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  FileText,
  Settings,
  HelpCircle,
  Plus,
} from "lucide-react";

const navigation = [
  {
    section: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard",
      },
    ],
  },
  {
    section: "Projects",
    items: [
      {
        label: "All Projects",
        icon: FolderKanban,
        path: "/projects",
      },
      {
        label: "Create Project",
        icon: Plus,
        path: "/projects/new",
      },
    ],
  },
  {
    section: "Assessment",
    items: [
      {
        label: "Assessments",
        icon: ClipboardCheck,
        path: "/assessments",
      },
    ],
  },
  {
    section: "Reports",
    items: [
      {
        label: "Reports",
        icon: FileText,
        path: "/reports",
      },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <div>
          <div className="text-base font-semibold tracking-tight text-slate-900">
            EIA Platform
          </div>

          <div className="text-[11px] text-slate-500">
            Environmental Assessment
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((group) => (
          <div key={group.section} className="mb-6">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.section}
            </div>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                        isActive
                          ? "bg-emerald-50 font-medium text-emerald-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} />

                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-200 p-3">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
              isActive
                ? "bg-emerald-50 font-medium text-emerald-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`
          }
        >
          <HelpCircle size={17} strokeWidth={1.8} />
          <span>Help & Support</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
              isActive
                ? "bg-emerald-50 font-medium text-emerald-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`
          }
        >
          <Settings size={17} strokeWidth={1.8} />
          <span>Settings</span>
        </NavLink>

        {/* User */}
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 px-3 pt-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
            VP
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">
              Vedant Patil
            </div>

            <div className="truncate text-xs text-slate-500">
              Project Admin
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}