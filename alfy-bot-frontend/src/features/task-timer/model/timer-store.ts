import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { TimerSettings, TimerSession, PhaseInfo, SessionState, Task } from '../types'
import { useSounds } from '@/composables/useSounds'

const DEFAULT_SETTINGS = (): TimerSettings => ({
  pomodoroTime: 25,
  breakTime: 5,
  longBreakTime: 15,
  longBreakInterval: 4,
  countPomodoro: 10,
  taskId: null
})

export const useTimerStore = defineStore('timer', () => {
  const currentSettings: Ref<TimerSettings> = ref(DEFAULT_SETTINGS())
  const isActive = ref(false)
  const phase = ref(0)
  const timeBlock = ref(0)
  const namePhase = ref('')
  const timerInterval: Ref<ReturnType<typeof setInterval> | null> = ref(null)
  const { play: playSound } = useSounds()

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

    timerInterval.value = setInterval(() => {
      if (timeBlock.value <= 0) {
        stopTimeBlock(true)
      } else {
        timeBlock.value--
        updateTitle()
      }
    }, 1000)
  }

  function pauseTimer(): void {
    isActive.value = false
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }
    syncToBackend()
  }

  function stopTimeBlock(shouldPlaySound = false): void {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    isActive.value = false

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

  const onPomodoroIncrement = ref<((taskId: string, increment: number) => void) | null>(null)

  function incrementPomodoro(): void {
    const taskId = currentSettings.value.taskId
    if (!taskId) return

    const phaseTime = getPhaseInfo(phase.value).time
    const elapsed = phaseTime - timeBlock.value
    const fraction = Math.round((elapsed / phaseTime) * 100) / 100

    if (fraction <= 0) return

    onPomodoroIncrement.value?.(taskId, fraction)
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
    try {
      const { data: session } = await api.get('/tasks/timer')
      if (!session) return

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
    startTimer()
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

  async function resetToInitialState(): Promise<void> {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    isActive.value = false
    phase.value = 0
    timeBlock.value = 0
    namePhase.value = ''

    try {
      await api.delete('/tasks/timer')
    } catch (err) {
      console.error('Ошибка деактивации таймера:', err)
    }

    updateTitle()
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
  }

  const isBreakPhase = computed(() => checkPhase.isBreakPhase(phase.value))

  return {
    isActive,
    phase,
    timeBlock,
    namePhase,
    timerInterval,
    onPomodoroIncrement,
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
    checkPhase
  }
})
