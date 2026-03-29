import { getVapidKey, subscribePush } from '@/api/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function initPushSubscription(): Promise<void> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) return

  if (Notification.permission === 'denied') return

  try {
    const registration = await navigator.serviceWorker.ready

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await syncSubscription(existing)
      return
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
    }

    const vapidKey = await getVapidKey()

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    })

    await syncSubscription(subscription)
  } catch (err) {
    console.error('Push subscription failed:', err)
  }
}

async function syncSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

  await subscribePush({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  })
}
