# Demo video script

Target length: 2:50, under Devpost's 3-minute limit. One narrator. Every on-screen line below is real copy from the app.

## Recording notes

- Record on the production URL ({{DEMO_URL}}), not a dev server, so no dev badge appears. Warm the service first by loading `/api/health` a minute before you start: a sleeping free Render service takes about a minute on its first request.
- Run the `demo reset` workflow from the repo's Actions tab (or record soon after 09:00 UTC) so the demo starts clean.
- Browser zoom 100%. Use a phone, or the iPhone simulator, at about 390 px wide for Margaret's and Daniel's screens, and a laptop window at about 1280 px for Sarah's dashboard and trends.
- For the push shot (1:30), Daniel's device needs push turned on: on an iPhone, add the app to the Home Screen first and turn on alerts in the app. If push isn't set up, show the alert on his circle screen instead and change the narration from "his phone buzzes" to "Daniel sees the request".
- The PayPal sandbox buyer login for the approval step is in the private Devpost testing instructions. Don't show the password field being typed: cut from **Continue** to the approved hold.
- Use only invented names, numbers and companies, as in the script (`daniel.newphone@example.com`, `+1 (415) 555-0199`).
- No third-party trademarks beyond PayPal's own sandbox UI, which the project integrates. No logos of banks or other brands. No music unless it is licensed for this use or you made it; silence or room tone is fine.
- Upload to YouTube as **Public** and check the length is under 3:00.

## Shot list

| Time | Shot | On screen | Narration |
|---|---|---|---|
| 0:00–0:15 | The hook | Landing page statistic, then the headline. | "In 2025, people 60 and over reported losing 7.7 billion dollars to online fraud. That's the FBI's figure. Most of these scams borrow someone's trust. So Trust Circle does something simple: scammers pretend to be someone you trust, so we ask that person." |
| 0:15–0:35 | Margaret checks a message | Phone. **Try as Margaret**, then **Check a message**. Paste the "Hi Grandma it's me, I lost my phone…" text. Result: "This message is very likely a scam", with "What gave it away". | "This is Margaret. Her 'grandson' texts from a new number asking for $800 in gift cards. She pastes it in. Groq reads it and tells her, in plain words, what gave it away." |
| 0:35–0:55 | She tries to pay anyway | **Send money**: `daniel.newphone@example.com`, $800, "My grandson Daniel called crying, he's in jail and needs bail money today." Screen: "Let's pause before this goes", with the reasons. | "Then he calls, crying. She wants to send the money anyway. Before PayPal is even involved, Trust Circle checks the payment: a new payee, more than her family's limit, and a story that sounds like a known scam. The AI can raise the risk, never lower it." |
| 0:55–1:15 | Approve in PayPal sandbox | **Continue, and let Sarah review it**, the PayPal sandbox approval window, then back to the app. | "She can still go ahead, and she approves in PayPal as usual. But the payment is only authorised, not captured. As far as she's concerned, it's done, so the pressure is off." |
| 1:15–1:30 | The hold ring | The hold screen: the ring, "$800 On hold", "Your money hasn't left your account", and "We've asked Daniel if it was really them". | "The money hasn't left her account. And here's the key step: we've asked Daniel, the real grandson, whether it was really him." |
| 1:30–1:50 | Daniel's phone | Second phone. The push alert arrives. Tap it: "Did you just ask Margaret for $800?" Tap **It wasn't me**. Screen: "Thank you, Daniel. We stopped it." | "Daniel's phone buzzes. Did you just ask Margaret for $800? A scammer can copy his voice and his story, but he can't answer from Daniel's phone. One tap: it wasn't me." |
| 1:50–2:05 | Margaret is safe | Margaret's phone: "Payment stopped. Your money is safe." with "Sarah has been told" and "This account is on the shared scam list now, so other families are warned." | "The PayPal authorisation is voided. Margaret sees a calm result, with no blame. Her daughter is told, and that account is now on a shared scam list, so other families are protected too." |
| 2:05–2:30 | Sarah's circle | Laptop. **Try as Sarah, her daughter**: her circle, then **See all payments** (AG Grid dashboard: money protected, scams stopped), **Review recent payments** (aftercare findings), then **Scam trends** (AG Charts). | "Sarah, her daughter, sees everything in one place, built with AG Grid. An aftercare agent, using PayPal's Agent Toolkit, reviews Margaret's recent payments. It can only read, never move money. And AG Charts shows which scams people are reporting, including reworded versions we catch by meaning." |
| 2:30–2:45 | Architecture | A still of the architecture diagram from the README, with three labels: PayPal, Groq, Render. | "Under the hood: PayPal Orders with authorise, capture and void, Payouts, refunds and verified webhooks. Groq for the judgements and Prompt Guard for injected instructions. Hosted on Render. All in the PayPal sandbox." |
| 2:45–2:50 | Close | The headline on the landing page. | "Trust Circle. Scammers pretend to be someone you trust. So we ask that person." |

## Before you publish

- Every number said aloud matches the landing page and `docs/eval/results.md`.
- The video shows the app working on the devices it was built for (a phone and a laptop browser).
- No password, client secret or API key is visible in any frame.
