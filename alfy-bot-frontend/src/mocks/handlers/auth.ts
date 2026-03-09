import { http, HttpResponse, delay } from 'msw'

export const authHandlers = [
  http.post('*/auth/telegram', async () => {
    await delay(100)
    return HttpResponse.json({
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({ sub: 123456789, telegramId: 123456789, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })) +
        '.mock-signature',
    })
  }),
]
