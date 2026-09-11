import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <Sidebar />

      <Header />

      <main className="ml-60 pt-16">
        <div className="mx-auto max-w-[1600px] px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}