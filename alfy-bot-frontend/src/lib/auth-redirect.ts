const LOCAL_APP_PATH = /^\/(?:tasks|habits|goals|questions|settings)(?:\/|$)/

/** Проверяет локальный адрес возврата после входа; небезопасные адреса заменяет главной страницей. */
export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return '/'
  try {
    const decoded = decodeURIComponent(value)
    if (Array.from(decoded).some(char => char === '\\' || char.charCodeAt(0) <= 32) || decoded.startsWith('//'))
      return '/'
    const url = new URL(value, 'https://alfy.local')
    if (url.origin !== 'https://alfy.local')
      return '/'
    if (!LOCAL_APP_PATH.test(url.pathname))
      return '/'
    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return '/'
  }
}
