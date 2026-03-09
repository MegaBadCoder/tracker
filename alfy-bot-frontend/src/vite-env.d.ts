/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEV_TELEGRAM_ID: string
}

declare module '*.mp3' {
  const src: string
  export default src
}
