/**
 * Текст ошибки для показа пользователю: сообщение сервера
 * (`response.data.message`, массив склеивается через «; »), иначе `message`
 * самой ошибки, иначе `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message
  if (typeof serverMessage === 'string' && serverMessage.length > 0)
    return serverMessage
  if (Array.isArray(serverMessage) && serverMessage.length > 0)
    return serverMessage.join('; ')
  if (err instanceof Error && err.message.length > 0)
    return err.message
  return fallback
}
