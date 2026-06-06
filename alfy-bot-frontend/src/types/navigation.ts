import type { Component } from 'vue'

export interface NavLink {
  to: string
  label: string
  icon: Component
  /** Опциональный бейдж справа от пункта, напр. "скоро" для разделов в разработке. */
  badge?: string
}
