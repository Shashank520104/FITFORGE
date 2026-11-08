#!/bin/sh
set -e

echo "=== Starting FITFORGE Backend Cluster on Render ==="

# 1. Run database migrations for all PostgreSQL-backed microservices
echo "--> Running database migrations..."
(cd services/auth-service && node dist/migrate.js) || echo "Auth migration finished or skipped"
(cd services/nutrition-service && node dist/migrate.js) || echo "Nutrition migration finished or skipped"
(cd services/progress-service && node dist/migrate.js) || echo "Progress migration finished or skipped"
(cd services/profile-service && node dist/migrate.js) || echo "Profile migration finished or skipped"
(cd services/personalization-service && node dist/migrate.js) || echo "Personalization migration finished or skipped"

# 2. Launch each microservice in the background on internal loopback ports
echo "--> Starting microservices on loopback ports..."
(cd services/auth-service && PORT=3002 node dist/index.js) &
(cd services/workout-service && PORT=3001 node dist/index.js) &
(cd services/nutrition-service && PORT=3004 node dist/index.js) &
(cd services/progress-service && PORT=3005 node dist/index.js) &
(cd services/profile-service && PORT=3006 node dist/index.js) &
(cd services/personalization-service && PORT=3007 node dist/index.js) &

# 3. Export internal loopback URLs for the API Gateway
export AUTH_SERVICE_URL="http://127.0.0.1:3002"
export WORKOUT_SERVICE_URL="http://127.0.0.1:3001"
export NUTRITION_SERVICE_URL="http://127.0.0.1:3004"
export PROGRESS_SERVICE_URL="http://127.0.0.1:3005"
export PROFILE_SERVICE_URL="http://127.0.0.1:3006"
export PERSONALIZATION_SERVICE_URL="http://127.0.0.1:3007"

# 4. Bind the API Gateway to Render's dynamically assigned $PORT
RENDER_PORT="${PORT:-10000}"
export PORT="$RENDER_PORT"

echo "--> Starting API Gateway on Render port $PORT..."
cd services/api-gateway
exec node dist/index.js
