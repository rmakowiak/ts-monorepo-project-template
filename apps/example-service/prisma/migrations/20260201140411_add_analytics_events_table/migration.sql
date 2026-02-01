-- DropIndex
DROP INDEX "categories_slug_idx";

-- DropIndex
DROP INDEX "products_sku_idx";

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(255),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "trace_id" VARCHAR(32),

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_timestamp_idx" ON "analytics_events"("event_type", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_timestamp_idx" ON "analytics_events"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_trace_id_idx" ON "analytics_events"("trace_id");
