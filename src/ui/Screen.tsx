import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";

/** One decision per screen: a narrow column on every device, with actions pinned to the bottom. */
export function Screen({ title, backHref, chip, children, footer }: { title?: string; backHref?: string; chip?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-4">
      {(backHref || title || chip) && (
        <div className="flex min-h-[48px] items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link href={backHref} aria-label="Back" className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-xl text-ink">
                <ArrowLeftIcon aria-hidden="true" size={24} />
              </Link>
            )}
            {title && <span className="truncate text-[18px] font-bold">{title}</span>}
          </div>
          {chip}
        </div>
      )}
      <div className="flex flex-1 flex-col">{children}</div>
      {footer && <div className="mt-8 flex flex-col gap-2.5">{footer}</div>}
    </main>
  );
}

export function Title({ children, id }: { children: ReactNode; id?: string }) {
  return <h1 id={id} className="mt-5 [overflow-wrap:anywhere] text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]">{children}</h1>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[18px] leading-relaxed text-ink-2">{children}</p>;
}

export function FinePrint({ children }: { children: ReactNode }) {
  return <p className="text-center text-[16px] leading-snug text-ink-3">{children}</p>;
}
