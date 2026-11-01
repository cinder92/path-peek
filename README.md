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

## Límites

- Rutas sin espacios; no soporta `C:\`.
- Si la ruta está en las primeras ~14 filas de la pantalla, la tarjeta se corta.
- Imágenes en pantalla completa requieren un terminal compatible (p. ej. iTerm2); video requiere `ffmpeg`.
