import { makeThumb, pngSize } from './thumb'

const VID = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv)$/i
const IMG = /\.(png|jpe?g|gif|webp|bmp|heic|avif|tiff?)$/i
// Nunca se previsualiza el contenido de archivos que suelen guardar secretos.
const SECRET = /(^|\/)(\.env[^/]*|id_[a-z0-9]+|[^/]*\.(pem|key|p12|pfx|keystore)|credentials[^/]*|\.netrc|\.npmrc)$/i
const CACHE_MAX = 200
const FAIL_TTL_MS = 60_000 // un fallo se reintenta tras 1 min, no en cada repintado

export type Info = {
  abs: string; size: number; mtime: number; at: number
  why?: string; png?: string; pw?: number; ph?: number; text?: string
}
// Estado de un dibujado: miniaturas restantes y si hubo trabajo nuevo.
export type Run = { budget: number; fresh: boolean }

const cache = new Map<string, Info>()

async function readText($: any, abs: string): Promise<string | undefined> {
  const t = await $.fs.read(abs).catch(() => undefined)
  if (typeof t !== 'string' || t.includes('\u0000')) return undefined
  return t.split('\n').slice(0, 10).map(l => l.replaceAll('\t', '  ').slice(0, 90)).join('\n')
}

async function build($: any, abs: string, st: any, run: Run): Promise<Info> {
  const r: Info = { abs, size: st.size, mtime: st.mtimeMs, at: Date.now() }
  const isVideo = VID.test(abs)
  if (IMG.test(abs) || isVideo) {
    if (run.budget-- <= 0) return r
    const t = await makeThumb($, abs, isVideo)
    r.png = t.png
    r.why = t.png ? undefined : t.why
    const d = t.png ? pngSize(t.png) : undefined
    if (d) { r.pw = d.w; r.ph = d.h }
  } else if (st.size < 200_000 && !SECRET.test(abs)) {
    r.text = await readText($, abs)
  }
  return r
}

// Devuelve la info de un archivo existente (con caché por mtime/size) o null.
export async function getInfo($: any, abs: string, run: Run): Promise<Info | null> {
  const st = await $.fs.stat(abs).catch(() => undefined)
  if (!st || st.kind !== 'file') return null
  const hit = cache.get(abs)
  const failed = (x: Info) => (IMG.test(x.abs) || VID.test(x.abs)) && !x.png
  const fresh = hit && (!failed(hit) || Date.now() - hit.at < FAIL_TTL_MS)
  if (hit && fresh && hit.mtime === st.mtimeMs && hit.size === st.size) return hit
  run.fresh = true
  const r = await build($, abs, st, run)
  cache.delete(abs)
  cache.set(abs, r)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return r
}
