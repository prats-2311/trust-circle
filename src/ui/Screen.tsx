import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";
import { SwitchPerson } from "./SwitchPerson";

/** One decision per screen: a narrow column on every device, with actions pinned to the bottom on phones and following the content from 768 px up. */
export function Screen({ title, backHref, chip, children, footer }: { title?: string; backHref?: string; chip?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="focus:outline-none mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-4">
      <div className="flex min-h-[48px] flex-wrap items-center gap-x-2 md:flex-nowrap md:justify-between">
        <div className="order-1 flex min-w-0 items-center gap-2 md:flex-1">
          {backHref && (
            <Link href={backHref} aria-label="Back" data-testid="screen-back" className="-ml-2.5 flex h-11 w-11 flex-none items-center justify-center rounded-xl text-ink">
              <ArrowLeftIcon aria-hidden="true" size={24} />
            </Link>
          )}
          {title && <span data-testid="screen-brand" className="[overflow-wrap:anywhere] text-[18px] font-bold leading-tight">{title}</span>}
        </div>
        <SwitchPerson className="order-2 -mr-2 ml-auto md:ml-0" />
        {chip && <div data-testid="screen-chip" className="order-3 flex basis-full pb-1 md:order-2 md:basis-auto md:pb-0">{chip}</div>}
      </div>
      <div className="flex flex-1 flex-col md:flex-none">{children}</div>
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
