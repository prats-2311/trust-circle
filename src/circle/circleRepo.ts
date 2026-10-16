export interface CircleMember {
  contactId: string;
  displayName: string;
  relationship: string;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  safeWordHash: string | null;
}

export interface CircleRepo {
  contactsOf(senderId: string): Promise<CircleMember[]>;
  getUser(id: string): Promise<UserRecord | null>;
  setSafeWordHash(userId: string, hash: string): Promise<void>;
}

export function createMemoryCircleRepo(
  seed: { users?: UserRecord[]; links?: { senderId: string; contactId: string; relationship: string }[] } = {},
): CircleRepo {
  const users = new Map((seed.users ?? []).map((u) => [u.id, { ...u }]));
  const links = seed.links ?? [];
  return {
    async contactsOf(senderId) {
      return links
        .filter((l) => l.senderId === senderId)
        .map((l) => ({ contactId: l.contactId, displayName: users.get(l.contactId)?.displayName ?? "", relationship: l.relationship }));
    },
    async getUser(id) {
      const u = users.get(id);
      return u ? { ...u } : null;
    },
    async setSafeWordHash(userId, hash) {
      const u = users.get(userId);
      if (u) u.safeWordHash = hash;
    },
  };
}
