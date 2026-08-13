// Telegram wiring is decided at AppModule *import* time (see `telegramImports`
// in src/app.module.ts), which runs before any beforeAll hook — so setting these
// inside createTestApp() is too late and telegraf launches against the real API.
// setupFiles runs before the test files are imported, which is early enough.
process.env.ENABLE_TELEGRAM = 'false';
process.env.BOT_TOKEN = 'test-bot-token';
process.env.JWT_SECRET = 'test-secret';
