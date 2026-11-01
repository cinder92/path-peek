import { getInfo, type Info, type Run } from './info'
import { reveal } from './env'
import { pathLink } from './card'

const PATH_RE = '`?((?:~|\\.{1,2})?/?(?:[\\w.@+-]+/)+[\\w.@+-]+\\.[A-Za-z0-9]{1,6})`?'
const plain = (s: string) => s.replace(/\*\*|__/g, '').replace(/`/g, '')

type Seg = { t: string } | { raw: string; i: Info }
type Ctx = { ui: any; cols: number; toAbs: (p: string) => string; run: Run; uid: { n: number } }

// Parte una línea en texto y rutas existentes; vacío si no hay ninguna.
async function segment($: any, line: string, c: Ctx): Promise<Seg[]> {
  const segs: Seg[] = []
  let last = 0
  for (const m of line.matchAll(new RegExp(PATH_RE, 'g'))) {
    const i = await getInfo($, c.toAbs(m[1]), c.run)
    if (!i) continue
    const before = plain(line.slice(last, m.index))
    if (before) segs.push({ t: before })
    segs.push({ raw: m[1], i })
    last = m.index! + m[0].length
  }
  if (!segs.length) return []
  const tail = plain(line.slice(last))
  if (tail) segs.push({ t: tail })
  return segs
}

// Fila que envuelve palabra por palabra; se simula el ajuste para saber la columna de cada ruta.
function row($: any, segs: Seg[], c: Ctx) {
  const { Text } = c.ui
  const width = c.cols - 2
  let x = 0
  const parts: any[] = []
  for (const g of segs) {
    if ('t' in g) {
      for (const tok of g.t.match(/\S+\s*|\s+/g) ?? []) {
        if (x > 0 && x + tok.length > width) x = 0
        parts.push(<Text key={`t${c.uid.n++}`}>{tok}</Text>)
        x += tok.length
      }
      continue
    }
    if (x > 0 && x + g.raw.length > width) x = 0
    parts.push(pathLink({ ui: c.ui, i: g.i, raw: g.raw, col: x + 2, cols: c.cols, id: `${c.uid.n++}`, onOpen: () => void reveal($, g.i.abs) }))
    x += g.raw.length
  }
  return parts
}

// Texto del mensaje a bloques: Markdown normal, y filas propias en las líneas con ruta.
// Devuelve null si ninguna línea tiene una ruta existente.
export async function buildBlocks($: any, text: string, c: Ctx): Promise<any[] | null> {
  const { Box, Markdown } = c.ui
  const blocks: any[] = []
  let md: string[] = []
  let fence = false
  let any = false
  const flush = () => {
    if (md.length) blocks.push(<Markdown key={`m${c.uid.n++}`} text={md.join('\n')} />)
    md = []
  }
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) fence = !fence
    const segs = fence || line.trimStart().startsWith('```') ? [] : await segment($, line, c)
    if (!segs.length) { md.push(line); continue }
    any = true
    flush()
    blocks.push(<Box key={`r${c.uid.n++}`} flexDirection="row" flexWrap="wrap">{row($, segs, c)}</Box>)
  }
  flush()
  return any ? blocks : null
}
