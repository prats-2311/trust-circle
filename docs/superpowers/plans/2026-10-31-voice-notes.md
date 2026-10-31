# Voice Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Margaret can attach a voice note on **Check a message**. It is transcribed with Groq Whisper and checked exactly like a typed message.

**Architecture:**
- A new Groq transcription client and an audio byte-sniffer sit beside the existing judge.
- `messageService.check` gains an `audio` request. It sniffs, transcribes, then hands the transcript to the existing `assessMessage` as a `text` input and stores the record with `source: "voice"`.
- The UI sends audio as a multipart `audio` field. The result screen adds a transcript block and a "voices can be copied" line.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Vitest (`npm test`, `npm run test:int` with docker db-test on 5434), Playwright (`npm run test:e2e`), Groq OpenAI-compatible audio endpoint.

**Spec:** `docs/superpowers/specs/2026-10-31-voice-notes-design.md`

## Global Constraints

- **Formats** (sniffed from bytes; the declared MIME is never trusted): Ogg `OggS`; WAV `RIFF....WAVE`; MP3 `ID3`, or a byte `0xFF` followed by a byte with `(b & 0xE0) === 0xE0`; MP4/M4A `ftyp` at offset 4; WebM `1A 45 DF A3`.
- **Format error copy:** "Please add a voice note saved as OGG, OPUS, M4A, MP3, WAV or WEBM."
- **Size:** max audio file 10 MB (`10_000_000`). The whole-request cap becomes 11 MB (`11_000_000`). Screenshots keep their 3 MB limit and copy.
- **Too-large audio copy:** "That voice note is too large. Please check one under 10 MB."
- **Groq:**
  - endpoint `https://api.groq.com/openai/v1/audio/transcriptions`, multipart fields `file` and `model`;
  - model from env `GROQ_AUDIO_MODEL`, default `whisper-large-v3-turbo`;
  - 30 s timeout, no language parameter;
  - Ogg is sent with file name `voice.ogg`.
- **Transcript:** truncated to `MAX_MESSAGE_CHARS` (4000), never rejected for length.
- **Could not understand** (transcription failed, timed out, or empty/whitespace): nothing is saved. Error copy: "We couldn't listen to this one. Please type what it says, or ask the person directly."
- **Rate cap:** 20 voice checks per user per rolling hour, in memory. Over-cap copy (HTTP 429): "You've checked a lot of voice notes in the last hour. Please try again later."
- **Voice line on every voice result:**
  - with a person `impersonatedRequester` named N: "A voice that sounds like N isn't proof. Voices can be copied. Call N on the number you already have."
  - otherwise: "A voice that sounds like someone you know isn't proof. Voices can be copied. Call them on the number you already have."
- **Transcript block heading:** "What the voice note says".
- **Never store or log** the audio, the file name, the transcript or Groq's response body. Log only model, ms and ok, as `groqChat` does.
- **No migration:** `message_checks.source` is a text column, so widen the TS union to `"text" | "image" | "voice"`.

## Review Focus

1. A WhatsApp `.opus` file whose browser MIME is empty or `application/octet-stream` must still be sent as audio. Pinned in Task 4 (`fileKind`).
2. A voice note of silence (Whisper returns `""` or whitespace) must not be saved or shown as low risk. Pinned in Task 3.
3. A 5 MB voice note must be accepted, not refused with the screenshot's 3 MB message. Pinned in Tasks 2 and 3.
4. A transcript containing "ignore previous instructions…" must go through the prompt guard like pasted text. Pinned in Task 3.
5. A 21st voice check in an hour is refused with 429, while another user, or a text check, still works. Pinned in Task 3.

---

### Task 1: Audio sniffer and Groq transcriber

**Files:**
- Create: `src/messages/audio.ts`, `src/messages/audio.test.ts`
- Create: `src/ai/groqTranscriber.ts`, `src/ai/groqTranscriber.test.ts`
- Modify: `src/config/env.ts` (add `GROQ_AUDIO_MODEL: withDefault("whisper-large-v3-turbo")` beside `GROQ_GUARD_MODEL`)
- Modify: `.env.example` (an optional, commented line in the style of `GROQ_GUARD_MODEL`)
- Modify: `docs/deploy.md` (one row in the step-4 table: optional, default `whisper-large-v3-turbo`)

