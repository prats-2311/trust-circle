export interface WebhookRepo {
  /** Inserts the event id; false if it was already there. */
  claim(eventId: string, type: string, at: Date): Promise<boolean>;
  markProcessed(eventId: string, at: Date, result: string): Promise<void>;
  /** Leaves processed_at empty so the event stays visible as unprocessed. */
  markFailed(eventId: string, at: Date, errorName: string): Promise<void>;
}
