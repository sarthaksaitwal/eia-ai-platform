import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import AppLayout from "./components/layout/AppLayout";
import { AuthProvider, useAuth } from "./lib/auth";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import CreateProject from "./pages/CreateProject";
import Location from "./pages/Location";
import SignIn from "./pages/SignIn";

// Every API route except /health and the two auth routes needs a bearer
// token, so an unauthenticated visitor is sent to sign in rather than being
// shown a shell that cannot load anything.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6]">
        <Loader2 size={20} className="animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/signin"
        element={
          loading ? null : user ? <Navigate to="/dashboard" replace /> : <SignIn />
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<CreateProject />} />
        <Route path="/projects/:id/location" element={<Location />} />
      </Route>

      {/* The sidebar links to pages that do not exist yet; without this a
          typo or an early click lands on a blank screen. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