**Interfaces:**
- Produces:
  - `export type AudioFormat = "ogg" | "wav" | "mp3" | "m4a" | "webm"`
  - `export function sniffAudio(b: Uint8Array): AudioFormat | null`
  - `export function audioFileName(f: AudioFormat): string`, returning `voice.ogg`, `voice.wav`, `voice.mp3`, `voice.m4a` or `voice.webm`
  - `export type TranscriptResult = { ok: true; text: string } | { ok: false; error: string }`
  - `export type Transcriber = (audio: { bytes: Uint8Array; format: AudioFormat }) => Promise<TranscriptResult>`
  - `export function createGroqTranscriber(opts: { apiKey: string; model: string; timeoutMs?: number; fetchImpl?: typeof fetch }): Transcriber`

- [ ] **Step 1: Write failing tests.**
  - `audio.test.ts`: one positive per format, built from minimal header bytes (`OggS…`, `RIFF\0\0\0\0WAVE`, `ID3`, `[0xFF,0xFB]`, `[0,0,0,0x20,…"ftyp"]`, `[0x1A,0x45,0xDF,0xA3]`); `sniffAudio` of a PNG header → `null`; `sniffAudio(new Uint8Array())` → `null`; `audioFileName("ogg") === "voice.ogg"`.
  - `groqTranscriber.test.ts`, with a fake `fetchImpl`:
    - posts to the audio URL with `Authorization: Bearer k` and a `FormData` carrying `model` and a `file` named `voice.ogg` for format `ogg`;
    - `{ text: " hi " }` → `{ ok: true, text: "hi" }` (trimmed);
    - HTTP 500 → `{ ok: false, error: "groq http 500" }`;
    - a rejected fetch with `name = "TimeoutError"` → `{ ok: false, error: "TimeoutError" }`;
    - a JSON body without a string `text` → `{ ok: false, error: "groq empty response" }`.
- [ ] **Step 2:** Run `npx vitest run src/messages/audio.test.ts src/ai/groqTranscriber.test.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement.**
  - `sniffAudio` as in Global Constraints. MP3 frame sync is checked after ID3.
  - The transcriber mirrors `groqChat`: errors are returned, never thrown; default `timeoutMs` 30_000; it logs only `{ model, ms, ok }`.
  - An empty string after trimming is still `ok: true, text: ""`. The service decides it is unusable.
- [ ] **Step 4:** Run the same tests, plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: Groq voice transcription client and audio format sniffing`.

### Task 2: Accept an `audio` field in the check request

**Files:**
- Modify: `src/server/checkRequest.ts`, `src/app/api/messages/check/route.ts`
- Test: `src/server/checkRequest.test.ts` (create if absent), plus the route test next to the route if one exists (`src/app/api/messages/check/route.test.ts`)

**Interfaces:**
- Produces:
  - `MAX_UPLOAD_BYTES = 11_000_000`
  - `ParsedCheck = { text: string } | { image: Uint8Array } | { audio: Uint8Array } | { error: "bad_body" } | { error: "too_large"; field: "image" | "audio" }`
  - The route's 413 body is `{ error, field }`, using the screenshot copy (unchanged) for `image` and the audio copy for `audio`. When the size is refused from `content-length` before the form is read, `field` is `"image"`. **[ruling]** The client never sends a non-multipart body that large.

- [ ] **Step 1: Write failing tests.**
  - multipart with `audio` (a 5 MB `File`) → `{ audio }` with 5,000,000 bytes;
  - multipart with an `audio` file over 11 MB → `{ error: "too_large", field: "audio" }`;
  - `image` still wins if both are present (existing order: image, then audio, then text);
  - the route's 413 copy for `field: "audio"` is the audio copy.
- [ ] **Step 2:** Run `npx vitest run src/server/checkRequest.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Note that `messages.check({ senderId, ...parsed })` now spreads `{ audio }`; Task 3 adds that to `CheckRequest`. Until then, add `audio` to the `CheckRequest` union so typecheck passes, and leave a `MessageInputError("audio", …)` throw in `toInput` for Task 3 to replace.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: the check request accepts a voice note`.

### Task 3: Voice checks in the message service

**Files:**
- Modify: `src/messages/messageService.ts`, `src/messages/messageRepo.ts:7`, `src/db/schema.ts:85` (type only), `src/server/container.ts:26-30`, `src/server/http.ts` (`errorResponse`)
- Test: `src/messages/messageService.test.ts`, plus an integration test beside the existing message integration tests (`*.int.test.ts` pattern)

