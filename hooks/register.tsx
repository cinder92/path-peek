import type { Register } from 'claude-code'
import { getHome } from './lib/env'
import { warnIfNoFfmpeg } from './lib/bins'
import { buildBlocks } from './lib/message'
import type { Run } from './lib/info'

const MAX_NEW_PREVIEWS = 8 // conversiones nuevas por mensaje
let refreshPending = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    void warnIfNoFfmpeg($)
    return next(e)
  })

  // Al terminar la respuesta (miniaturas ya en caché) se repinta dos veces para
  // que el terminal registre el hover de los enlaces nuevos sin esperar un clic.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    $.clock.after(250, () => $.ui.invalidate('ui.render'))
    $.clock.after(900, () => $.ui.invalidate('ui.render'))
    return r
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    try {
      const ui = $.ui.resolve(e)
      const homeDir = await getHome($)
      const cwd = $.session.cwd()
      const toAbs = (p: string) => (p.startsWith('/') ? p : p.startsWith('~/') ? homeDir + p.slice(1) : `${cwd}/${p}`)
      const run: Run = { budget: MAX_NEW_PREVIEWS, fresh: false }
      // Las claves (key) deben ser únicas en todo el árbol: contador compartido.
      const ctx = { ui, cols: e.viewport?.columns ?? 100, toAbs, run, uid: { n: 0 } }
      const blocks = await buildBlocks($, e.props.text, ctx)
      if (!blocks) return next(e)
      // Con trabajo nuevo, un segundo dibujado (ya con caché) activa el hover.
      if (run.fresh && !refreshPending) {
        refreshPending = true
        $.clock.after(350, () => { refreshPending = false; $.ui.invalidate('ui.render') })
      }
      const { Box, Text } = ui
      return (
        <Box flexDirection="row">
          <Text>{e.props.isFirstOfReply ? '● ' : '  '}</Text>
          <Box flexDirection="column">{blocks}</Box>
        </Box>
      )
    } catch (err) {
      $.ui.log(`path-peek: ${String(err)}`, { to: 'debug' })
      return next(e)
    }
  })
}
