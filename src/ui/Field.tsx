import type { ReactNode } from "react";

/** Label above, hint and error below; children is the input, which must use `id` and `aria-describedby`. */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[18px] font-bold">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-[16px] leading-snug text-ink-3">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-[16px] font-bold text-blocked-ink">
          {error}
        </span>
      )}
    </div>
  );
}

export const INPUT = "min-h-[56px] w-full rounded-control border-2 border-line-strong bg-surface px-4 text-[18px] text-ink";

export function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
