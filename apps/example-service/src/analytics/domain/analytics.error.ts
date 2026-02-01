export class AnalyticsEventNotFoundError extends Error {
  constructor(id: string) {
    super(`Analytics event not found: ${id}`);
    this.name = "AnalyticsEventNotFoundError";
  }
}
