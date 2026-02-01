#!/bin/bash

# ============================================================================
# Metabase Dashboard Setup Script
# ============================================================================
# This script creates predefined questions and dashboard in Metabase via API.
# It automates the setup of the Product Analytics dashboard with visualizations.
#
# Prerequisites:
# - Metabase must be running (docker-compose up -d metabase)
# - Initial setup wizard must be completed
# - jq must be installed for JSON parsing
#
# Usage:
#   ./scripts/setup-metabase-dashboard.sh

set -e  # Exit on error

# Configuration
METABASE_URL="${METABASE_URL:-http://localhost:3002}"
METABASE_EMAIL="${METABASE_EMAIL:-admin@example.com}"
METABASE_PASSWORD="${METABASE_PASSWORD:-log4jpro}"

echo "🔧 Setting up Metabase Analytics Dashboard..."
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ Error: jq is required but not installed."
  echo "   Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

# 1. Get session token
echo "📝 Authenticating with Metabase..."
SESSION=$(curl -s -X POST \
  "${METABASE_URL}/api/session" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${METABASE_EMAIL}\",\"password\":\"${METABASE_PASSWORD}\"}" \
  | jq -r '.id')

if [ -z "$SESSION" ] || [ "$SESSION" = "null" ]; then
  echo "❌ Failed to authenticate. Please ensure:"
  echo "   1. Metabase is running at ${METABASE_URL}"
  echo "   2. You've completed the initial setup wizard"
  echo "   3. Credentials are correct (email: ${METABASE_EMAIL})"
  exit 1
fi

echo "✅ Authenticated successfully"

# 2. Get database ID
echo "🔍 Finding database connection..."
DATABASE_ID=$(curl -s -X GET \
  "${METABASE_URL}/api/database" \
  -H "X-Metabase-Session: ${SESSION}" \
  | jq -r '.data[] | select(.name == "Example Service") | .id')

if [ -z "$DATABASE_ID" ] || [ "$DATABASE_ID" = "null" ]; then
  echo "❌ Database connection 'Example Service' not found."
  echo "   Please complete initial setup first:"
  echo "   1. Navigate to ${METABASE_URL}"
  echo "   2. Complete the setup wizard"
  echo "   3. Add database connection:"
  echo "      - Display name: Example Service"
  echo "      - Type: PostgreSQL"
  echo "      - Host: postgres"
  echo "      - Port: 5432"
  echo "      - Database: example_dev"
  echo "      - Username: postgres"
  echo "      - Password: postgres"
  exit 1
fi

echo "✅ Found database (ID: ${DATABASE_ID})"

# 3. Create Collection for analytics
echo "📁 Creating Analytics collection..."
COLLECTION_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/collection" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Product Analytics","color":"#509EE3","description":"Business analytics for product events"}' \
  | jq -r '.id')

echo "✅ Collection created (ID: ${COLLECTION_ID})"

# 4. Create Questions (SQL queries)
echo "📊 Creating predefined questions..."

# Question 1: Events by Type (Pie Chart)
QUESTION_1_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/card" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Events by Type\",
    \"dataset_query\": {
      \"type\": \"native\",
      \"native\": {
        \"query\": \"SELECT event_type, COUNT(*) as count FROM analytics_events WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days' GROUP BY event_type ORDER BY count DESC\"
      },
      \"database\": ${DATABASE_ID}
    },
    \"display\": \"pie\",
    \"visualization_settings\": {},
    \"collection_id\": ${COLLECTION_ID}
  }" \
  | jq -r '.id')

echo "  ✓ Events by Type (Pie Chart) - ID: ${QUESTION_1_ID}"

# Question 2: Top Viewed Products (Table)
QUESTION_2_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/card" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Top Viewed Products\",
    \"dataset_query\": {
      \"type\": \"native\",
      \"native\": {
        \"query\": \"SELECT metadata->>'sku' as sku, metadata->>'name' as product_name, COUNT(*) as views FROM analytics_events WHERE event_type = 'product_viewed' AND timestamp >= CURRENT_DATE - INTERVAL '30 days' GROUP BY metadata->>'sku', metadata->>'name' ORDER BY views DESC LIMIT 20\"
      },
      \"database\": ${DATABASE_ID}
    },
    \"display\": \"table\",
    \"visualization_settings\": {},
    \"collection_id\": ${COLLECTION_ID}
  }" \
  | jq -r '.id')

