import type { Register } from 'claude-code'

const VID = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv)$/i
const IMG = /\.(png|jpe?g|gif|webp|bmp|heic|avif|tiff?)$/i
// Nunca se previsualiza el contenido de archivos que suelen guardar secretos.
const SECRET = /(^|\/)(\.env[^/]*|id_[a-z0-9]+|[^/]*\.(pem|key|p12|pfx|keystore)|credentials[^/]*|\.netrc|\.npmrc)$/i
const PATH_RE = '`?((?:~|\\.{1,2})?/?(?:[\\w.@+-]+/)+[\\w.@+-]+\\.[A-Za-z0-9]{1,6})`?'

const MAX_COLS = 48
const MAX_ROWS = 10
const MAX_NEW_PREVIEWS = 8 // conversiones nuevas por mensaje
const CACHE_MAX = 200

type Info = { why?: string; abs: string; size: number; mtime: number; png?: string; pw?: number; ph?: number; text?: string }
const cache = new Map<string, Info>()
let osName: string | undefined
let home: string | undefined
let tmp: string | undefined
let lastWhy = ''
let refreshPending = false

const getOs = async ($: any) => {
  if (!osName) {
    const p = await $.process.run(['uname', '-s']).catch(() => undefined)
    osName = p?.exitCode === 0 ? p.stdout.trim() : 'Windows'
  }
  return osName
}

const getHome = async ($: any) => {
  if (home === undefined) {
    const p = await $.process.run(['sh', '-c', 'printf %s "$HOME"']).catch(() => undefined)
    home = p?.exitCode === 0 ? p.stdout : ''
  }
  return home
}

// Carpeta temporal propia (mktemp: nombre impredecible, sin pisar enlaces ajenos).
const getTmp = async ($: any) => {
  if (!tmp) {
    const p = await $.process.run(['mktemp', '-d']).catch(() => undefined)
    tmp = p?.exitCode === 0 ? p.stdout.trim() : undefined
  }
  return tmp
}

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const reveal = async ($: any, path: string) => {
  const os = await getOs($)
  if (os === 'Darwin') return $.process.run(['open', '-R', path])
  if (os === 'Linux') return $.process.run(['xdg-open', path.slice(0, Math.max(path.lastIndexOf('/'), 1))])
  return $.process.run(['explorer', `/select,${path.replaceAll('/', '\\')}`])
}

const readPng = async ($: any, file: string): Promise<string | undefined> => {
  const st = await $.fs.stat(file).catch(() => undefined)
  if (!st || st.size > 1_800_000) return undefined
  return (await $.fs.read(file, { as: 'bytes' }).catch(() => undefined))?.base64
}

// Imagen o video a PNG chico (<= 600 px) para el preview.
const makePng = async ($: any, abs: string, isVideo: boolean): Promise<string | undefined> => {
  if (!isVideo && /\.png$/i.test(abs)) {
    const direct = await readPng($, abs)
    if (direct) return direct
  }
  const dir = await getTmp($)
  if (!dir) { lastWhy = 'mktemp falló'; return undefined }
  const out = `${dir}/${hash(abs)}.png`
  const os = await getOs($)
  const BIN: Record<string, string[]> = {
    ffmpeg: ['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'],
    convert: ['convert', '/opt/homebrew/bin/convert', '/usr/local/bin/convert', '/usr/bin/convert'],
  }
  const run = async (argv: string[]) => {
    for (const bin of BIN[argv[0]] ?? [argv[0]]) {
      const r = await $.process.run([bin, ...argv.slice(1)], { timeoutMs: 15000 }).catch(() => undefined)
      if (r) return r
    }
    return undefined
  }
  let r: any
  if (isVideo) {
    r = await run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1', '-i', abs, '-frames:v', '1', '-vf', 'scale=600:-2', out])
    if (r?.exitCode !== 0 || !(await $.fs.exists(out)))
      r = await run(['ffmpeg', '-y', '-loglevel', 'error', '-i', abs, '-frames:v', '1', '-vf', 'scale=600:-2', out])
  } else if (os === 'Darwin') {
    r = await run(['sips', '-Z', '600', '-s', 'format', 'png', abs, '--out', out])
  } else {
    r = await run(['convert', `${abs}[0]`, '-resize', '600x600>', out])
    if (r?.exitCode !== 0) r = await run(['ffmpeg', '-y', '-loglevel', 'error', '-i', abs, '-frames:v', '1', '-vf', 'scale=600:-2', out])
  }
  if (r?.exitCode !== 0) { lastWhy = r ? `exit ${r.exitCode}: ${String(r.stderr).trim().slice(-120)}` : 'no se pudo ejecutar ffmpeg/convert'; return undefined }
  const b = await readPng($, out)
  if (!b) lastWhy = `no se pudo leer ${out}`
  return b
}

