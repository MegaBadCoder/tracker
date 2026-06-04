import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation-store'
import { useQuestionTypesStore } from '@/stores/question-types-store'
import { isAuthenticated } from '../api/tokenStorage'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../components/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'habits',
          name: 'habits',
          component: () => import('../views/HabitsView.vue'),
        },
        {
          path: 'tasks',
          component: () => import('../views/TasksLayout.vue'),
          meta: { sectionNav: 'tasks' },
          children: [
            {
              path: '',
              name: 'tasks',
              component: () => import('../views/TasksView.vue'),
            },
            {
              path: 'calendar',
              name: 'tasks-calendar',
              component: () => import('../views/CalendarView.vue'),
            },
            {
              path: 'project/:projectId',
              name: 'tasks-project',
              component: () => import('../views/ProjectView.vue'),
            },
          ],
        },
        {
          path: 'goals/new',
          name: 'goal-create',
          component: () => import('../views/GoalCreateView.vue'),
        },
        {
          path: 'goals/report-today',
          name: 'goalsReportToday',
          component: () => import('../views/GoalsReportFlowView.vue'),
        },
        {
          path: 'goals/:id',
          name: 'goal',
          component: () => import('../views/GoalView.vue'),
        },
        {
          path: 'goals/:id/report',
          name: 'goalReport',
          component: () => import('../views/GoalReportView.vue'),
        },
        {
          path: 'questions/:id',
          name: 'questionReport',
          component: () => import('../views/QuestionReportView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue'),
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('../views/NotFoundView.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('../views/VerifyEmailView.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach((to, from) => {
  if (!to.meta.public && !isAuthenticated()) {
    return { name: 'login' }
  }
  // Гарантируем загрузку справочника типов вопросов на ЛЮБОМ входе в
  // авторизованную часть (cold boot с токеном, свежий логин через LoginView,
  // навигация). Стор идемпотентен — фактический fetch один раз. Не зависим от
  // пути входа (main.ts грузит только при наличии токена на старте).
  if (!to.meta.public && isAuthenticated()) {
    useQuestionTypesStore().load().catch(() => {})
  }
  if (from === START_LOCATION && to.path === '/') {
    const last = useNavigationStore().lastSection
    if (last && last !== '/')
      return { path: last }
  }
})

router.afterEach((to) => {
  if (to.meta.public)
    return
  useNavigationStore().rememberSection(to.path)
})

export default router
