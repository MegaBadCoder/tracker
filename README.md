# Alfy

## Cloudflare туннели (dev)

Для тестирования Telegram WebApp нужны публичные URL фронта (5173) и бэкенда (3002). Используется Cloudflare Quick Tunnels.

### Запуск туннелей

```bash
./scripts/tunnels.sh
```

Скрипт:
1. Останавливает старые туннели на 5173 и 3002
2. Запускает новые туннели
3. Обновляет `alfy-bot/.env` (WEBAPP_URL) и `alfy-bot-frontend/.env` (VITE_API_URL)

Перед запуском должны быть запущены Vite (5173) и бэкенд (3002). После выполнения перезапусти бота и фронт.

### Остановка туннелей

```bash
# Остановить все cloudflared
pkill cloudflared

# Или только туннели для 5173 и 3002
pkill -f "cloudflared tunnel --url http://localhost:5173"
pkill -f "cloudflared tunnel --url http://localhost:3002"
```

### Требования

- `cloudflared` в PATH ([установка](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation))
