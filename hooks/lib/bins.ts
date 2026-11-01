import { getOs } from './env'

// Rutas donde suelen vivir las herramientas cuando el PATH del motor no las tiene.
const PLACES: Record<string, string[]> = {
  ffmpeg: ['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'],
  convert: ['convert', '/opt/homebrew/bin/convert', '/usr/local/bin/convert', '/usr/bin/convert'],
}

// Ejecuta la primera variante que exista; undefined si ninguna se pudo lanzar.
export async function runBin($: any, argv: string[]) {
  for (const bin of PLACES[argv[0]] ?? [argv[0]]) {
    const r = await $.process.run([bin, ...argv.slice(1)], { timeoutMs: 15000 }).catch(() => undefined)
    if (r) return r
  }
  return undefined
}

const INSTALL = { Darwin: 'brew install ffmpeg', Linux: 'sudo apt install ffmpeg', Windows: 'winget install ffmpeg' }

const DAY_MS = 86_400_000

// Solo avisa (como mucho una vez al día); nunca instala nada.
export async function warnIfNoFfmpeg($: any) {
  if ((await runBin($, ['ffmpeg', '-version']))?.exitCode === 0) return
  const last = Number(await $.store.get('ffmpegWarnedAt')) || 0
  if (Date.now() - last < DAY_MS) return
  await $.store.set('ffmpegWarnedAt', Date.now())
  const cmd = INSTALL[await getOs($)]
  $.ui.toast(`path-peek: falta ffmpeg (sin él no hay vista previa de video). Instálalo con: ${cmd}`, { timeoutMs: 12000 })
}
