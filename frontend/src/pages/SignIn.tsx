import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Leaf, Loader2 } from "lucide-react";

import { InlineError } from "../components/ui/States";
import { useAuth } from "../lib/auth";
import { ROLES, type Role } from "../lib/types";

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState<Role>("ENVIRONMENTAL_CONSULTANT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Send people back where they were headed before the redirect to sign in.
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          organization: organization.trim() || undefined,
        });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-emerald-700 text-white">
            <Leaf size={18} />
          </div>

          <div>
            <div className="text-base font-semibold tracking-tight text-slate-900">
              EIA Platform
            </div>
            <div className="text-xs text-slate-500">
              AI-assisted environmental impact assessment
            </div>
          </div>
        </div>

        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-lg font-semibold text-slate-900">
              {mode === "signin" ? "Sign in" : "Create an account"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {mode === "signin"
                ? "Sign in to reach your projects and assessments."
                : "Your role sets the defaults used in an assessment."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 p-6">
            {error && <InlineError message={error} />}

            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name<span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={fieldClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email<span className="ml-1 text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password<span className="ml-1 text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                // The backend rejects anything shorter; saying so up front
                // avoids a round trip to find out.
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={fieldClass}
              />
              {mode === "signup" && (
                <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
              )}
            </div>

            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="role"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Role<span className="ml-1 text-red-500">*</span>
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600"
                  >
                    {ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="organization"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Organisation
                  </label>
                  <input
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    autoComplete="organization"
                    className={fieldClass}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm text-slate-600">
            {mode === "signin" ? "No account yet? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
