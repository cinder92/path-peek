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

## Documentación obligatoria

Todo cambio se documenta en el mismo commit que lo introduce:

- **Feature:** línea en `README.md` (sección Cambios) y, si cambia la estructura, en `CLAUDE.md`.
- **Corrección o bug:** línea en Cambios y una entrada en el historial de abajo con causa y solución.
- **Límite nuevo o plataforma probada:** actualiza las secciones Límites y Plataformas del README.

## Historial de bugs y decisiones

- **Hover no respondía hasta hacer clic:** el terminal no registraba la zona de hover del contenido recién dibujado. Solución: `$.ui.invalidate('ui.render')` a 250 y 900 ms tras `turn.complete`, además de 350 ms tras generar miniaturas.
- **Validador rechazaba `$` en objetos y props:** `claude plugin validate` exige `$` como argumento directo de funciones declaradas con `function`. Solución: helpers como `function`, `ctx` sin `$`, `onOpen` como closure.
- **Componentes JSX propios sin `key`:** el refactor convirtió la tarjeta en componentes; riesgo de descartar el hook. Solución: `pathLink(...)` y `body(...)` son funciones que devuelven el `Box` con su `key`.
- **`getOs` en Git Bash devolvía `MINGW64_NT-…`:** el aviso de ffmpeg mostraba «undefined». Solución: todo valor distinto de `Darwin`/`Linux` cuenta como `Windows`.
- **Miniaturas fallidas se relanzaban en cada repintado:** con los repintados nuevos, `ffmpeg`/`convert` se ejecutaba varias veces por mensaje. Solución: los fallos se cachean 60 s (`FAIL_TTL_MS`).
- **Aviso de ffmpeg en cada sesión:** molesto si no se ven videos. Solución: una vez al día con `$.store`.
- **Windows sin `sh`/`mktemp`:** sin carpeta temporal ni HOME. Solución: respaldo con `cmd /c echo %TEMP%` y `%USERPROFILE%` (sin probar).
- **Pendiente:** los PNG temporales de `mktemp` no se borran.

## Publicar

Rama `main`, repo `cinder92/path-peek`. Tras un cambio: validar, probar con `/reload-plugins` y commit.
