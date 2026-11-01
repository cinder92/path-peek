# path-peek

Mod de Claude Code: las rutas de archivos existentes en las respuestas se vuelven enlaces azules con vista previa al hover y clic para abrir la ubicación. Pensado para macOS, Linux y Windows (solo probado en macOS).

## Estructura

- `hooks/register.tsx`: registra los hooks (`session.start`, `turn.complete`, `ui.render`). Solo orquesta.
- `hooks/lib/env.ts`: SO, HOME, carpeta temporal, `reveal`.
- `hooks/lib/bins.ts`: ejecutar `ffmpeg`/`convert` y avisar si falta ffmpeg (nunca instala).
- `hooks/lib/thumb.ts`: imagen o video a PNG chico.
- `hooks/lib/info.ts`: datos de un archivo + caché.
- `hooks/lib/card.tsx`: enlace y tarjeta de preview.
- `hooks/lib/message.tsx`: texto del mensaje a bloques.

## Principios

- **SOLID**: un módulo, una responsabilidad (ver estructura). `register.tsx` depende de funciones pequeñas, no de detalles de plataforma.
- **KISS**: la solución más simple que funciona. Sin sobre-ingeniería.
- **DRY**: si una lógica aparece dos veces, se extrae y se reutiliza.
- **YAGNI**: no se escribe nada que nadie haya pedido hoy.

## Límite de tamaño

Ningún archivo supera **200 líneas**. Si lo supera, abstrae o reutiliza lógica antes de añadir más. Comprobar:

```
wc -l hooks/*.tsx hooks/lib/*
```

## Do

- Mantén cada función corta y con un solo propósito.
- Soporta macOS, Linux y Windows en cada cambio; si una herramienta falta, degrada (sin vista previa) en vez de fallar.
- Avisa al usuario de lo que falta (toast con el comando de instalación) y deja que él decida.
- Pasa `$` solo como argumento directo de funciones declaradas con `function`; el validador del plugin lo exige.
- Usa claves (`key`) únicas en todo el árbol del mensaje (contador `uid`).
- Reutiliza `runBin` para lanzar herramientas externas y `getInfo` para leer archivos.
- Valida con `claude plugin validate .` antes de cada commit.

## Don't

- No instales software por el usuario ni ejecutes `sudo`.
- No guardes `$` en objetos, ni lo pases como prop de JSX, ni lo devuelvas.
- No previsualices `.env`, llaves, `id_*`, `credentials*`, `.npmrc` ni `.netrc`.
- No añadas dependencias, configuración ni opciones "por si acaso".
- No dupliques constantes o lógica entre archivos.
- No subas `.DS_Store`, `.claude-plugin/types/` ni logs.
- No añadas `Co-Authored-By` ni líneas de atribución a Claude en commits.

## Publicar

Rama `main`, repo `cinder92/path-peek`. Tras un cambio: validar, probar con `/reload-plugins` y commit.
