/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.startsWith('/api'),
  new NetworkOnly(),
)

const navigationHandler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
  }),
)

const timers = new Map<string, ReturnType<typeof setTimeout>>()

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const payload = event.data as {
    type?: string
    data?: { id?: string; title?: string; body?: string; delay?: number; icon?: string }
  }
  if (!payload?.type) return

  if (payload.type === 'SCHEDULE_NOTIFICATION' && payload.data) {
    const { id, title, body, delay, icon } = payload.data
    if (!id || title === undefined || body === undefined || delay === undefined) return

    const existing = timers.get(id)
    if (existing) clearTimeout(existing)

    const handle = setTimeout(() => {
      timers.delete(id)
      void self.registration.showNotification(title, {
        body,
        tag: id,
        icon: icon || '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: { id },
        actions: [
          { action: 'open', title: 'Открыть' },
          { action: 'dismiss', title: 'Закрыть' },
        ],
      })
    }, delay)
    timers.set(id, handle)
  }

  if (payload.type === 'CANCEL_NOTIFICATION' && payload.data?.id) {
    const id = payload.data.id
    const t = timers.get(id)
    if (t) {
      clearTimeout(t)
      timers.delete(id)
    }
  }

  if (payload.type === 'TIMER_START' && payload.data) {
    const { id, expiresAt, phaseName } = payload.data as {
      id: string; expiresAt: number; phaseName: string
    }
    if (!id || !expiresAt) return

    const existing = timers.get(id)
    if (existing) clearTimeout(existing)

    const delay = Math.max(0, expiresAt - Date.now())
    const handle = setTimeout(async () => {
      timers.delete(id)
      void self.registration.showNotification(phaseName, {
        body: 'Время вышло!',
        tag: id,
        icon: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: { id },
        actions: [
          { action: 'open', title: 'Открыть' },
          { action: 'dismiss', title: 'Закрыть' },
        ],
      })
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.postMessage({ type: 'TIMER_PHASE_END', data: { id } })
      }
    }, delay)
    timers.set(id, handle)
  }

  if (payload.type === 'TIMER_PAUSE' && payload.data?.id) {
    const t = timers.get(payload.data.id)
    if (t) {
      clearTimeout(t)
      timers.delete(payload.data.id)
    }
  }

  if (payload.type === 'TIMER_STOP' && payload.data?.id) {
    const t = timers.get(payload.data.id)
    if (t) {
      clearTimeout(t)
      timers.delete(payload.data.id)
    }
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action || 'open'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action,
          notificationTag: event.notification.tag,
        })
      }
      if (action === 'open') {
        const focused = await self.clients.matchAll({ type: 'window' })
        if (focused[0]) {
          await focused[0].focus()
        }
      }
    })(),
  )
})

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? { title: 'Alfy', body: '' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: 'timer-push',
      actions: [
        { action: 'open', title: 'Открыть' },
        { action: 'dismiss', title: 'Закрыть' },
      ],
    }),
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
