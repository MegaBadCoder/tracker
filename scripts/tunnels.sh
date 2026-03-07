#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping existing tunnels..."
pkill -f "cloudflared tunnel --url http://localhost:5173" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:3002" 2>/dev/null || true
sleep 2

echo "Starting tunnel for frontend (5173)..."
cloudflared tunnel --url http://localhost:5173 2>/tmp/cf-5173.log &
sleep 6
FRONTEND_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf-5173.log | head -1)
rm -f /tmp/cf-5173.log

echo "Starting tunnel for backend (3002)..."
cloudflared tunnel --url http://localhost:3002 2>/tmp/cf-3002.log &
sleep 6
BACKEND_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf-3002.log | head -1)
rm -f /tmp/cf-3002.log

if [[ -z "$FRONTEND_URL" || -z "$BACKEND_URL" ]]; then
  echo "Error: failed to capture tunnel URLs"
  exit 1
fi

echo "Updating .env files..."
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s|WEBAPP_URL=.*|WEBAPP_URL=${FRONTEND_URL}/|" "$ROOT/alfy-bot/.env"
  sed -i '' "s|VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}|" "$ROOT/alfy-bot-frontend/.env"
else
  sed -i "s|WEBAPP_URL=.*|WEBAPP_URL=${FRONTEND_URL}/|" "$ROOT/alfy-bot/.env"
  sed -i "s|VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}|" "$ROOT/alfy-bot-frontend/.env"
fi

echo ""
echo "Done. Tunnels running:"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo ""
echo "Restart alfy-bot and alfy-bot-frontend to pick up new URLs."
