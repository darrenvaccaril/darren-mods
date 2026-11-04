export type Conso = {
  tokens?: number
  window: number
  percent?: number
  limits: { kind: string; percentUsed: number; resetsAt?: string }[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    conso: { last: Conso | null }
  }
}