**Interfaces:**
- Consumes: Task 1 `sniffAudio`, `Transcriber`; Task 2 `{ audio: Uint8Array }`.
- Produces:
  - `CheckRequest` adds `{ senderId: string; audio: Uint8Array }`
  - `export const MAX_AUDIO_BYTES = 10_000_000`
  - `MessageInputError.field` is `"text" | "image" | "audio"`
  - `export class VoiceLimitError extends Error`, which `errorResponse` maps to 429 `{ error }`
  - `createMessageService` deps gain `transcribe?: Transcriber` and `now?: () => number` (for the cap)
  - stored `source: "voice"`

- [ ] **Step 1: Write failing unit tests** in `messageService.test.ts` (fake repo, judge, guard and transcriber):
  - Audio, transcriber returns "Gran it's Daniel, send $800 to danny.help@example.com":
    - the judge receives `{ kind: "text", text: <that> }`;
    - the repo inserts `source: "voice"` and `text: <that>`;
    - the guard is called with the transcript (Review Focus 4).
  - Transcriber `{ ok: false }`, or `{ ok: true, text: "   " }`: throws `MessageInputError` with `field: "audio"` and the could-not-understand copy; `repo.insert` is not called (Review Focus 2).
  - Empty bytes → `MessageInputError("audio", …)`. Unsniffable bytes → the format error copy. 10,000,001 bytes → the audio too-large copy. A 5 MB valid header passes the size check (Review Focus 3).
  - A transcript of 5,000 chars is stored truncated to 4,000, with no error.
  - The cap:
    - 20 voice checks by `u1` succeed; the 21st throws `VoiceLimitError`;
    - `u2` and a text check by `u1` still succeed;
    - after `now()` advances 3,600,001 ms, `u1` succeeds again (Review Focus 5).
  - No `transcribe` dep configured, with an audio request: throws the could-not-understand copy and does not crash.
- [ ] **Step 2:** Run `npx vitest run src/messages/messageService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Transcribe inside `check` before `assessMessage`.
  - Count toward the cap only once the request passed validation.
  - Wire `createGroqTranscriber({ apiKey: env.GROQ_API_KEY, model: env.GROQ_AUDIO_MODEL })` in `container.ts`.
  - Add `VoiceLimitError` to `errorResponse` (429).
  - Widen the `source` types.
- [ ] **Step 4: Write the integration test.** It uses the real repo and a fake transcriber. After a voice check whose transcript contains `danny.help@example.com`, the high-risk path gives `flaggedPayees(sender)` containing the matchKeys of that email, and `linkedMessage(sender, "danny.help@example.com")` returns the transcript. Use a fake judge returning level `high`.
- [ ] **Step 5:** Run `npm test`, `npm run test:int` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: voice notes are transcribed and checked like typed messages`.

### Task 4: Check screen: attach a voice note, see the transcript and the voice line

**Files:**
- Modify: `src/app/check/CheckForm.tsx`, `src/app/check/page.tsx`, `src/app/check/CheckResult.tsx`, `src/app/check/resultCopy.ts`, `src/server/messageView.ts` (source type only)
- Test: `src/app/check/resultCopy.test.ts`, a new `src/app/check/fileKind.test.ts`, `e2e/check-message.spec.ts`

**Interfaces:**
- Consumes: the API response now has `source: "text" | "image" | "voice"`.
- Produces:
  - `export function fileKind(f: { name: string; type: string }): "image" | "audio" | null` in `src/app/check/fileKind.ts`. Image if the type is `image/png|jpeg|webp` or the name ends `.png/.jpg/.jpeg/.webp`. Audio if the type starts with `audio/` or `video/webm`, or the name ends `.opus/.ogg/.oga/.m4a/.mp3/.wav/.webm`. Otherwise null.
  - `export function voiceLine(r: Requester | null): string` in `resultCopy.ts`, with the exact copy from Global Constraints.
  - `CheckView` / `CheckResponse` gain `source`.

