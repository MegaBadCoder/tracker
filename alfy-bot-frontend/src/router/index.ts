import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../api/auth'

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
          path: 'goals/:id',
          name: 'goal',
          component: () => import('../views/GoalView.vue'),
        },
        {
          path: 'questions/:id',
          name: 'questionReport',
          component: () => import('../views/QuestionReportView.vue'),
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
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !isAuthenticated()) {
    return { name: 'login' }
  }
})

export default router
