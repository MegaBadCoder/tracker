/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEV_TELEGRAM_ID: string
  readonly VITE_DEV_USE_WIDGET: string
  readonly VITE_BOT_USERNAME: string
}

declare module '*.mp3' {
  const src: string
  export default src
}
