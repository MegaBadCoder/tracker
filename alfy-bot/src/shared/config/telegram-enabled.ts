/** When false, Telegraf and bot handlers are not loaded (REST/WebApp still work). */
export function isTelegramEnabled(): boolean {
  const raw = process.env.ENABLE_TELEGRAM?.trim();
  if (raw === undefined || raw === '') return true;
  return !/^(false|0|no|off)$/i.test(raw);
}
