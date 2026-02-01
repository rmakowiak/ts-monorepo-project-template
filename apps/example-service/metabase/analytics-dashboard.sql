-- ============================================================================
-- Metabase Analytics Dashboard - Predefined SQL Queries
-- ============================================================================
-- This file contains SQL queries for business analytics dashboards in Metabase.
-- These queries can be used to create visualizations manually or via the
-- automated setup script (setup-metabase-dashboard.sh).

-- Query 1: Event Type Distribution (Pie Chart)
-- Name: Events by Type
-- Visualization: Pie Chart
-- Purpose: Shows the distribution of different event types over the last 30 days
SELECT
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY event_type
ORDER BY count DESC;

-- Query 2: Most Viewed Products (Table)
-- Name: Top Viewed Products
-- Visualization: Table
-- Purpose: Identifies the most frequently viewed products
SELECT
  metadata->>'productId' as product_id,
  metadata->>'sku' as sku,
  metadata->>'name' as product_name,
  COUNT(*) as view_count
FROM analytics_events
WHERE event_type = 'product_viewed'
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY
  metadata->>'productId',
  metadata->>'sku',
  metadata->>'name'
ORDER BY view_count DESC
LIMIT 20;

-- Query 3: Product Activity Timeline (Line Chart)
-- Name: Product Events Over Time
-- Visualization: Line Chart
-- Purpose: Shows product event trends over time
SELECT
  DATE(timestamp) as date,
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), event_type
ORDER BY date ASC;

-- Query 4: User Activity (Table)
-- Name: Most Active Users
-- Visualization: Table
-- Purpose: Identifies users with the most activity
SELECT
  user_id,
  COUNT(*) as event_count,
  COUNT(DISTINCT event_type) as unique_event_types,
  MIN(timestamp) as first_event,
  MAX(timestamp) as last_event
FROM analytics_events
WHERE user_id IS NOT NULL
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id
ORDER BY event_count DESC
LIMIT 20;

-- Query 5: Hourly Activity Pattern (Bar Chart)
-- Name: Events by Hour of Day
-- Visualization: Bar Chart
-- Purpose: Shows peak usage hours
SELECT
  EXTRACT(HOUR FROM timestamp) as hour,
  COUNT(*) as event_count
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM timestamp)
ORDER BY hour;

-- Query 6: Product Lifecycle Metrics (Number Cards)
-- Name: Product Lifecycle Metrics
-- Visualization: Number (Scalar)
-- Purpose: Key metrics for product CRUD operations
SELECT
  COUNT(*) FILTER (WHERE event_type = 'product_created') as created,
  COUNT(*) FILTER (WHERE event_type = 'product_updated') as updated,
  COUNT(*) FILTER (WHERE event_type = 'product_deleted') as deleted,
  COUNT(*) FILTER (WHERE event_type = 'product_viewed') as viewed
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days';

-- Query 7: Recent Product Creates (Table)
-- Name: Recently Created Products
-- Visualization: Table
-- Purpose: Shows products created in the last 7 days
SELECT
  timestamp,
  user_id,
  metadata->>'sku' as sku,
  metadata->>'name' as product_name,
  (metadata->>'price')::numeric as price
FROM analytics_events
WHERE event_type = 'product_created'
  AND timestamp >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY timestamp DESC
LIMIT 50;

-- Query 8: Event Distribution by User (Bar Chart)
-- Name: Events per User
-- Visualization: Bar Chart
-- Purpose: Shows which users are most active
SELECT
  user_id,
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE user_id IS NOT NULL
  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, event_type
ORDER BY user_id, count DESC
LIMIT 100;

-- Query 9: Trace Correlation Example (Table)
-- Name: Events by Trace ID
-- Visualization: Table
-- Purpose: Shows all events within a specific trace (for debugging)
-- Note: Update the trace_id value to match a real trace from your logs
SELECT
  timestamp,
  event_type,
  user_id,
  metadata,
  trace_id
FROM analytics_events
WHERE trace_id = '{{trace_id}}' -- Metabase parameter
ORDER BY timestamp ASC;

-- Query 10: Daily Active Users (Line Chart)
-- Name: Daily Active Users
-- Visualization: Line Chart
-- Purpose: Shows unique users per day
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT user_id) as active_users
FROM analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
  AND user_id IS NOT NULL
GROUP BY DATE(timestamp)
ORDER BY date ASC;
