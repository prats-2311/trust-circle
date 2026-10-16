export interface OfficialRoute {
  organisation: string;
  steps: string[];
}

const ROUTES: { match: RegExp; steps: string[] }[] = [
  {
    match: /paypal/i,
    steps: [
      "Don't use any phone number or link from the message.",
      "Open the PayPal app, or type paypal.com into your browser yourself, and go to Help.",
      "PayPal will never ask you to send money to protect your account.",
    ],
  },
  {
    match: /\b(bank|credit union|card|fraud team)\b/i,
    steps: [
      "Hang up and call the number on the back of your bank card.",
      "Your bank will never ask you to move money to a \"safe account\".",
    ],
  },
  {
    match: /\b(irs|tax|social security|government|police|sheriff|court|fbi|medicare|customs)\b/i,
    steps: [
      "Hang up and find the agency's number on its official .gov website.",
      "Government agencies don't demand payment by gift card, crypto, wire transfer or PayPal, and don't threaten arrest over the phone.",
    ],
  },
  {
    match: /\b(microsoft|apple|amazon|tech|support|technician|computer)\b/i,
    steps: [
      "Close the message or hang up.",
      "Contact the company through its official website or app, never a number from a pop-up or message.",
      "Real support teams don't ask for payment to fix your computer.",
    ],
  },
];

const DEFAULT_STEPS = [
  "Don't use any number, email or link from the message.",
  "Find the organisation's official contact details yourself, on its website or a letter you trust, and ask them directly.",
];

const DISCONNECT_STEP =
  "Hang up, and switch off the computer or phone they were connected to. Someone who controls your screen can show you a fake balance or a fake refund.";

export function officialRouteFor(name: string, opts: { remoteAccess?: boolean } = {}): OfficialRoute {
  const route = ROUTES.find((r) => r.match.test(name));
  const steps = route ? route.steps : DEFAULT_STEPS;
  return { organisation: name.trim(), steps: opts.remoteAccess ? [DISCONNECT_STEP, ...steps] : steps };
}
