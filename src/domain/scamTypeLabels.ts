import type { ScamType } from "./types";

export const SCAM_TYPE_LABELS: Record<ScamType, string> = {
  impersonation_family: "Family member in trouble",
  impersonation_organisation: "Pretending to be a company or official",
  invoice: "Fake or changed invoice",
  investment: "Investment scam",
  romance: "Romance scam",
  tech_support: "Tech support scam",
  shopping: "Fake seller",
  prize_or_lottery: "Prize or lottery scam",
  other: "Other scam",
  none: "Not a scam",
  unknown: "Not sure yet",
};
