"use client";
import { fileKind } from "./fileKind";
import { Button } from "@/ui/Button";
import { Field, INPUT } from "@/ui/Field";
import { MicrophoneIcon } from "@/ui/icons";
import { FinePrint, Screen, Title } from "@/ui/Screen";

export function CheckForm({
  text, onText, file, preview, onFile, error, busy, onSubmit,
}: {
  text: string;
  onText: (v: string) => void;
  file: File | null;
  preview: string | null;
  onFile: (f: File | null) => void;
  error?: string;
  busy: boolean;
  onSubmit: () => void;
}) {
  const audio = file !== null && fileKind(file) === "audio";
  const hint = file ? `We'll check the ${audio ? "voice note" : "screenshot"}. Remove it to paste text instead.` : "You can paste a text, an email or part of an invoice.";
  return (
    <Screen
      title="Check a message"
      backHref="/home"
      footer={
        <>
          <Button data-testid="check-submit" disabled={busy || (!text.trim() && !file)} onClick={onSubmit}>
            Check this message
          </Button>
          <FinePrint>Screenshots are read and then deleted. We keep only the words.</FinePrint>
        </>
      }
    >
      <Title>Paste the message, or add a screenshot</Title>
      <div className="mt-6 flex flex-col gap-6">
        <Field id="message" label="The message" hint={hint} error={error}>
          <textarea
            id="message"
            rows={6}
            value={text}
            disabled={file !== null}
            onChange={(e) => onText(e.target.value)}
            className={`${INPUT} py-3.5`}
          />
        </Field>
        {file && (audio || preview) ? (
          <div className="flex items-center gap-4">
            {audio ? (
              <div aria-hidden="true" className="flex h-[92px] w-[92px] flex-none items-center justify-center rounded-[14px] border border-line bg-surface">
                <MicrophoneIcon size={40} weight="bold" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview ?? undefined} alt="Your screenshot" className="h-[92px] w-[92px] flex-none rounded-[14px] border border-line object-cover" />
            )}
            <div className="flex min-w-0 flex-col items-start gap-1">
              <span className="max-w-full truncate text-[17px] font-bold">{file.name}</span>
              <Button variant="quiet" className="w-auto!" onClick={() => onFile(null)}>
                {audio ? "Remove voice note" : "Remove screenshot"}
              </Button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-2 text-[18px] font-bold">
            Or add a screenshot or voice note
            <span className="focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-held inline-flex min-h-[58px] w-full items-center justify-center rounded-control border-2 border-ink px-5 text-[19px] font-bold">
              Choose a screenshot or voice note
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,audio/*,.opus,.ogg,.m4a,.mp3,.wav,.webm"
                className="sr-only"
                data-testid="check-file"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </span>
          </label>
        )}
      </div>
    </Screen>
  );
}
