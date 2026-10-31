# Voice notes: design

Status: approved in conversation 2026-10-31. Builder's calls are marked **[my call]**.

## Purpose

Scammers increasingly send voice notes ("Gran, it's Daniel, I've lost my phone…"), sometimes with a cloned voice. Today Margaret can check a typed message or a screenshot, but not a voice note. This adds voice notes to the same check, so the answer she gets, and the protection on any later payment, is the same whatever form the scam arrived in.

## Goals

- Margaret attaches a voice note on **Check a message** the way she attaches a screenshot today.
- The app turns it into words, shows her **"What the voice note says"**, and runs the existing check on those words: AI judge, prompt guard, scam patterns, reported-scammer registry, "pretending to be someone in your circle".
- Payees mentioned in a high-risk voice note (PayPal email, phone) feed the existing payment link (`flaggedPayees` / `linkedMessage`), so a later payment to that payee is held and the real person is asked. No new link mechanism.
- One extra line on every voice result, whatever the level: *"A voice that sounds like Daniel isn't proof. Voices can be copied. Call Daniel on the number you already have."* The name comes from `impersonatedRequester`, which exists only on a fresh check result. Otherwise, including past checks loaded later where it is not stored, the line reads: *"A voice that sounds like someone you know isn't proof. Voices can be copied. Call them on the number you already have."* **[my call]** Nothing is persisted for this, so no migration.

## Non-goals

- Recording audio inside the app.
- Sharing straight from WhatsApp (that is the later share-target feature).
- Detecting cloned or synthetic voices. We never claim to; the advice is to call.
- A "Pay from this check" button. The identifier link already covers it.

## Anti-goals (failure even if it works)

- Storing the audio anywhere (DB, disk, logs). Only the words are stored, exactly like screenshots today.
- Logging the transcript or any message text.
- A voice note the app could not understand being shown as "low risk" or "safe".

## Behaviour

1. **Input.** The file input on `/check` also accepts audio. Formats: WhatsApp `.opus`/`.ogg`, `.m4a`, `.mp3`, `.wav`, `.webm`. Max **10 MB**. The declared MIME type is not trusted: sniff the first bytes, as `sniffImage` does.
   - Ogg `OggS`, WAV `RIFF....WAVE`, MP3 `ID3` or an MPEG frame sync (`0xFF` then `0xE0` mask), MP4/M4A `ftyp` at offset 4, WebM EBML `1A 45 DF A3`.
   - Anything else gets the error *"Please add a voice note saved as OGG, OPUS, M4A, MP3, WAV or WEBM."*
2. **Transcription.** Call Groq's audio transcription endpoint (`/openai/v1/audio/transcriptions`, multipart) with model `whisper-large-v3-turbo`.
   - Read the model from a new optional env var `GROQ_AUDIO_MODEL`, defaulting to `whisper-large-v3-turbo`, following `GROQ_GUARD_MODEL`.
   - Send Ogg/Opus with an `.ogg` file name. Groq does not list `.opus`, but the container is Ogg.
   - Same error style as `groqChat`: errors are returned, never thrown, with a timeout. **[my call] 30 s timeout.**
   - Language is auto-detected; no language parameter.
3. **Check.** The transcript becomes the message text and goes through `assessMessage` as a text check, with source `"voice"`.
   - It is truncated to `MAX_MESSAGE_CHARS` (4000). **[my call]** Truncate rather than reject, since she can't edit a voice note.
   - Stored on `message_checks` with `source = "voice"` and the transcript as `text`. `source` is a text column, so no migration is needed; widen the TS union.
4. **Result screen.** Same as today, plus:
   - a **"What the voice note says"** block showing the transcript;
   - the voice line from Goals.

   A small audio icon replaces the screenshot `PreviewTile`. **[my call]** No audio player: the file is not kept, and she has just heard it anyway.
5. **Could not understand.** If transcription fails, times out, or returns no words (empty or whitespace), nothing is saved. The form shows *"We couldn't listen to this one. Please type what it says, or ask the person directly."*, with Try again. There is no check yet, so no name is known. **[my call]**
   - **No automatic hold.** With no words there is nothing to link a payment to. Any later payment still goes through the normal payment check.
   - **[my call]** Not saving keeps history free of empty "unchecked" rows.
6. **If the AI judge fails after a successful transcription,** it is the existing unchecked path (`checked = false`, level null, signals still raise to high). Nothing new.
7. **Past checks** (`GET /api/messages?id=`) show voice checks with the transcript block and the voice line.

## Constraints

- Request size: `MAX_UPLOAD_BYTES` (4 MB) covers the whole request today, and the `content-length` check runs before the content type is known. Audio needs a 10 MB file plus form overhead. **[my call]**
  - Raise the request cap to 11 MB for every request.
  - Keep enforcing the 3 MB screenshot limit, with its copy, in the message service, as now.
  - `too_large` carries the field (`image` | `audio`) so the 413 copy fits. Audio copy: *"That voice note is too large. Please check one under 10 MB."*
  - The multipart field is `audio`; `image` and `text` are unchanged.
- Groq audio requests count against the same API key and quota. A 10 MB cap keeps one call well under Groq's 25 MB free-tier file limit.
- Sign-in is required, as for every check. There is no rate limiting in the app today. Each voice check costs a Groq call on the shared key, so voice checks get a small per-user cap: **20 per hour, in memory**, like the scam feed's story cap. Over the cap, the user sees *"You've checked a lot of voice notes in the last hour. Please try again later."* (HTTP 429). **[my call]**
- If the prompt guard flags the transcript, the result is the same as for pasted text with the same words. Nothing voice-specific.
- `GROQ_AUDIO_MODEL` is optional with a default, like `GROQ_GUARD_MODEL`. Add it to `.env.example` and the deploy guide's table, not to `render.yaml`.
- Never log the transcript, the file name, or Groq's response body. Log only error class and status.

## Tests

- **Unit:**
  - the audio sniffer, one positive per format plus a negative;
  - the Groq transcription client: success, HTTP error, timeout, empty text;
  - the `.opus`→`.ogg` file name;
  - `toInput` and `parseCheckRequest` for `audio`, including the size cap;
  - message service: a voice check stores `source "voice"` and the transcript, and a failed transcription stores nothing;
  - result view: the voice line with and without a known name.
- **Integration:** a voice check whose transcript names a payee email feeds `flaggedPayees`, so a later payment to that email is linked (`linkedMessage`). The transcription client is faked.
- **e2e** (existing Playwright, stubbed AI like the other check tests): attach an audio fixture, see "What the voice note says" and the voice line.
- **Live smoke:** `scripts/make-fixture-audio.ts` makes `fixtures/scam-voice.m4a` with macOS `say`.
  - It is a synthetic voice, no real person, saying a grandson-style request with a PayPal email.
  - The file is committed, so CI does not need `say`.
  - `scripts/smoke-message-check.ts` sends it live and expects a high-risk verdict with that email among the identifiers.
- **Eval:** add one labelled voice case. The eval harness stays text-only: the case is the fixture's script text (what `say` was told to speak, not a real Whisper output), labelled `scam`. The live smoke covers the audio leg. Re-run `npm run eval:live` and update the README figures only if they change.

## Left to the builder

File layout (a new `src/ai/groqTranscriber.ts` beside `groqClient.ts` is the expected shape), component structure, the exact icon, and the copy for the format error, within the rules above.
