# path-peek

Mod de Claude Code. Las rutas de archivos existentes que aparecen en las respuestas se vuelven enlaces azules:

- **Hover:** tarjeta de vista previa sobre la ruta (imagen, fotograma de video con ffmpeg, o las primeras 10 líneas de un archivo de texto).
- **Clic:** abre la ubicación en el explorador del sistema (Finder, xdg-open o Explorer).

No previsualiza `.env`, llaves (`.pem`, `.key`), `id_*`, `credentials*`, `.npmrc` ni `.netrc`.

## Instalación

Desde el prompt de una sesión de terminal:

```
/plugin install path-peek --marketplace cinder92/path-peek
```

Desde un shell:

```
claude plugin install path-peek --marketplace cinder92/path-peek
```

Responde `y` a `Add marketplace?` y elige el alcance.

## Requisitos

`ffmpeg` para la vista previa de video (y de imágenes en Linux/Windows sin ImageMagick). Al iniciar la sesión el mod comprueba si está instalado; si falta, muestra un aviso con el comando (`brew install ffmpeg`, `sudo apt install ffmpeg` o `winget install ffmpeg`), como mucho una vez al día. No instala nada por su cuenta.

## Plataformas

| Sistema | Estado |
| --- | --- |
| macOS | Probado |
| Linux | Sin probar (usa `convert` o `ffmpeg`, `xdg-open`) |
| Windows | Sin probar (usa `ffmpeg`, `explorer`, `%TEMP%` y `%USERPROFILE%`) |

## Límites

- Rutas sin espacios; no soporta `C:\`.
- Si la ruta está en las primeras ~14 filas de la pantalla, la tarjeta se corta.
- Imágenes en pantalla completa requieren un terminal compatible (p. ej. iTerm2); video requiere `ffmpeg`.
- Las miniaturas que fallan se reintentan tras 1 minuto, no en cada repintado.
- Los PNG temporales de las miniaturas no se borran.

## Desarrollo

Estructura y reglas del código (SOLID, KISS, DRY, YAGNI, máximo 200 líneas por archivo) en [CLAUDE.md](CLAUDE.md). Validar con `claude plugin validate .`.

## Cambios

- **0.1.0**
  - Vista previa al hover (imagen, video, texto) y clic para abrir la ubicación.
  - El hover funciona sin clic previo: se repinta dos veces al terminar la respuesta.
  - Aviso si falta ffmpeg (una vez al día, nunca instala).
  - Código dividido en módulos de `hooks/lib/`, ninguno de más de 200 líneas.
  - Soporte de entorno para Windows (`%TEMP%`, `%USERPROFILE%`) y Git Bash.
  - Fallos de miniatura cacheados 1 minuto para no relanzar `ffmpeg` en cada repintado.
  - Licencia MIT.
