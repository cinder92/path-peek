import type { Info } from './info'

const MAX_COLS = 48
const MAX_ROWS = 10
const WHITE = '#ffffff'
const BLACK = '#000000'

// Tamaño del contenido de la tarjeta: columnas útiles y filas de imagen/texto.
const measure = (i: Info, cols: number) => {
  if (i.png) {
    const ratio = (i.ph ?? 1) / (i.pw ?? 1)
    const inner = Math.max(4, Math.min(MAX_COLS, cols - 8, Math.floor((MAX_ROWS * 2) / ratio)))
    return { inner, rows: Math.max(1, Math.min(MAX_ROWS, Math.round((inner * ratio) / 2))) }
  }
  const inner = Math.max(20, Math.min(MAX_COLS + 10, cols - 8))
  return { inner, rows: i.text ? i.text.split('\n').length : i.why ? 3 : 1 }
}

const body = ({ i, id, inner, rows, Image, Text }: any) => {
  if (i.png) return <Image key={`i${id}`} source={{ png: i.png }} columns={inner} rows={rows} alt="vista previa" />
  if (i.text)
    return i.text.split('\n').map((l: string, n: number) => (
      <Text key={`l${id}-${n}`} color={WHITE} backgroundColor={BLACK} wrap="truncate-end">{l === '' ? ' ' : l}</Text>
    ))
  return <Text color={WHITE} backgroundColor={BLACK} wrap="wrap">{(i.size / 1024).toFixed(1)} KB · sin vista previa{i.why ? ` (${i.why})` : ''}</Text>
}

type Args = { ui: any; i: Info; raw: string; col: number; cols: number; id: string; onOpen: () => void }

// Ruta azul (clic = abrir) con la tarjeta de preview oculta encima (hover = mostrar).
// Siempre encima de la ruta: lo pintado después tapa a una tarjeta absolute.
export const pathLink = ({ ui, i, raw, col, cols, id, onOpen }: Args) => {
  const { Box, Text, Button, Image } = ui
  const { inner, rows } = measure(i, cols)
  const W = inner + 6
  const H = rows + 4
  const mid = col + Math.floor(raw.length / 2)
  const left = Math.max(0, Math.min(cols - W, mid - Math.floor(W / 2)))
  return (
    <Box key={`p${id}`} flexDirection="column" flexShrink={0}>
      <Button key={`b${id}`} plain onPress={onOpen}>
        <Text color="blue" underline>{raw}</Text>
      </Button>
      <Box position="absolute" top={-H} left={left - col} display="none" hover={{ display: 'flex' }}
        flexDirection="column" borderStyle="round" borderColor={WHITE} backgroundColor={BLACK}
        paddingX={2} paddingY={1} width={W}>
        {body({ i, id, inner, rows, Image, Text })}
      </Box>
    </Box>
  )
}
