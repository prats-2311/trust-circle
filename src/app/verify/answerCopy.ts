export type AnswerInput = {
  answer: "me" | "not_me";
  status: number;
  viewerName: string;
  senderName: string;
  payee: string;
  amount: string;
};

/** What the real person sees after answering. A 202 is still "going ahead", never "done". */
export function answerCopy(a: AnswerInput): { title: string; lead: string } {
  if (a.status === 409) return { title: "This has already been answered", lead: "Nothing more is needed from you." };
  if (a.answer === "not_me") {
    return {
      title: `Thank you, ${a.viewerName}. We stopped it.`,
      lead: `${a.senderName}'s money is safe, and other families are now warned about this account.`,
    };
  }
  return { title: "Thanks. The payment is going ahead.", lead: `We're sending ${a.amount} to ${a.payee}.` };
}
