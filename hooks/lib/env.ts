// Datos del entorno que se piden una vez y se reutilizan (SO, HOME, carpeta temporal).
let osName: string | undefined
let home: string | undefined
let tmp: string | undefined

async function out($: any, argv: string[]): Promise<string | undefined> {
  const p = await $.process.run(argv).catch(() => undefined)
  return p?.exitCode === 0 ? p.stdout : undefined
}

export async function getOs($: any): Promise<'Darwin' | 'Linux' | 'Windows'> {
  osName ??= (await out($, ['uname', '-s']))?.trim()
  return osName === 'Darwin' || osName === 'Linux' ? osName : 'Windows' // Git Bash (MINGW*) cuenta como Windows
}

// En Windows sin sh se pide la variable con cmd; las barras invertidas pasan a "/".
async function envVar($: any, unix: string, win: string): Promise<string | undefined> {
  const v = (await out($, ['sh', '-c', `printf %s "$${unix}"`])) || (await out($, ['cmd', '/c', `echo %${win}%`]))
  const t = v?.trim().replaceAll('\\', '/')
  return t && !t.startsWith('%') ? t : undefined
}

export async function getHome($: any): Promise<string> {
  return (home ??= (await envVar($, 'HOME', 'USERPROFILE')) ?? '')
}

// mktemp: nombre impredecible, sin pisar enlaces ajenos.
export async function getTmp($: any): Promise<string | undefined> {
  return (tmp ??= (await out($, ['mktemp', '-d']))?.trim() || (await envVar($, 'TMPDIR', 'TEMP')))
}

export const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Abre la ubicación del archivo en el explorador del sistema.
export async function reveal($: any, path: string) {
  const os = await getOs($)
  if (os === 'Darwin') return $.process.run(['open', '-R', path])
  if (os === 'Linux') return $.process.run(['xdg-open', path.slice(0, Math.max(path.lastIndexOf('/'), 1))])
  return $.process.run(['explorer', `/select,${path.replaceAll('/', '\\')}`])
}
