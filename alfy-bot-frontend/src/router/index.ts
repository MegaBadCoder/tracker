import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../api/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/goals/:id',
      name: 'goal',
      component: () => import('../views/GoalView.vue'),
    },
    {
      path: '/goals/:id/question/:questionId',
      name: 'questionReport',
      component: () => import('../views/QuestionReportView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const inWebApp = !!window.Telegram?.WebApp?.initData
  if (!to.meta.public && !isAuthenticated() && !inWebApp) {
    return { name: 'login' }
  }
})

export default router