const pngSize = (b64: string): { w: number; h: number } | undefined => {
  try {
    const b = Uint8Array.fromBase64(b64.slice(0, 32))
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0
    return w > 0 && h > 0 ? { w, h } : undefined
  } catch {
    return undefined
  }
}

export const register: Register = on => {
  // Al terminar la respuesta (ya con miniaturas en caché) se repinta dos veces
  // para que el terminal registre el hover de los enlaces nuevos sin clic.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    $.clock.after(250, () => $.ui.invalidate('ui.render'))
    $.clock.after(900, () => $.ui.invalidate('ui.render'))
    return r
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    try {
      const { Box, Text, Button, Image, Markdown } = $.ui.resolve(e)
      const cols = e.viewport?.columns ?? 100
      const cwd = $.session.cwd()
      const homeDir = await getHome($)
      const toAbs = (p: string) => (p.startsWith('/') ? p : p.startsWith('~/') ? homeDir + p.slice(1) : `${cwd}/${p}`)
      let budget = MAX_NEW_PREVIEWS
      let isFresh = false // hubo trabajo nuevo (miniaturas) en este dibujado

      const info = async (raw: string): Promise<Info | null> => {
        const abs = toAbs(raw)
        const st = await $.fs.stat(abs).catch(() => undefined)
        if (!st || st.kind !== 'file') return null
        const hit = cache.get(abs)
        if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit
        isFresh = true
        const r: Info = { abs, size: st.size, mtime: st.mtimeMs }
        const isVideo = VID.test(abs)
        if ((IMG.test(abs) || isVideo) && budget-- > 0) {
          lastWhy = ''
          r.png = await makePng($, abs, isVideo)
          if (!r.png) r.why = lastWhy || 'sin motivo'
          const d = r.png ? pngSize(r.png) : undefined
          if (d) { r.pw = d.w; r.ph = d.h }
        } else if (!IMG.test(abs) && !isVideo && st.size < 200_000 && !SECRET.test(abs)) {
          const t = await $.fs.read(abs).catch(() => undefined)
          if (typeof t === 'string' && !t.includes('\u0000'))
            r.text = t.split('\n').slice(0, 10).map(l => l.replaceAll('\t', '  ').slice(0, 90)).join('\n')
        }
        const failed = (IMG.test(abs) || isVideo) && !r.png
        if (!failed) {
          cache.delete(abs)
          cache.set(abs, r)
          if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
        }
        return r
      }

      const lines = e.props.text.split('\n')
      const blocks: any[] = []
      let md: string[] = []
      let fence = false
      let any = false
      let uid = 0 // las claves deben ser únicas en todo el árbol
      const flush = () => {
        if (md.length) blocks.push(<Markdown key={`m${uid++}`} text={md.join('\n')} />)
        md = []
      }

      for (const line of lines) {
        const isFence = line.trimStart().startsWith('```')
        if (isFence) fence = !fence
        if (isFence || fence) { md.push(line); continue }

        const plain = (s: string) => s.replace(/\*\*|__/g, '').replace(/`/g, '')
        type Seg = { t: string } | { raw: string; i: Info }
        const segs: Seg[] = []
        let last = 0
        for (const m of line.matchAll(new RegExp(PATH_RE, 'g'))) {
          const i = await info(m[1])
          if (!i) continue
          const before = plain(line.slice(last, m.index))
          if (before) segs.push({ t: before })
          segs.push({ raw: m[1], i })
          last = m.index! + m[0].length
        }
        if (!segs.length) { md.push(line); continue }
        any = true
        const tail = plain(line.slice(last))
        if (tail) segs.push({ t: tail })

        // Flujo en una fila que envuelve palabra por palabra, como texto normal;
        // se simula el ajuste para saber en qué columna cae cada ruta.
        const width = cols - 2
        let x = 0
        const parts: any[] = []
        for (const g of segs) {
          if ('t' in g) {
            for (const tok of g.t.match(/\S+\s*|\s+/g) ?? []) {
              if (x > 0 && x + tok.length > width) x = 0
              parts.push(<Text key={`t${uid++}`}>{tok}</Text>)
              x += tok.length
            }
            continue
          }
          const { i, raw } = g
          if (x > 0 && x + g.raw.length > width) x = 0
          const col = x + 2
          let inner = 0, imgRows = 0
          if (i.png) {
            const ratio = (i.ph ?? 1) / (i.pw ?? 1)
            inner = Math.max(4, Math.min(MAX_COLS, cols - 8, Math.floor((MAX_ROWS * 2) / ratio)))
            imgRows = Math.max(1, Math.min(MAX_ROWS, Math.round((inner * ratio) / 2)))
          } else {
            inner = Math.max(20, Math.min(MAX_COLS + 10, cols - 8))
          }
          const tl = i.text ? i.text.split('\n') : []
          const textRows = i.png ? 0 : i.text ? tl.length : i.why ? 3 : 1
          const W = inner + 6
          const H = (i.png ? imgRows : textRows) + 4
          // Sobre la ruta, centrada en ella y dentro de la pantalla.
          const mid = col + Math.floor(raw.length / 2)
          const leftAbs = Math.max(0, Math.min(cols - W, mid - Math.floor(W / 2)))
          const abs = i.abs
          const idx = `${uid++}`
          parts.push(
            <Box key={`p${idx}`} flexDirection="column" flexShrink={0}>
              <Button key={`b${idx}`} plain onPress={() => void reveal($, abs)}>
                <Text color="blue" underline>{raw}</Text>
              </Button>
              <Box position="absolute" top={-H} left={leftAbs - col}
                display="none" hover={{ display: 'flex' }} flexDirection="column"
                borderStyle="round" borderColor="#ffffff" backgroundColor="#000000"
                paddingX={2} paddingY={1} width={W}>
                {i.png ? <Image key={`i${idx}`} source={{ png: i.png }} columns={inner} rows={imgRows} alt="vista previa" /> : null}
                {!i.png && i.text ? tl.map((l, n) => <Text key={`l${idx}-${n}`} color="#ffffff" backgroundColor="#000000" wrap="truncate-end">{l === '' ? ' ' : l}</Text>) : null}
                {!i.png && !i.text ? <Text color="#ffffff" backgroundColor="#000000" wrap="wrap">{(i.size / 1024).toFixed(1)} KB · sin vista previa{i.why ? ` (${i.why})` : ''}</Text> : null}
              </Box>
            </Box>,
          )
          x += raw.length
        }
        flush()
        blocks.push(<Box key={`r${uid++}`} flexDirection="row" flexWrap="wrap">{parts}</Box>)
      }
      if (!any) return next(e)
      flush()
      // Tras un dibujado con trabajo nuevo, se pide un segundo dibujado (ya con
      // todo en caché) para que el terminal registre el hover sin esperar un clic.
      if (isFresh && !refreshPending) {
        refreshPending = true
        $.clock.after(350, () => {
          refreshPending = false
          $.ui.invalidate('ui.render')
        })
      }
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
