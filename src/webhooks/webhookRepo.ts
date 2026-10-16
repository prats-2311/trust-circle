export interface WebhookRepo {
  /**
   * Takes the event for processing. A new id is inserted (attempts 1). An id that has not been processed
   * is taken again (attempts + 1). Returns null for an event that was already processed.
   */
  claim(eventId: string, type: string, at: Date): Promise<{ attempts: number } | null>;
  markProcessed(eventId: string, at: Date, result: string): Promise<void>;
  /** Leaves processed_at empty so the event can be claimed again and stays visible as unprocessed. */
  markFailed(eventId: string, at: Date, errorName: string): Promise<void>;
}
