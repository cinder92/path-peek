import { getOs, getTmp, hash } from './env'
import { runBin } from './bins'

export type Thumb = { png?: string; why?: string }

const SCALE = ['-frames:v', '1', '-vf', 'scale=600:-2']
const ffmpeg = (src: string, out: string, seek: string[] = []) =>
  ['ffmpeg', '-y', '-loglevel', 'error', ...seek, '-i', src, ...SCALE, out]

async function readPng($: any, file: string): Promise<string | undefined> {
  const st = await $.fs.stat(file).catch(() => undefined)
  if (!st || st.size > 1_800_000) return undefined
  return (await $.fs.read(file, { as: 'bytes' }).catch(() => undefined))?.base64
}

// Comando que produce el PNG chico (<= 600 px) según el tipo de archivo y el SO.
const command = (os: string, src: string, out: string, isVideo: boolean): string[] =>
  isVideo ? ffmpeg(src, out, ['-ss', '1'])
  : os === 'Darwin' ? ['sips', '-Z', '600', '-s', 'format', 'png', src, '--out', out]
  : ['convert', `${src}[0]`, '-resize', '600x600>', out]

export async function makeThumb($: any, src: string, isVideo: boolean): Promise<Thumb> {
  if (!isVideo && /\.png$/i.test(src)) {
    const direct = await readPng($, src)
    if (direct) return { png: direct }
  }
  const dir = await getTmp($)
  if (!dir) return { why: 'mktemp falló' }
  const out = `${dir}/${hash(src)}.png`
  let r = await runBin($, command(await getOs($), src, out, isVideo))
  // Respaldo: video sin "-ss" (clips cortos) o imagen en Linux/Windows con ffmpeg.
  if (r?.exitCode !== 0 && (isVideo || (await getOs($)) !== 'Darwin')) r = await runBin($, ffmpeg(src, out))
  if (r?.exitCode !== 0) return { why: r ? `exit ${r.exitCode}: ${String(r.stderr).trim().slice(-120)}` : 'falta ffmpeg/convert' }
  const png = await readPng($, out)
  return png ? { png } : { why: `no se pudo leer ${out}` }
}

// Ancho y alto desde la cabecera PNG (IHDR).
export const pngSize = (b64: string): { w: number; h: number } | undefined => {
  try {
    const b = Uint8Array.fromBase64(b64.slice(0, 32))
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0
    return w > 0 && h > 0 ? { w, h } : undefined
  } catch {
    return undefined
  }
}
