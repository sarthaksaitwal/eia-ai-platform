import { Bell, Search, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed left-60 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-7">
      {/* Search */}
      <div className="relative w-80">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          placeholder="Search projects, assessments..."
          className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:bg-white"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        <button className="relative text-slate-500 hover:text-slate-800">
          <Bell size={19} strokeWidth={1.8} />

          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-600" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        <button className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
            VP
          </div>

          <div className="text-left">
            <div className="text-sm font-medium text-slate-800">
              Vedant Patil
            </div>
          </div>

          <ChevronDown size={15} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}