import { onUnmounted } from 'vue'
import { api } from '@/api/client'
import { getToken } from '@/api/tokenStorage'

export type SseHandler = (event: string, data: unknown) => void

const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

function parseSseBlock(block: string): { event: string, data: string } | null {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:'))
      event = line.slice(6).trim()
    else if (line.startsWith('data:'))
      data += line.slice(5).trim()
  }
  if (!data)
    return null
  return { event, data }
}

export function useSse(path: string, onEvent: SseHandler) {
  let abort: AbortController | null = null
  let retryMs = INITIAL_RETRY_MS
  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  async function readStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      if (stopped)
        break
      const { done, value } = await reader.read()
      if (done)
        break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const block of parts) {
        const parsed = parseSseBlock(block)
        if (!parsed)
          continue
        try {
          onEvent(parsed.event, JSON.parse(parsed.data))
        }
        catch {
          onEvent(parsed.event, parsed.data)
        }
      }
    }
  }

  async function connect() {
    const token = getToken()
    if (!token)
      return

    abort = new AbortController()
    const base = String(api.defaults.baseURL ?? '').replace(/\/$/, '')
    const res = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: abort.signal,
    })

    if (res.status === 401) {
      stopped = true
      return
    }
    if (!res.ok || !res.body)
      throw new Error(`SSE ${res.status}`)

    retryMs = INITIAL_RETRY_MS
    await readStream(res.body)
  }

  async function loop() {
    while (true) {
      if (stopped)
        return
      try {
        await connect()
      }
      catch (e) {
        if (stopped || (e instanceof DOMException && e.name === 'AbortError'))
          return
      }
      if (stopped)
        return
      await new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, retryMs)
      })
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
    }
  }

  loop()

  onUnmounted(() => {
    stopped = true
    if (retryTimer)
      clearTimeout(retryTimer)
    abort?.abort()
  })
}
