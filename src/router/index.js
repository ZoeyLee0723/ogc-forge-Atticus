import { createRouter, createWebHistory } from 'vue-router'
import OgcLab from '../views/OgcLab.vue'

const routes = [
  {
    path: '/',
    name: 'OgcLab',
    component: OgcLab,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