- [ ] **Step 1: Write failing tests.**
  - `fileKind({ name: "PTT-20261031-WA0003.opus", type: "" })` → `"audio"` (Review Focus 1).
  - `{ name: "a.ogg", type: "application/octet-stream" }` → `"audio"`.
  - `{ name: "x.png", type: "image/png" }` → `"image"`.
  - `{ name: "doc.pdf", type: "application/pdf" }` → `null`.
  - `voiceLine({ kind: "person", name: "Daniel" })` → the named copy.
  - `voiceLine({ kind: "organisation", name: "PayPal" })` and `voiceLine(null)` → the generic copy.
- [ ] **Step 2:** Run `npx vitest run src/app/check`. Expected: FAIL.
- [ ] **Step 3: Implement the UI.**
  - The file input `accept` adds `audio/*,.opus,.ogg,.m4a,.mp3,.wav,.webm`. Labels become "Or add a screenshot or voice note" and "Choose a screenshot or voice note".
  - `page.tsx` appends the file under `fileKind(file)`, as `"image"` or `"audio"`. A `null` kind shows the format error inline without sending.
  - An audio pick shows no `<img>` preview: a tile with the project's existing icon set (`src/ui/icons.ts`, add an audio/microphone glyph in the same style if none exists), the file name, and "Remove voice note".
  - The checking state for audio reads "Listening to your voice note…".
  - On a `source === "voice"` result, show, after the Lead:
    - a "What the voice note says" block (the same panel style as "The message you pasted") with the full transcript;
    - `voiceLine(check.impersonatedRequester)` as a paragraph.

    Both appear for every level, including not checked.
  - The 429 copy shows as a form error, like 400/413: add 429 to the status list in `submit`.
- [ ] **Step 4: Add an e2e test** in `e2e/check-message.spec.ts`, stubbing `**/api/messages/check` like "an unchecked result is never shown as safe":
  - assert the request is multipart and contains `name="audio"`;
  - fulfil with a high-risk `source: "voice"` response naming Daniel;
  - attach `fixtures/scam-voice.m4a`, or a tiny generated buffer named `note.opus` if Task 5 hasn't run yet;
  - expect "What the voice note says", the transcript text, and the Daniel voice line.
- [ ] **Step 5:** Run `npm test`, `npm run typecheck`, `npm run lint` and `npx playwright test e2e/check-message.spec.ts` (needs docker db on 5433). Expected: PASS.
- [ ] **Step 6:** Commit: `feat: attach a voice note on the check screen`.

### Task 5: Synthetic voice fixture, live smoke, eval case

**Files:**
- Create: `scripts/make-fixture-audio.ts`, `fixtures/scam-voice.m4a` (committed)
- Modify: `scripts/smoke-message-check.ts`, `src/eval/cases.ts`, `package.json` (a script `fixture:audio`), `README.md` (only if the eval figures change)

**Interfaces:**
- Consumes: Task 1 `createGroqTranscriber`, `sniffAudio`.

- [ ] **Step 1: Write the fixture script.**
  - It runs `say -v Samantha -o fixtures/scam-voice.m4a --file-format=m4af --data-format=aac "<SCRIPT>"`, where `SCRIPT` = "Hi Gran, it's Daniel. I've lost my phone and I'm in real trouble. Please send eight hundred dollars to my PayPal, danny dot help at example dot com, today. Don't tell Mum."
  - It exports `SCRIPT` and refuses to run off macOS.
  - Run it once; commit the file.
- [ ] **Step 2: Add the live smoke leg.**
  - Transcribe the fixture with the real transcriber.
  - Print `transcribed ok` and the character count only (never the text).
  - `assessMessage` the transcript and `show("voice", …)`.
  - Exit non-zero unless the level is `high` and an `email` identifier is present.
  - Run with the env loaded (`node --env-file=.env.local` via the existing smoke npm script). Expected: high, and an email identifier. Spoken "dot"/"at" may be transcribed literally. If no email is extracted, report it as a finding and do not change identifier extraction in this task.
- [ ] **Step 3: Add the eval case.** In `src/eval/cases.ts` add `msg("m-voice-01", "family", "scam", SCRIPT_WRITTEN)`, where `SCRIPT_WRITTEN` is the script with the email written as `danny.help@example.com`. Run `npm test` (the eval unit tests count cases; update the expected count if one exists).
- [ ] **Step 4: Re-run `npm run eval:live`.** If the reported figures change, update the README figures and the committed eval results the script writes. Otherwise change nothing.
- [ ] **Step 5:** Commit: `test: synthetic voice-note fixture, live smoke and eval case`.
