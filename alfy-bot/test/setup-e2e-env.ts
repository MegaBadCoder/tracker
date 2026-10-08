// Telegram wiring is decided at AppModule *import* time (see `telegramImports`
// in src/app.module.ts), which runs before any beforeAll hook — so setting these
// inside createTestApp() is too late and telegraf launches against the real API.
// setupFiles runs before the test files are imported, which is early enough.
process.env.ENABLE_TELEGRAM = 'false';
process.env.BOT_TOKEN = 'test-bot-token';
process.env.JWT_SECRET = 'test-secret';

// EmailService reads SMTP_HOST/SMTP_USER/SMTP_PASS with getOrThrow in its
// constructor, so a missing key kills the whole Nest app at boot — every e2e
// suite fails with an unrelated "Configuration key does not exist". Same
// import-time reasoning as the Telegram vars above: this has to live here.
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_USER = 'e2e@test.local';
process.env.SMTP_PASS = 'test-password';
