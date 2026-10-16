import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

const BASE = "inline-flex w-full items-center justify-center gap-2 rounded-control text-[19px] font-bold transition-transform active:scale-[0.98] disabled:opacity-60";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "min-h-[58px] bg-evergreen px-5 text-white hover:bg-evergreen-dark",
  secondary: "min-h-[58px] border-2 border-ink bg-transparent px-5 text-ink hover:bg-surface",
  danger: "min-h-[58px] bg-blocked px-5 text-white hover:brightness-95",
  quiet: "min-h-[44px] bg-transparent px-3 text-[18px] font-medium text-ink-2 underline underline-offset-4",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`} />;
}

export function ButtonLink({ href, variant = "primary", children, className = "", "data-testid": testId }: { href: string; variant?: ButtonVariant; children: ReactNode; className?: string; "data-testid"?: string }) {
  return (
    <Link href={href} data-testid={testId} className={`${BASE} ${VARIANTS[variant]} no-underline ${className}`}>
      {children}
    </Link>
  );
}
