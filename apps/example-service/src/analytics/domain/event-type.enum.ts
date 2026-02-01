export const EventType = {
  // Product events
  PRODUCT_CREATED: "product_created",
  PRODUCT_UPDATED: "product_updated",
  PRODUCT_DELETED: "product_deleted",
  PRODUCT_VIEWED: "product_viewed",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];
