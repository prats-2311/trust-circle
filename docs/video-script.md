# Demo video script

Target length: 2:50, under Devpost's 3-minute limit. One narrator. Every on-screen line below is real copy from the app.

## Recording notes

- Record on the production URL (https://trust-circle.onrender.com), not a dev server, so no dev badge appears. Warm the service first by loading `/api/health` a minute before you start: a sleeping free Render service takes about a minute on its first request.
- Run the `demo reset` workflow from the repo's Actions tab (or record soon after 09:00 UTC) so the demo starts clean.
- Browser zoom 100%. Use a phone, or the iPhone simulator, at about 390 px wide for Margaret's and Daniel's screens, and a laptop window at about 1280 px for Sarah's dashboard and trends.
- For the push shot (0:50), Daniel's device needs push turned on: on an iPhone, add the app to the Home Screen first and turn on alerts in the app. If push isn't set up, show the alert on his circle screen instead and change the narration from "his phone buzzes" to "Daniel sees the request".
- The PayPal sandbox buyer login for the approval step is in the private Devpost testing instructions. Don't show the password field being typed: cut from **Continue, and let Sarah review it** to the approved hold.
- Use only invented names, numbers and companies, as in the script (`daniel.newphone@example.com`, `+1 (415) 555-0199`).
- No third-party trademarks beyond PayPal's own sandbox UI, which the project integrates. No logos of banks or other brands. No music unless it is licensed for this use or you made it; silence or room tone is fine.
- Upload to YouTube as **Public** and check the length is under 3:00.
- Record each beat separately and cut them together. An AI voiceover is allowed (organisers' announcement of 2 Nov). Upload early: YouTube processing can take hours.
- Put a caption on every beat: judges often watch on mute. The "PayPal:" captions name the real PayPal state at that moment; the "PayPal says" column on Sarah's dashboard shows the same states, so they can be checked on screen.
- For the genuine beat (1:35), use a second payment to a different, invented payee (for example `rent@harbourlets.example`, $800, "My grandson Daniel asked me to pay his rent deposit"). A new payee, an unusual amount and over the circle limit is high risk on the rules alone, so it is held and Daniel is asked. If it isn't held, re-take with a larger amount. Don't reuse `daniel.newphone@example.com`: after the first beat it is on the scam list.

## Shot list

| Time | Shot | On screen (caption in brackets) | Narration |
|---|---|---|---|
| 0:00–0:12 | The scene | Margaret's phone, **Check a message**, with the "Hi Grandma it's me, I lost my phone… I need $800… Please don't tell mom" text pasted in. Then the landing headline. [Scammers pretend to be someone you trust.] | "Margaret's grandson texts from a new number. He's in trouble, he needs $800, and please don't tell mom. Scammers pretend to be someone you trust. So we ask that person." |
| 0:12–0:22 | The difference | Landing page statistic. [FBI IC3 2025: $7.7 billion lost by people 60+] | "Most of today's protections guess: they score the payment, or the message. We ask the real grandson, the one person a scammer can't fake." |
| 0:22–0:50 | She pays anyway | **Send money**: `daniel.newphone@example.com`, $800, "My grandson Daniel called crying, he's in jail and needs bail money today." Screen: "Let's pause before this goes", with the reasons. [AI decided: hold] Then **Continue, and let Sarah review it**, the PayPal sandbox approval window, and back to the waiting screen: "We've asked Daniel if it was really them". [PayPal: AUTHORIZED, not captured] | "Margaret already checked the message, and Groq called it a scam. But he calls, crying, so she pays anyway. Rules and Groq's AI read the payment and her reason: new payee, over her family's limit, a jail-bail story. The AI decides it must wait. She approves in PayPal as usual, but PayPal only authorises it. The money hasn't left, and we ask Daniel." |
| 0:50–1:20 | Daniel's phone | Second phone (on one device, tap **See what Daniel sees**). The push alert arrives. Tap it: "Did you just ask Margaret for $800?" Hold on the question. Tap **It wasn't me**. Screen: "Thank you, Daniel. We stopped it." [The real Daniel answers] | "This is the real Daniel, on his own phone. Did you just ask Margaret for 800 dollars? A scammer can copy his voice and his story. He can't answer from Daniel's phone. Daniel has no idea what this is. One tap: it wasn't me." |
| 1:20–1:35 | Margaret is safe | Margaret's phone: "Payment stopped. Your money is safe." with "This account is on the shared scam list now, so other families are warned." [PayPal: VOIDED] | "PayPal voids the authorisation. Margaret sees a calm result, with no blame, and that account goes on a shared scam list, so other families are protected too." |
| 1:35–1:45 | When it's really him | A second payment, to `rent@harbourlets.example`, held the same way. Daniel taps **Yes, it was me**: "Thanks. The payment is going ahead." [PayPal: CAPTURED, then paid out] | "And when it really is him? Daniel taps yes, PayPal captures the payment and pays it out. Real family requests still go through." |
| 1:45–2:10 | Sarah's view | Laptop. **Try as Sarah, her daughter**, then **See all payments**: the AG Studio board with the **Money protected** and **PayPal check** widgets, then the AG Grid table with the **PayPal says** column. Then **Review recent payments** (aftercare findings and "What the agent checked"). [AG Grid · AG Studio · PayPal Agent Toolkit] | "Sarah, her daughter, sees every payment on a dashboard built with AG Grid and AG Studio, with our own widgets, theme and layout. A PayPal check compares each payment with PayPal's own record. And an aftercare agent on PayPal's Agent Toolkit reviews recent payments for anything the checks missed." |
| 2:10–2:25 | Proof | The README's "What the AI adds" table, with the "Rules alone" and "Rules and AI" rows highlighted. [Rules alone: 0 of 23 scams held · Rules and AI: 23 of 23] | "Does the AI earn its place? On 23 scam payments, rules alone hold none and don't even warn on 6. With the AI, all 23 are held, and just 1 of 20 genuine payments." |
| 2:25–2:40 | Under the hood | A still of the architecture diagram from the README. [PayPal · Groq · Render] | "Under the hood: PayPal Orders with authorise, void and capture, Payouts and verified webhooks. Groq for every judgement. Hosted on Render." |
| 2:40–2:50 | Vision and close | The landing headline. [Trust Circle] | "Only public PayPal APIs, so this could be a setting on every PayPal account. Trust Circle. Scammers pretend to be someone you trust. So we ask that person." |

## Before you publish

- Every number said aloud matches the landing page and `docs/eval/results.md`.
- The video shows the app working on the devices it was built for (a phone and a laptop browser).
- No password, client secret or API key is visible in any frame.
