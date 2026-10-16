import { HoldRing } from "@/ui/HoldRing";
import { DemoButtons } from "./DemoButtons";

const STEPS = [
  { title: "Check the message", body: "Paste a text or a screenshot. The AI explains what gave the scam away, in plain words.", tone: "evergreen" },
  { title: "Pause the payment", body: "A risky payment is approved in PayPal but held, so the money doesn't leave and the pressure is off.", tone: "evergreen" },
  { title: "Ask the real person", body: "“Did you just ask Grandma for $800?” One tap from the real Daniel stops it.", tone: "held" },
  { title: "Warn other families", body: "A confirmed scam account is flagged for everyone, and reworded versions of the script are caught too.", tone: "held" },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-ground text-ink">
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 pt-6">
        <span className="text-[20px] font-extrabold text-evergreen">Trust Circle</span>
        <span className="text-[16px] text-ink-2">Runs in the PayPal sandbox. No real money moves.</span>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-6 pb-[72px] pt-14 md:grid-cols-2">
          <div className="flex flex-col gap-[22px]">
            <h1 className="text-[clamp(40px,5.2vw,68px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
              Scammers pretend to be someone you trust. So we ask that person.
            </h1>
            <p className="max-w-[34rem] text-[21px] leading-normal text-ink-2">
              Trust Circle holds a risky PayPal payment and checks with the real grandson, and with your family, before any money moves.
            </p>
            <div className="mt-1.5">
              <DemoButtons />
            </div>
            <p className="text-[16px] text-ink-3">No sign-up. Each demo opens with example payments already in place.</p>
          </div>

          <div className="flex justify-center">
            <div className="flex w-[320px] max-w-full flex-col items-center gap-3.5 rounded-[40px] bg-surface px-6 pb-[30px] pt-7 shadow-phone">
              <HoldRing fractionUsed={0.125} amountCents={80000} label="Payment on hold, 3 of 24 hours used" />
              <span className="text-center text-[20px] font-extrabold leading-tight">Your money hasn&apos;t left your account</span>
              <span className="text-center text-[16px] leading-snug text-ink-2">We&apos;ve asked Daniel if it was really him.</span>
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto max-w-[1200px] px-6 py-16">
            <h2 className="text-[32px] font-extrabold leading-tight tracking-[-0.01em]">How a payment is protected</h2>
            <ol className="mt-8 grid list-none gap-7 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`flex flex-col gap-2.5 border-t-[3px] pt-[18px] ${s.tone === "held" ? "border-held" : "border-evergreen"}`}>
                  <span className={`text-[16px] font-extrabold ${s.tone === "held" ? "text-held" : "text-evergreen"}`}>Step {i + 1}</span>
                  <span className="text-[21px] font-extrabold">{s.title}</span>
                  <span className="text-[17px] leading-normal text-ink-2">{s.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] items-start gap-10 px-6 py-16 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.2] tracking-[-0.01em]">
              In 2025, people 60 and over reported losing $7.7 billion to online fraud.
            </p>
            <p className="text-[16px] text-ink-2">
              201,266 complaints to the FBI.{" "}
              <a
                href="https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf"
                target="_blank"
                rel="noopener"
                aria-label="FBI IC3 2025 Internet Crime Report, opens in a new tab"
                className="inline-block min-h-[44px] py-2.5 font-bold text-evergreen underline underline-offset-4"
              >
                FBI IC3 2025 Internet Crime Report
              </a>
            </p>
          </div>
          <p className="text-[19px] leading-[1.55] text-ink-2">
            Many scams work by borrowing someone&apos;s trust: a grandchild, a bank, PayPal itself. Trust Circle doesn&apos;t try to out-guess every new script. It
            goes to the person being impersonated and lets them say no.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 px-6 pb-10 pt-7 text-[16px] text-ink-2">
          <span>Built for the PayPal AI Hackathon with PayPal Orders and Payouts, Groq, AG Grid and Render.</span>
          <span>A hackathon project, not a PayPal product.</span>
        </div>
      </footer>
    </div>
  );
}
