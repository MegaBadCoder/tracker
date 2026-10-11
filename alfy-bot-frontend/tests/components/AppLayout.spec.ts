import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

// Мокаем AppSidebar целиком, чтобы не тянуть UserSection/useTheme (localStorage на module-load).
// Стаб отражает open-проп и список секционных ссылок, эмитит open.
vi.mock('@/components/AppSidebar.vue', () => ({
  default: {
    name: 'AppSidebar',
    props: ['open', 'links', 'desktopCollapsed'],
    emits: ['open', 'close', 'collapse'],
    template: `
      <div data-testid="sb" :data-open="String(open)" :data-collapsed="String(desktopCollapsed)">
        <span v-for="l in links" :key="l.to" class="lnk">{{ l.label }}</span>
        <button data-testid="collapse" @click="$emit('collapse')">collapse</button>
        <button data-testid="open" @click="$emit('open')">open</button>
      </div>
    `,
  },
}))

afterEach(() => vi.restoreAllMocks())

const AppLayout = (await import('@/components/AppLayout.vue')).default

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tasks', component: { template: '<div />' }, meta: { sectionNav: 'tasks' } },
      { path: '/tasks/calendar', component: { template: '<div />' }, meta: { sectionNav: 'tasks' } },
      { path: '/habits', component: { template: '<div />' }, meta: { sectionNav: 'habits' } },
      { path: '/habits/atomic', component: { template: '<div />' }, meta: { sectionNav: 'habits' } },
    ],
  })
}

async function mountAt(path: string) {
  const router = makeRouter()
  router.push(path)
  await router.isReady()
  const wrapper = mount(AppLayout, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('appLayout — секция привычек', () => {
  it('на /habits показывает секционную под-навигацию с двумя пунктами', async () => {
    const { wrapper } = await mountAt('/habits')
    const labels = wrapper.findAll('.lnk').map((n) => n.text())
    expect(labels).toContain('Привычки по целям')
    expect(labels).toContain('Атомные привычки')
  })
})

describe('appLayout — мобильное сворачивание sidebar', () => {
  it('закрывает sidebar после перехода по разделу (регрессия)', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    const { wrapper, router } = await mountAt('/')
    // открыли sidebar (как по тапу на меню)
    await wrapper.find('[data-testid="open"]').trigger('click')
    expect(wrapper.find('[data-testid="sb"]').attributes('data-open')).toBe('true')

    // переход по разделу должен свернуть sidebar
    await router.push('/habits')
    await flushPromises()
    expect(wrapper.find('[data-testid="sb"]').attributes('data-open')).toBe('false')
  })
})


it('скрывает desktop sidebar между страницами задач и восстанавливает кнопкой открытия', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  const { wrapper, router } = await mountAt('/tasks')
  await wrapper.get('[data-testid="collapse"]').trigger('click')
  expect(wrapper.get('[data-testid="sb"]').attributes('data-collapsed')).toBe('true')
  await router.push('/tasks/calendar')
  await flushPromises()
  expect(wrapper.get('[data-testid="sb"]').attributes('data-collapsed')).toBe('true')
  await wrapper.get('[data-testid="open"]').trigger('click')
  expect(wrapper.get('[data-testid="sb"]').attributes('data-collapsed')).toBe('false')
  expect(wrapper.get('[data-testid="sb"]').attributes('data-open')).toBe('false')
  wrapper.unmount()
})
