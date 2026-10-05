// The one input skin, so a text box and a select never disagree by a pixel.
//
// These live outside Primitives.tsx on purpose: a module that exports anything
// other than components loses React Fast Refresh for everything in it, and
// Primitives.tsx is edited often enough for that to matter.

const base =
  "w-full rounded-md border border-line-strong bg-surface text-sm text-ink outline-none " +
  "transition-colors duration-200 placeholder:text-ink-subtle " +
  "focus:border-brand focus:ring-2 focus:ring-brand/20";

export const inputClass = `h-10 px-3 ${base} disabled:bg-surface-sunken disabled:text-ink-subtle`;

export const selectClass = inputClass;

export const textareaClass = `px-3 py-2.5 ${base}`;
