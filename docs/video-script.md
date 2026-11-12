# Demo video script

Target length: 2:50, under Devpost's 3-minute limit. One narrator. Every on-screen line below is real copy from the app.

## Recording notes

- Record on the production URL (https://trust-circle.onrender.com), not a dev server, so no dev badge appears. Warm the service first by loading `/api/health` a minute before you start: a sleeping free Render service takes about a minute on its first request.
- Run the `demo reset` workflow from the repo's Actions tab (or record soon after 09:00 UTC) so the demo starts clean.
- Browser zoom 100%. Use a phone, or the iPhone simulator, at about 390 px wide for Margaret's and Daniel's screens, and a laptop window at about 1280 px for Sarah's dashboard and trends.
- For the push shot (0:55), Daniel's device needs push turned on: on an iPhone, add the app to the Home Screen first and turn on alerts in the app. If push isn't set up, show the alert on his circle screen instead and change the narration from "his phone buzzes" to "Daniel sees the request".
- The PayPal sandbox buyer login for the approval step is in the private Devpost testing instructions. Don't show the password field being typed, or the sign-in page's autofill list: cut from **Continue, and let Sarah review it** to the approved hold. PayPal's button says "Complete Purchase"; if that screen is shown, keep the [PayPal: AUTHORIZED, not captured] caption on it.
- Use one browser tab for the app and switch person inside it, only after Margaret's screen says "We've asked Daniel". Every tab shares one sign-in, so switching in a second tab while the PayPal window is open makes the approval fail with "Only the sender can complete this payment."
- Film the message check and **Report this to PayPal** in one take without reloading: a reloaded check shows the plain "This message is very likely a scam" headline instead of "Someone is pretending to be your grandson".
- Don't send the phishing@paypal.com email draft; close it unsent.
- Use only invented names, numbers and companies, as in the script (`daniel.newphone@example.com`, `+1 (415) 555-0199`).
- No third-party trademarks beyond PayPal's own sandbox UI, which the project integrates. No logos of banks or other brands. No music unless it is licensed for this use or you made it; silence or room tone is fine.
- Upload to YouTube as **Public** and check the length is under 3:00.
- Before recording, read every line aloud at a calm pace and time it. A beat that overruns gets trimmed, not rushed.
- Press **Review recent payments** once before the Sarah take: the first press after a quiet spell can fall back to Trust Circle's own checks.
- Record each beat separately and cut them together. An AI voiceover is allowed (organisers' announcement of 2 Nov). Upload early: YouTube processing can take hours.
- Put a caption on every beat: judges often watch on mute. The "PayPal:" captions name the real PayPal state at that moment; the "PayPal says" column on Sarah's dashboard shows the same states, so they can be checked on screen.
- For the genuine beat (1:30), use a second payment to a different, invented payee (for example `rent@harbourlets.example`, $800, "My grandson Daniel asked me to pay his rent deposit"). A new payee, an unusual amount and over the circle limit is high risk on the rules alone, so it is held and Daniel is asked. If it isn't held, re-take with a larger amount. Don't reuse `daniel.newphone@example.com`: after the first beat it is on the scam list.

## Shot list

| Time | Shot | On screen (caption in brackets) | Narration |
|---|---|---|---|
| 0:00–0:10 | The hook | Margaret's phone, **Check a message**, with the "Hi Grandma it's me, I lost my phone… I need $800 in gift cards today. Please don't tell mom" text pasted in. [People 60+ lost $7.7 billion to online fraud in 2025 · FBI IC3] | "Hi Grandma, it's me. New phone, I need 800 dollars, don't tell mom. Last year, people over 60 lost 7.7 billion dollars to fraud." |
| 0:10–0:19 | Who's who | A title card: three circles labelled **Margaret** (pays with PayPal), **Daniel, her grandson** and **Sarah, her daughter**, with a ring around Daniel and Sarah labelled "Trust Circle". Or the landing page's three **Try as…** buttons. [Margaret · Daniel, her grandson · Sarah, her daughter] | "Trust Circle is for them and the family who look out for them: here, Daniel, her grandson, and Sarah, her daughter." |
| 0:19–0:28 | The check | Tap **Check**: "Someone is pretending to be your grandson", the reasons, and "It came from +1 (415) 555-0199, not Daniel's number." [Scammers pretend to be someone you trust. So we ask that person.] | "Groq calls it a scam, and spots it isn't Daniel's number. Most of today's protections guess. We ask the real grandson." |
| 0:28–0:35 | Report it | Tap **Report this to PayPal**: the note "These contact details are now on the shared scam list" and the email draft to phishing@paypal.com opening. Stop before anything is sent. [One tap reports it to PayPal] | "One tap adds the number to a shared scam list and drafts a report to PayPal." |
| 0:35–0:55 | She pays anyway | **Send money**: `daniel.newphone@example.com`, $800, "My grandson Daniel called crying, he's in jail and needs bail money today." Screen: "Let's pause before this goes", with the reasons. [AI decided: hold] Hold on "If you continue, PayPal holds the money. Sarah can approve or stop it." Then the **Pay with PayPal** button under **Continue, and let Sarah review it**, the PayPal sandbox approval, and back to the waiting screen: "We've asked Daniel if it was really them". [PayPal: AUTHORIZED, not captured] | "But he calls, crying, so she pays anyway. New payee, over her limit, a jail-bail story: the AI decides it must wait. She approves in PayPal, but PayPal only authorises it. The money hasn't left, and we ask Daniel." |
| 0:55–1:18 | Daniel's phone | Second phone (on one device, tap **See what Daniel sees**). The push alert arrives. Tap it: "Did you just ask Margaret for $800?" Hold on the question. Tap **It wasn't me**. Screen: "Thank you, Daniel. We stopped it." [The real Daniel answers] | "This is the real Daniel, on his own phone. Did you just ask Margaret for 800 dollars? A scammer can copy his voice and his story. He can't answer from Daniel's phone. One tap: it wasn't me." |
| 1:18–1:30 | Margaret is safe | Margaret's phone: "Payment stopped. Your money is safe.", "PayPal confirmed it: this payment is voided." and "This account is on the shared scam list now, so other families are warned." [PayPal: VOIDED] | "PayPal voids the authorisation. Margaret sees a calm result, with no blame, and that account goes on a shared scam list, so other families are protected too." |
| 1:30–1:40 | When it's really him | Cut straight to a second payment already held: `rent@harbourlets.example`, $800, "We've asked Daniel". Daniel taps **Yes, it was me**: "Thanks. The payment is going ahead." Don't film the second PayPal approval. [PayPal: CAPTURED, then paid out] | "And when it really is him? Daniel taps yes, and PayPal captures and pays it out. Real family requests still go through." |
| 1:40–2:10 | Sarah's view | Laptop. **Try as Sarah, her daughter**, then **See all payments**: the AG Studio board with the **Money protected** and **PayPal check** widgets, then the AG Grid table with the **PayPal says** column (Voided, Captured). Then **Review recent payments** (aftercare findings and "What the agent checked"). [AG Grid · AG Studio · PayPal Agent Toolkit] | "Sarah, her daughter, sees every payment on a dashboard built with AG Grid and AG Studio, with our own widgets, theme and layout. A PayPal check compares each payment with PayPal's own record. And an aftercare agent on PayPal's Agent Toolkit reviews recent payments for anything the checks missed." |
| 2:10–2:28 | Proof | The README's "What the AI adds" table, all three rows, then the "Rules and AI" row highlighted. [Rules alone: 0 of 23 held, or 17 of 23 with 7 genuine held · Rules and AI: 23 of 23, 1 of 20 genuine] | "Does the AI earn its place? On 23 scam payments, rules alone hold none. Even holding everything they flag, they catch 17 and wrongly hold 7 genuine payments. With the AI: all 23 held, and just 1 of 20 genuine." |
| 2:28–2:38 | Under the hood | A still of the architecture diagram (`docs/images/diagram-architecture.png`). [PayPal · Groq · Render] | "Under the hood: PayPal authorise, void and capture, Payouts and verified webhooks. Groq for every judgement. Hosted on Render." |
| 2:38–2:50 | Vision and close | The landing headline. [Trust Circle] | "Only public PayPal APIs, so this could be a setting on every PayPal account. Trust Circle. Scammers pretend to be someone you trust. So we ask that person." |

## Before you publish

- Every number said aloud matches the landing page and `docs/eval/results.md`.
- The video shows the app working on the devices it was built for (a phone and a laptop browser).
- No password, client secret or API key is visible in any frame.
