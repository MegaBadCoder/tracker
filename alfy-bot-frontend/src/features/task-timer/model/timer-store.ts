import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import { useTaskStore } from '@/features/tasks/model/task-store'
import type { TimerSettings, TimerSession, PhaseInfo, SessionState, Task, TimerSWMessage } from '../types'
import { useSounds } from '@/composables/useSounds'

const DEFAULT_SETTINGS = (): TimerSettings => ({
  pomodoroTime: 25,
  breakTime: 5,
  longBreakTime: 15,
  longBreakInterval: 4,
  countPomodoro: 10,
  taskId: null
})

function sendToSW(message: TimerSWMessage): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage(message)
  })
}

export const useTimerStore = defineStore('timer', () => {
  const currentSettings: Ref<TimerSettings> = ref(DEFAULT_SETTINGS())
  const isActive = ref(false)
  const phase = ref(0)
  const timeBlock = ref(0)
  const namePhase = ref('')
  const expiresAt: Ref<number | null> = ref(null)
  const timerInterval: Ref<ReturnType<typeof setInterval> | null> = ref(null)
  const { play: playSound } = useSounds()
  let swListenerRegistered = false
  let sseMutedUntil = 0

  function muteRemoteRestore(ms = 1500): void {
    sseMutedUntil = Date.now() + ms
  }

  const checkPhase = {
    isWorkPhase: (phaseNumber: number): boolean => phaseNumber % 2 === 1,
    isBreakPhase: (phaseNumber: number): boolean => phaseNumber % 2 === 0,
    isLongBreakPhase: (phaseNumber: number): boolean => {
      if (phaseNumber % 2 !== 0) return false
      const pomodoroNumber = phaseNumber / 2
      return pomodoroNumber % currentSettings.value.longBreakInterval === 0
    },
    isShortBreakPhase: (phaseNumber: number): boolean => {
      if (phaseNumber % 2 !== 0) return false
      const pomodoroNumber = phaseNumber / 2
      return pomodoroNumber % currentSettings.value.longBreakInterval !== 0
    }
  }

  function initSession(settings: TimerSettings): void {
    phase.value = 0
    currentSettings.value = settings
  }

  function nextPhase(number?: number): void {
    if (number) {
      phase.value = number
    } else {
      phase.value++
    }

    const phaseInfo = getPhaseInfo(phase.value)
    timeBlock.value = phaseInfo.time
    namePhase.value = phaseInfo.name
    updateTitle()
  }

  function getPhaseInfo(phaseNumber: number): PhaseInfo {
    if (checkPhase.isWorkPhase(phaseNumber)) {
      return {
        time: calculateSeconds(currentSettings.value.pomodoroTime),
        name: 'Работа'
      }
    }

    if (checkPhase.isLongBreakPhase(phaseNumber)) {
      return {
        time: calculateSeconds(currentSettings.value.longBreakTime),
        name: 'Большой перерыв'
      }
    }

    return {
      time: calculateSeconds(currentSettings.value.breakTime),
      name: 'Короткий перерыв'
    }
  }

  function startTimer(): void {
    if (isActive.value) return

    isActive.value = true
    expiresAt.value = Date.now() + timeBlock.value * 1000

    registerSWListener()
    requestNotificationPermission()

    const timerId = currentSettings.value.taskId || 'pomodoro'
    sendToSW({
      type: 'TIMER_START',
      data: { id: timerId, expiresAt: expiresAt.value, phaseName: namePhase.value },
    })

    timerInterval.value = setInterval(() => {
      if (!expiresAt.value) return
      const remaining = Math.ceil((expiresAt.value - Date.now()) / 1000)
      if (remaining <= 0) {
        stopTimeBlock(true)
      } else {
        timeBlock.value = remaining
        updateTitle()
      }
    }, 1000)
  }

  function pauseTimer(): void {
    if (expiresAt.value) {
      timeBlock.value = Math.max(0, Math.ceil((expiresAt.value - Date.now()) / 1000))
    }
    expiresAt.value = null
    isActive.value = false

    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    const timerId = currentSettings.value.taskId || 'pomodoro'
    sendToSW({ type: 'TIMER_PAUSE', data: { id: timerId } })

    syncToBackend()
  }

  function stopTimeBlock(shouldPlaySound = false): void {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    isActive.value = false
    expiresAt.value = null

    const timerId = currentSettings.value.taskId || 'pomodoro'
    sendToSW({ type: 'TIMER_STOP', data: { id: timerId } })

    if (shouldPlaySound) {
      const isWorkEnd = checkPhase.isWorkPhase(phase.value)
      playSound(isWorkEnd ? 'timer_end' : 'break_end')
    }

    if (checkPhase.isWorkPhase(phase.value)) {
      incrementPomodoro()
    }

    nextPhase()
    syncToBackend()
  }

  async function incrementPomodoro(): Promise<void> {
    const taskId = currentSettings.value.taskId
    if (!taskId) return

    const phaseTime = getPhaseInfo(phase.value).time
    const elapsed = phaseTime - timeBlock.value
    const fraction = Math.round((elapsed / phaseTime) * 100) / 100

    if (fraction <= 0) return

    // Delegated so the store applies the response — the backend may auto-complete
    // the task once its pomodoro target is reached. Error handling lives there.
    await useTaskStore().incrementPomodoro(taskId, fraction)
  }

  function calculateSeconds(minutes: number): number {
    return minutes * 60
  }

  function updateTitle(): void {
    if (namePhase.value && timeBlock.value > 0) {
      const formattedTime = formatTime(timeBlock.value)
      document.title = `${formattedTime} - ${namePhase.value} | Pomodoro`
    } else {
      document.title = 'Pomodoro'
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  function isStartTimeBlock(): boolean {
    return timeBlock.value === getPhaseInfo(phase.value).time
  }

  // --- Backend sync ---

  async function syncToBackend(): Promise<void> {
    const taskId = currentSettings.value.taskId
    if (!taskId) return

    muteRemoteRestore()

    try {
      if (isActive.value) {
        const expiresAt = new Date(Date.now() + timeBlock.value * 1000).toISOString()
        await api.put('/tasks/timer', {
          taskId,
          phase: phase.value,
          lastStartTime: Date.now(),
          countTimeAfterPause: null,
          expiresAt,
          isActive: true,
        })
      } else {
        await api.put('/tasks/timer', {
          taskId,
          phase: phase.value,
          lastStartTime: null,
          countTimeAfterPause: timeBlock.value,
          expiresAt: null,
          isActive: false,
        })
      }
    } catch (err) {
      console.error('Ошибка синхронизации таймера:', err)
    }
  }

  async function restoreSession(): Promise<void> {
    registerSWListener()

    if (Date.now() < sseMutedUntil) return

    try {
      const { data: session } = await api.get('/tasks/timer')
      if (!session) {
        clearLocalSession()
        return
      }

      if (session.task?.pomodoroConfig) {
        const cfg = session.task.pomodoroConfig
        currentSettings.value = {
          pomodoroTime: cfg.pomodoroDuration,
          breakTime: cfg.shortBreak,
          longBreakTime: cfg.longBreak,
          longBreakInterval: cfg.longBreakInterval,
          countPomodoro: cfg.pomodoroCount,
          taskId: session.taskId,
        }
      }

      stopLocalTicker()

      const sessionState = determineSessionState(session)

      switch (sessionState.type) {
        case 'PAUSED':
          restorePausedSession(session)
          break
        case 'ACTIVE':
          restoreActiveSession(session)
          break
        case 'EXPIRED':
          restoreExpiredSession(session)
          break
      }
    } catch (err) {
      console.error('Ошибка восстановления сессии:', err)
    }
  }

  function determineSessionState(session: TimerSession): SessionState {
    if (session.countTimeAfterPause !== null) {
      return { type: 'PAUSED' }
    }

    if (session.lastStartTime) {
      const elapsed = Math.floor((Date.now() - session.lastStartTime) / 1000)
      const phaseTime = getPhaseInfo(session.phase).time

      return elapsed < phaseTime
        ? { type: 'ACTIVE', remainingTime: phaseTime - elapsed }
        : { type: 'EXPIRED' }
    }

    return { type: 'INVALID' }
  }

  function restorePausedSession(session: TimerSession): void {
    if (session.countTimeAfterPause !== null) {
      timeBlock.value = session.countTimeAfterPause
      phase.value = session.phase
      namePhase.value = getPhaseInfo(phase.value).name
      updateTitle()
    }
  }

  function restoreActiveSession(session: TimerSession): void {
    if (!session.lastStartTime) return

    const phaseTime = getPhaseInfo(session.phase).time
    const elapsedTime = Math.floor((Date.now() - session.lastStartTime) / 1000)
    const remainingTime = phaseTime - elapsedTime

    phase.value = session.phase
    namePhase.value = getPhaseInfo(session.phase).name
    timeBlock.value = remainingTime
    updateTitle()
    startTimer() // sets expiresAt and arms SW
  }

  function restoreExpiredSession(session: TimerSession): void {
    phase.value = session.phase
    namePhase.value = getPhaseInfo(session.phase).name
    nextPhase()
  }

  function toggleTimer(): void {
    if (isActive.value) {
      pauseTimer()
    } else {
      startTimer()
      syncToBackend()
    }
  }

  function stopLocalTicker(): void {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    const timerId = currentSettings.value.taskId || 'pomodoro'
    sendToSW({ type: 'TIMER_STOP', data: { id: timerId } })
    isActive.value = false
    expiresAt.value = null
  }

  function clearLocalSession(): void {
    stopLocalTicker()
    phase.value = 0
    timeBlock.value = 0
    namePhase.value = ''
    updateTitle()
  }

  async function resetToInitialState(): Promise<void> {
    muteRemoteRestore()
    clearLocalSession()

    try {
      await api.delete('/tasks/timer')
    } catch (err) {
      console.error('Ошибка деактивации таймера:', err)
    }
  }

  function startTask(task: Task): void {
    resetToInitialState()

    initSession({
      pomodoroTime: task.pomodoroTime,
      breakTime: task.breakTime,
      longBreakTime: task.longBreakTime,
      longBreakInterval: task.longBreakInterval,
      countPomodoro: task.pomodoroCount,
      taskId: task.id
    })

    nextPhase()
    startTimer()
    syncToBackend()
  }

  function registerSWListener(): void {
    if (swListenerRegistered || !('serviceWorker' in navigator)) return
    swListenerRegistered = true

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TIMER_PHASE_END' && phase.value > 0 && isActive.value) {
        stopTimeBlock(true)
      }
    })
  }

  function ensureSWTimer(): void {
    if (!isActive.value || !expiresAt.value) return
    const timerId = currentSettings.value.taskId || 'pomodoro'
    sendToSW({
      type: 'TIMER_START',
      data: { id: timerId, expiresAt: expiresAt.value, phaseName: namePhase.value },
    })
  }

  function recalcTimeBlock(): void {
    if (!expiresAt.value) return
    const remaining = Math.ceil((expiresAt.value - Date.now()) / 1000)
    if (remaining <= 0) {
      stopTimeBlock(true)
    } else {
      timeBlock.value = remaining
      updateTitle()
    }
  }

  function requestNotificationPermission(): void {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const isBreakPhase = computed(() => checkPhase.isBreakPhase(phase.value))

  /** Which task the session belongs to — lets callers tell "running" from "running on something else". */
  const activeTaskId = computed(() => currentSettings.value.taskId)

  return {
    isActive,
    activeTaskId,
    phase,
    timeBlock,
    namePhase,
    timerInterval,
    startTimer,
    pauseTimer,
    nextPhase,
    getPhaseInfo,
    initSession,
    resetToInitialState,
    stopTimeBlock,
    restoreSession,
    isStartTimeBlock,
    syncToBackend,
    toggleTimer,
    startTask,
    formatTime,
    isBreakPhase,
    checkPhase,
    ensureSWTimer,
    recalcTimeBlock,
  }
})
