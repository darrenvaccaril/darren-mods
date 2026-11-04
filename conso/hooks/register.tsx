import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage } from 'claude-code'

import type { Conso } from '../types'

const last = atom({ plugin: 'conso', key: 'last' } as const, null)

const toConso = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Conso => ({
  tokens: u.context.tokens,
  window: u.context.window,
  percent: u.context.percent,
  limits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
  usd: u.cost?.usd,
})

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

const dans = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return ''
  const h = ms / 3600000
  if (h < 1) return ` (reset dans ${Math.max(1, Math.round(ms / 60000))} min)`
  if (h < 24) return ` (reset dans ${Math.round(h)} h)`
  return ` (reset dans ${Math.round(h / 24)} j)`
}

const couleur = (p: number) => (p >= 90 ? 'red' : p >= 70 ? 'yellow' : 'green')

const nom = (kind: string) =>
  kind === 'five_hour' ? '5 h' : kind === 'seven_day' ? 'Semaine' : kind === 'spend_limit' ? 'Budget' : kind

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    await update($, last, () => toConso(u))
    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, last, () => toConso(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await read($, last)
    if (e.props.hasSurvey || c === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const pct = c.percent ?? (c.tokens !== undefined && c.window ? Math.round((c.tokens / c.window) * 100) : undefined)

    return (
      <Box flexDirection="row" flexWrap="wrap" gap={2}>
        <Text>
          <Text dimColor>Contexte </Text>
          <Text color={couleur(pct ?? 0)}>
            {c.tokens !== undefined ? `${k(c.tokens)} / ${k(c.window)}` : `– / ${k(c.window)}`}
            {pct !== undefined ? ` (${pct} %)` : ''}
          </Text>
        </Text>
        {c.limits.map(l => (
          <Text key={l.kind}>
            <Text dimColor>{nom(l.kind)} </Text>
            <Text color={couleur(l.percentUsed)}>{`${l.percentUsed} %`}</Text>
            <Text dimColor>{dans(l.resetsAt, now)}</Text>
          </Text>
        ))}
        {c.usd !== undefined ? (
          <Text>
            <Text dimColor>Coût </Text>
            <Text>{`${c.usd.toFixed(2).replace('.', ',')} $`}</Text>
          </Text>
        ) : null}
      </Box>
    )
  })
}
