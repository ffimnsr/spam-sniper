/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIDDEN_ADMIN_PATH: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
