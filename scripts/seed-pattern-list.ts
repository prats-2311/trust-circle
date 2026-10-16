import type { ScamType } from "../src/domain/types";

// Kept apart from seed-patterns.ts so the evaluation can import the list without running the seed.
// Anonymised scripts of well-known scams, written for this project. No names, numbers, links or amounts.
export const PATTERNS: { description: string; scamType: ScamType }[] = [
  { description: "Caller claims to be a grandchild in custody and asks for bail money to be sent urgently and kept secret.", scamType: "impersonation_family" },
  { description: "Message from a new number claims to be a family member who lost their phone and needs money or gift cards today.", scamType: "impersonation_family" },
  { description: "Message says an account has been limited and asks the person to log in through a link to verify their identity.", scamType: "impersonation_organisation" },
  { description: "Caller claims to be from the bank fraud team and asks the person to move their savings to a safe account.", scamType: "impersonation_organisation" },
  { description: "Caller claims to be a tax or police official and threatens arrest unless a fine is paid today by gift card.", scamType: "impersonation_organisation" },
  { description: "Supplier says their bank details have changed and asks for an overdue invoice to be paid to a new account.", scamType: "invoice" },
  { description: "A manager writes from a personal address asking for gift cards to be bought urgently and kept confidential.", scamType: "invoice" },
  { description: "Pop-up or caller says the computer is infected and asks for payment to a technician to fix it.", scamType: "tech_support" },
  { description: "An online partner who has never met the person asks for money for travel, customs or a medical emergency.", scamType: "romance" },
  { description: "Message says the person has won a prize and must pay a fee or taxes first to release it.", scamType: "prize_or_lottery" },
];
