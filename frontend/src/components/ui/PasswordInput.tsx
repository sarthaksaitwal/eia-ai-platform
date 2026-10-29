import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { inputClass } from "./fieldStyles";

/**
 * A password box with a reveal. The toggle sits inside the field so the
 * control keeps one outline and a form keeps one column; the input reserves
 * the width on the right for it.
 *
 * Each instance owns its own visibility, so revealing a new password does not
 * also reveal the current one next to it.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`${inputClass} pr-11`}
      />

      <button
        type="button"
        onClick={() => setShown((wasShown) => !wasShown)}
        // The icon is the only label, so the button needs a spoken one. It
        // names the action rather than the state, because that is what
        // pressing it does next.
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-subtle transition-colors duration-200 hover:text-ink"
      >
        {shown ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
