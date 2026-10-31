export interface CircleMember {
  contactId: string;
  displayName: string;
  relationship: string;
}

/** A circle member plus their own phone number. Only the message check reads this; never send it to a client. */
export type KnownContact = CircleMember & { phone: string | null };

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  safeWordHash: string | null;
}

export interface CircleSender {
  senderId: string;
  displayName: string;
  relationship: string;
}

export interface CircleRepo {
  contactsOf(senderId: string): Promise<CircleMember[]>;
  contactsWithPhones(senderId: string): Promise<KnownContact[]>;
  getUser(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  sendersOf(contactId: string): Promise<CircleSender[]>;
  setSafeWordHash(userId: string, hash: string): Promise<void>;
}

export function createMemoryCircleRepo(
  seed: { users?: UserRecord[]; phones?: Record<string, string>; links?: { senderId: string; contactId: string; relationship: string }[] } = {},
): CircleRepo {
  const users = new Map((seed.users ?? []).map((u) => [u.id, { ...u }]));
  const links = seed.links ?? [];
  return {
    async contactsOf(senderId) {
      return links
        .filter((l) => l.senderId === senderId)
        .map((l) => ({ contactId: l.contactId, displayName: users.get(l.contactId)?.displayName ?? "", relationship: l.relationship }));
    },
    async contactsWithPhones(senderId) {
      return links
        .filter((l) => l.senderId === senderId)
        .map((l) => ({
          contactId: l.contactId,
          displayName: users.get(l.contactId)?.displayName ?? "",
          relationship: l.relationship,
          phone: seed.phones?.[l.contactId] ?? null,
        }));
    },
    async getUser(id) {
      const u = users.get(id);
      return u ? { ...u } : null;
    },
    async getUserByEmail(email) {
      const u = [...users.values()].find((x) => x.email.toLowerCase() === email.toLowerCase());
      return u ? { ...u } : null;
    },
    async sendersOf(contactId) {
      return links
        .filter((l) => l.contactId === contactId)
        .map((l) => ({ senderId: l.senderId, displayName: users.get(l.senderId)?.displayName ?? "", relationship: l.relationship }));
    },
    async setSafeWordHash(userId, hash) {
      const u = users.get(userId);
      if (u) u.safeWordHash = hash;
    },
  };
}
