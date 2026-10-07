# SQP PARA LEGAL

Escaneo local de identidades con Tesseract, revisión de datos y generación de documentos Word desde plantillas. La aplicación abre por enlace sin iniciar sesión. Clientes, plantillas y documentos se comparten con todos los visitantes.

## Acceso y publicación

Se retiraron gestión de usuarios, inicio/cierre de sesión, versión HTML anterior y controles de base de datos. Los visitantes pueden crear y editar registros, archivar clientes y plantillas y usar el historial. Los respaldos, restauraciones y cuentas se administran fuera de la aplicación pública.

Para Legal utiliza exclusivamente el proyecto Supabase `fipcnxfxxngdjunrlbat` y las tablas `pl_`. Cotizador y financiamiento usan otro proyecto (`bcmzhicashtsdzlmqrif`).

Consulta [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): aplica las migraciones nuevas antes de publicar. GitHub Actions verifica esquema público v3 antes de desplegar a Pages. El enlace público también permite consultar los expedientes existentes mediante la API; no constituye una barrera de acceso.

## Desarrollo

Requiere Node.js 22 o posterior y pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

El OCR procesa imágenes en el navegador. La primera carga necesita internet para descargar el motor y sus idiomas. Guardar registros y generar documentos archivados requiere conexión a Supabase.

Las correcciones de formularios se conservan durante recargas. Se validan fechas y controles MRZ, y se pide confirmar la identidad contra el original. El Word se prepara, se archiva y se descarga; los reintentos conservan su identificador y contenido. Las ediciones comprueban revisiones para evitar sobrescrituras concurrentes. Los archivos nuevos son inmutables y se descargan bajo demanda.

## Comprobaciones adicionales

```sh
pnpm lint
pnpm test
pnpm build
pnpm test:browser
pnpm check:functions
```

`PL_BROWSER_PRODUCTION=1 pnpm test:browser` ejecuta la misma prueba contra el servidor compilado después de `pnpm build`.

`test:browser` arranca un servidor temporal y ejecuta Chromium con un backend simulado: valida el inicio de sesión, conservación de correcciones tras sincronización, reintento del archivo y contenido del Word descargado. Usa Chromium del sistema o el instalado con `pnpm exec playwright install chromium`. `check:functions` requiere Deno 2.7.5.

Para pruebas SQL aisladas:

```sh
docker run -d --name para-legal-tests -p 127.0.0.1:55432:5432 \
  -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=para_legal_test postgres:17
pnpm test:database
```

El script crea/reinicializa únicamente una base de pruebas `*_test`, instala todas las migraciones y comprueba permisos, revisiones, duplicados, aprobación, archivos, sincronización, auditoría y recuperación. Las tablas `auth` y `storage` del ensayo son sustitutos mínimos para comprobar SQL/RLS; no sustituyen probar Supabase Auth, Storage y la Edge Function desplegados. Nunca uses una conexión de producción en `TEST_DATABASE_URL`.

Las pruebas del servicio local anterior se conservan como pruebas de compatibilidad de respaldos; las nuevas pruebas de almacenamiento ejercitan el servicio compartido. TypeScript se ejecuta en modo estricto.

## Identidad visual

El SVG oficial está en `public/favicon.svg` y sus mismas formas se muestran en `AppLogo`. Usarlo en la interfaz y el favicon. **Los documentos de Para Legal no llevan logo**; no agregar membretes ni imágenes a los archivos Word generados.

## Lector internacional de identidad

Consulta [las funciones y límites del lector](docs/IDENTITY_READER.md). Incluye idiomas opcionales, MRZ, reverso de cédula, alertas de vencimiento y edad; `pnpm test:ocr` verifica una imagen ficticia con el motor real y el registro simulado.
