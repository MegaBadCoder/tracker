import { api } from './client'

export async function getVapidKey(): Promise<string> {
  const { data } = await api.get('/push/vapid-key')
  return data.key
}

export async function subscribePush(subscription: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<void> {
  await api.post('/push/subscribe', subscription)
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.delete('/push/subscribe', { data: { endpoint } })
}
