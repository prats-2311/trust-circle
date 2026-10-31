"use client";
import { useEffect, useRef, useState } from "react";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { Lead, Screen } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { useOnce } from "@/ui/useOnce";
import { CheckForm } from "./CheckForm";
import { fileKind, fileTooLarge } from "./fileKind";
import { CheckResult, PreviewTile, type CheckResponse } from "./CheckResult";

type Phase =
  | { kind: "loadingOne" }
  | { kind: "input"; error?: string }
  | { kind: "checking"; preview: string | null; audio: boolean }
  | { kind: "result"; check: CheckResponse; preview: string | null; justNow: boolean; retry: Input | null }
  | { kind: "signedOut" };
type Input = { text: string } | { file: File };

export default function CheckPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const { busy, run } = useOnce();

  // Every object URL we create is revoked when replaced, on reset and on unmount.
  const pickedUrl = useRef<string | null>(null);
  const resultUrl = useRef<string | null>(null);
  const revoke = (ref: { current: string | null }) => {
    if (ref.current) URL.revokeObjectURL(ref.current);
    ref.current = null;
  };

  const pick = (f: File | null) => {
    revoke(pickedUrl);
    if (f) pickedUrl.current = URL.createObjectURL(f);
    setPicked(f && pickedUrl.current ? { file: f, preview: pickedUrl.current } : null);
  };

  useEffect(
    () => () => {
      revoke(pickedUrl);
      revoke(resultUrl);
    },
    [],
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    let cancelled = false;
    (async () => {
      setPhase({ kind: "loadingOne" });
      const r = await fetchJson<CheckResponse>(`/api/messages?id=${encodeURIComponent(id)}`);
      if (cancelled) return;
      if (r.ok) return setPhase({ kind: "result", check: r.data, preview: null, justNow: false, retry: null });
      setPhase(r.signedOut ? { kind: "signedOut" } : { kind: "input", error: r.status === 404 ? r.error : "We couldn't open that check. Please try again." });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (input: Input) =>
    run(async () => {
      revoke(resultUrl);
      const kind = "file" in input ? fileKind(input.file) : null;
      if ("file" in input && !kind) {
        return setPhase({ kind: "input", error: "Please add a screenshot saved as PNG, JPG or WEBP, or a voice note saved as OGG, OPUS, M4A, MP3, WAV or WEBM." });
      }
      const tooLarge = "file" in input ? fileTooLarge(kind, input.file.size) : null;
      if (tooLarge) return setPhase({ kind: "input", error: tooLarge });
      const pv = kind === "image" && "file" in input ? URL.createObjectURL(input.file) : null;
      resultUrl.current = pv;
      setPhase({ kind: "checking", preview: pv, audio: kind === "audio" });
      let init: RequestInit;
      if ("file" in input) {
        const form = new FormData();
        form.append(kind === "audio" ? "audio" : "image", input.file);
        init = { method: "POST", body: form };
      } else {
        init = jsonBody({ text: input.text });
      }
      const r = await fetchJson<CheckResponse>("/api/messages/check", init);
      if (r.ok) return setPhase({ kind: "result", check: r.data, preview: pv, justNow: true, retry: input });
      revoke(resultUrl);
      if (r.signedOut) return setPhase({ kind: "signedOut" });
      setPhase({ kind: "input", error: r.status === 400 || r.status === 413 || r.status === 429 || r.status === 0 ? r.error : "We couldn't check that message. Please try again." });
    });

  const send = () => submit(picked ? { file: picked.file } : { text: text.trim() });

  if (phase.kind === "signedOut") {
    return (
      <Screen title="Check a message">
        <SignedOut />
      </Screen>
    );
  }
  if (phase.kind === "loadingOne") {
    return (
      <Screen title="Check a message" backHref="/home">
        <p role="status" className="sr-only">
          Opening your check…
        </p>
        <Skeleton blocks={[34, 30, 18, 18, 18]} />
      </Screen>
    );
  }
  if (phase.kind === "checking") {
    return (
      <Screen title="Check a message" backHref="/home">
        <div className="mt-[22px] flex items-center gap-4">
          <PreviewTile preview={phase.preview} audio={phase.audio} />
          <p role="status" className="text-[20px] font-bold leading-snug">
            {phase.audio ? "Listening to your voice note…" : "Reading your message…"}
          </p>
        </div>
        <Lead>This takes a few seconds. We look for the tricks scammers use and check the contact details against reports from other families.</Lead>
        <Skeleton blocks={[30, 18, 18, 18, 18]} />
      </Screen>
    );
  }
  if (phase.kind === "result") {
    return (
      <CheckResult
        check={phase.check}
        preview={phase.preview}
        justNow={phase.justNow}
        canRetry={phase.retry !== null}
        onRetry={() => phase.retry && submit(phase.retry)}
        onNewCheck={() => {
          window.history.replaceState(null, "", "/check");
          revoke(resultUrl);
          pick(null);
          setText("");
          setPhase({ kind: "input" });
        }}
      />
    );
  }
  return <CheckForm text={text} onText={setText} file={picked?.file ?? null} preview={picked?.preview ?? null} onFile={pick} error={phase.error} busy={busy} onSubmit={send} />;
}
