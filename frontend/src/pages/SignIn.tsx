import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Leaf } from "lucide-react";

import { InlineError } from "../components/ui/States";
import { Button, Field } from "../components/ui/Primitives";
import { inputClass, selectClass } from "../components/ui/fieldStyles";
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

  const signingIn = mode === "signin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand text-ink-inverse">
            <Leaf size={19} aria-hidden="true" />
          </span>

          <span>
            <span className="block text-base font-semibold tracking-tight text-ink">
              EIA Platform
            </span>
            <span className="block text-xs text-ink-muted">
              AI-assisted environmental impact assessment
            </span>
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="border-b border-line px-6 py-5">
            <h1 className="text-lg font-semibold text-ink">
              {signingIn ? "Sign in" : "Create an account"}
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              {signingIn
                ? "Sign in to reach your projects and assessments."
                : "Your role sets the defaults used in an assessment."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 p-6">
            {error && <InlineError message={error} />}

            {!signingIn && (
              <Field label="Full name" htmlFor="name" required>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="Email" htmlFor="email" required>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              // The backend rejects anything shorter; saying so up front
              // avoids a round trip to find out.
              hint={signingIn ? undefined : "At least 8 characters."}
            >
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={signingIn ? undefined : 8}
                autoComplete={signingIn ? "current-password" : "new-password"}
                className={inputClass}
              />
            </Field>

            {!signingIn && (
              <>
                <Field label="Role" htmlFor="role" required>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className={selectClass}
                  >
                    {ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Organisation" htmlFor="organization">
                  <input
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    autoComplete="organization"
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            <Button type="submit" disabled={busy} busy={busy} full>
              {signingIn ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="border-t border-line bg-surface-sunken px-6 py-4 text-center text-sm text-ink-muted">
            {signingIn ? "No account yet? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(signingIn ? "signup" : "signin");
                setError(null);
              }}
              className="font-semibold text-brand transition-colors duration-200 hover:text-brand-hover"
            >
              {signingIn ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
