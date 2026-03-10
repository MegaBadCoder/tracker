interface NotificationData {
  id: string
  title: string
  body: string
  delay: number
  icon?: string
}

interface NotificationActionEvent {
  type: string
  action?: string
  notificationTag?: string
}

class NotificationService {
  private sw: ServiceWorkerRegistration | null = null
  private audio: HTMLAudioElement

  constructor() {
    this.audio = new Audio('/timer-bell.mp3')
    this.audio.volume = 0.7
    this.init()
  }

  async init(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        this.sw = registration
      } catch (error) {
        console.error('Ошибка регистрации Service Worker:', error)
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this))
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  async scheduleNotification(data: NotificationData): Promise<boolean> {
    const hasPermission = await this.requestPermission()
    if (!hasPermission) return false

    this.playSound()

    if (this.sw?.active) {
      this.sw.active.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        data
      })
      return true
    }
    return false
  }

  cancelNotification(id: string): void {
    if (this.sw?.active) {
      this.sw.active.postMessage({
        type: 'CANCEL_NOTIFICATION',
        data: { id }
      })
    }
  }

  private handleMessage(event: MessageEvent<NotificationActionEvent>): void {
    const { type, action, notificationTag } = event.data

    if (type === 'NOTIFICATION_ACTION') {
      window.dispatchEvent(
        new CustomEvent('timer-notification-action', {
          detail: { action, notificationTag }
        })
      )
    }
  }

  get isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator
  }

  get permission(): NotificationPermission {
    return Notification.permission
  }

  playSound(): void {
    try {
      this.audio.currentTime = 0
      this.audio.play().catch((error) => {
        console.warn('Не удалось воспроизвести аудио:', error)
      })
    } catch (error) {
      console.warn('Ошибка при воспроизведении аудио:', error)
    }
  }
}

export const notificationService = new NotificationService()
