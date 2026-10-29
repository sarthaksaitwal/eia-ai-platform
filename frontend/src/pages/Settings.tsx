import { useState } from "react";
import { CheckCircle2, KeyRound, Mail, UserRound } from "lucide-react";

import { InlineError } from "../components/ui/States";
import { Button, Card, CardHeader, Field, PageHeader } from "../components/ui/Primitives";
import { PasswordInput } from "../components/ui/PasswordInput";
import { inputClass, selectClass } from "../components/ui/fieldStyles";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import { ROLES, type Role } from "../lib/types";

/* ---------------------------------------------------------------------------
   Account settings.

   Only what the backend can actually change lives here. Email is shown and
   not editable: it is the sign-in identity and carries a unique constraint,
   so changing it wants a confirmation step this project does not have. There
   is no delete-account control either, for the same reason -- offering one
   that cannot work is worse than not offering it.
--------------------------------------------------------------------------- */

/** A short confirmation that clears itself when the form is next touched. */
function Saved({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ok">
      <CheckCircle2 size={15} aria-hidden="true" />
      {message}
    </p>
  );
}

function ProfileCard() {
  const { user, applyUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [organization, setOrganization] = useState(user?.organization ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "ENVIRONMENTAL_CONSULTANT");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Nothing to save until something differs from what is stored, so the
  // button says so rather than sending an update that changes nothing.
  const changed =
    name.trim() !== (user?.name ?? "")
    || organization.trim() !== (user?.organization ?? "")
    || role !== user?.role;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);

    try {
      const { user: updated } = await api.updateProfile({
        name: name.trim(),
        // "" is meaningful here: it clears the organisation.
        organization: organization.trim(),
        role,
      });
      applyUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader
        title="Your details"
        hint="The name shown on your projects, and the role an assessment uses for its defaults."
      />

      <form onSubmit={onSubmit} className="space-y-4 p-5">
        {error && <InlineError message={error} />}

        <Field label="Full name" htmlFor="name" required>
          <input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
            autoComplete="name"
            className={inputClass}
          />
        </Field>

        <Field label="Organisation" htmlFor="organization" hint="Leave empty if none.">
          <input
            id="organization"
            value={organization}
            onChange={(e) => {
              setOrganization(e.target.value);
              setSaved(false);
            }}
            autoComplete="organization"
            className={inputClass}
          />
        </Field>

        <Field label="Role" htmlFor="role" required>
          <select
            id="role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setSaved(false);
            }}
            className={selectClass}
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || !changed} busy={busy} icon={UserRound}>
            Save changes
          </Button>

          {saved && !changed && <Saved message="Saved." />}
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function edit(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setSaved(false);
      setError(null);
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Checked here as well as by the input's own validation, because the two
    // new-password boxes are the one thing the backend cannot check: it only
    // ever receives one of them.
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setError(null);
    setSaved(false);
    setBusy(true);

    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  const ready = current.length > 0 && next.length >= 8 && confirm.length > 0;

  return (
    <Card className="mb-5">
      <CardHeader
        title="Password"
        hint="You need your current password to set a new one."
      />

      <form onSubmit={onSubmit} className="space-y-4 p-5">
        {error && <InlineError message={error} />}

        <Field label="Current password" htmlFor="current-password" required>
          <PasswordInput
            id="current-password"
            value={current}
            onChange={edit(setCurrent)}
            required
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="New password"
          htmlFor="new-password"
          required
          hint="At least 8 characters."
        >
          <PasswordInput
            id="new-password"
            value={next}
            onChange={edit(setNext)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-password" required>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={edit(setConfirm)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || !ready} busy={busy} icon={KeyRound}>
            Update password
          </Button>

          {saved && <Saved message="Password changed." />}
        </div>

        {/* Said plainly because it is a common assumption and the opposite of
            what the backend does: these are stateless tokens with no
            revocation list, so nothing can be signed out from here. */}
        <p className="text-xs text-ink-subtle">
          You stay signed in here, and any other browser you are signed in on
          stays signed in until its session expires.
        </p>
      </form>
    </Card>
  );
}

function AccountCard() {
  const { user } = useAuth();
  const roleLabel = ROLES.find((option) => option.value === user?.role)?.label ?? user?.role;

  const rows = [
    { label: "Email", value: user?.email ?? "—" },
    { label: "Role", value: roleLabel ?? "—" },
    { label: "Member since", value: formatDate(user?.created_at) ?? "—" },
  ];

  return (
    <Card>
      <CardHeader title="Account" hint="Set when the account was created." />

      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 border-b border-line px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-5"
          >
            <dt className="text-xs text-ink-subtle sm:w-40 sm:shrink-0">{row.label}</dt>
            <dd className="truncate text-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-start gap-2 border-t border-line bg-surface-sunken px-5 py-3.5">
        <Mail size={14} className="mt-0.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p className="text-xs text-ink-subtle">
          Your email is how you sign in and cannot be changed here.
        </p>
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        hint="Your details and your password."
      />

      <ProfileCard />
      <PasswordCard />
      <AccountCard />
    </div>
  );
}