echo "  ✓ Top Viewed Products (Table) - ID: ${QUESTION_2_ID}"

# Question 3: Events Over Time (Line Chart)
QUESTION_3_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/card" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Product Events Over Time\",
    \"dataset_query\": {
      \"type\": \"native\",
      \"native\": {
        \"query\": \"SELECT DATE(timestamp) as date, event_type, COUNT(*) as count FROM analytics_events WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(timestamp), event_type ORDER BY date\"
      },
      \"database\": ${DATABASE_ID}
    },
    \"display\": \"line\",
    \"visualization_settings\": {},
    \"collection_id\": ${COLLECTION_ID}
  }" \
  | jq -r '.id')

echo "  ✓ Product Events Over Time (Line Chart) - ID: ${QUESTION_3_ID}"

# Question 4: Lifecycle Metrics (Numbers)
QUESTION_4_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/card" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Product Lifecycle Metrics\",
    \"dataset_query\": {
      \"type\": \"native\",
      \"native\": {
        \"query\": \"SELECT COUNT(*) FILTER (WHERE event_type = 'product_created') as created, COUNT(*) FILTER (WHERE event_type = 'product_updated') as updated, COUNT(*) FILTER (WHERE event_type = 'product_deleted') as deleted, COUNT(*) FILTER (WHERE event_type = 'product_viewed') as viewed FROM analytics_events WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'\"
      },
      \"database\": ${DATABASE_ID}
    },
    \"display\": \"scalar\",
    \"visualization_settings\": {},
    \"collection_id\": ${COLLECTION_ID}
  }" \
  | jq -r '.id')

echo "  ✓ Product Lifecycle Metrics (Numbers) - ID: ${QUESTION_4_ID}"

# 5. Create Dashboard
echo "📋 Creating dashboard..."
DASHBOARD_ID=$(curl -s -X POST \
  "${METABASE_URL}/api/dashboard" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Product Analytics Overview\",
    \"description\": \"Business analytics dashboard showing product events, user activity, and lifecycle metrics\",
    \"collection_id\": ${COLLECTION_ID}
  }" \
  | jq -r '.id')

echo "✅ Dashboard created (ID: ${DASHBOARD_ID})"

# 6. Add cards to dashboard
echo "🎨 Adding visualizations to dashboard..."

# Add Question 1 (Events by Type - Pie Chart)
curl -s -X POST \
  "${METABASE_URL}/api/dashboard/${DASHBOARD_ID}/cards" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"cardId\": ${QUESTION_1_ID},
    \"size_x\": 6,
    \"size_y\": 4,
    \"row\": 0,
    \"col\": 0
  }" > /dev/null

# Add Question 2 (Top Products - Table)
curl -s -X POST \
  "${METABASE_URL}/api/dashboard/${DASHBOARD_ID}/cards" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"cardId\": ${QUESTION_2_ID},
    \"size_x\": 6,
    \"size_y\": 4,
    \"row\": 0,
    \"col\": 6
  }" > /dev/null

# Add Question 3 (Timeline - Line Chart)
curl -s -X POST \
  "${METABASE_URL}/api/dashboard/${DASHBOARD_ID}/cards" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"cardId\": ${QUESTION_3_ID},
    \"size_x\": 12,
    \"size_y\": 4,
    \"row\": 4,
    \"col\": 0
  }" > /dev/null

# Add Question 4 (Lifecycle Metrics - Numbers)
curl -s -X POST \
  "${METABASE_URL}/api/dashboard/${DASHBOARD_ID}/cards" \
  -H "X-Metabase-Session: ${SESSION}" \
  -H "Content-Type: application/json" \
  -d "{
    \"cardId\": ${QUESTION_4_ID},
    \"size_x\": 12,
    \"size_y\": 2,
    \"row\": 8,
    \"col\": 0
  }" > /dev/null

echo "✅ Dashboard configured"

echo ""
echo "🎉 Metabase Analytics Dashboard setup complete!"
echo ""
echo "📊 Dashboard URL: ${METABASE_URL}/dashboard/${DASHBOARD_ID}"
echo "📁 Collection URL: ${METABASE_URL}/collection/${COLLECTION_ID}"
echo ""
echo "📝 Next steps:"
echo "  1. Visit ${METABASE_URL}"
echo "  2. Navigate to 'Product Analytics' collection"
echo "  3. Open 'Product Analytics Overview' dashboard"
echo "  4. Create some test data to see visualizations populate"
echo ""
