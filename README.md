# SQP PARA LEGAL

Aplicación web para leer documentos de identidad, revisar los datos del cliente y generar documentos Word a partir de plantillas. Desarrollada con apoyo de inteligencia artificial, utiliza modelos OCR de Tesseract.js para reconocer texto en el navegador.

[**Abrir la aplicación**](https://web-sources-dv.github.io/para-legal-sqp/) · [Manual y despliegue](docs/DEPLOYMENT.md) · [Funciones del lector](docs/IDENTITY_READER.md)

La aplicación abre por enlace sin iniciar sesión. Clientes, plantillas y documentos guardados se comparten con todos los visitantes.

## Un documento en tres pasos

1. **Cliente:** sube o fotografía un pasaporte, cédula u otra identificación; también puedes elegir una ficha guardada o introducir datos manualmente.
2. **Revisar:** coteja nombres, identificación, país y fechas con el original. Corrige lo necesario, confirma la revisión y guarda los datos.
3. **Generar Word:** selecciona el letrado y la plantilla, completa los campos y descarga el archivo `.docx`. Las opciones de firma son opcionales.

## Dos interfaces que se adaptan automáticamente

La app conserva dos distribuciones de trabajo, con los mismos datos y funciones:

| Modo                      | Cuándo se utiliza                                                     | Experiencia                                                                                 |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Escritorio organizado** | Pantallas de **1024 px o más**, habituales en PC y portátiles         | Menú lateral permanente para acceder a documentos, clientes, plantillas, historial y ayuda. |
| **Asistente enfocado**    | Pantallas de **menos de 1024 px**, habituales en teléfonos y tabletas | Una tarea a la vez, recorrido de tres pasos y herramientas agrupadas en un menú compacto.   |

La adaptación usa el ancho disponible, sin identificar ni rastrear el dispositivo. Una ventana estrecha de PC también puede mostrar el asistente. Al redimensionar o girar el equipo, cambia la distribución sin recargar la app ni borrar campos editados. No se necesita elegir un modo manualmente.

La identidad visual mantiene el azul y el dorado del SVG oficial, con fondos claros, botones legibles y controles accesibles con teclado.

## Tour guiado

Pulsa **Tour guiado**, junto a **Nuevo Documento**, para elegir:

- **Recorrer esta pantalla:** explica los controles visibles del paso o de la sección abierta.
- **Conocer las herramientas:** señala clientes, plantillas, historial, ayuda y generador avanzado.

Cada paso resalta el control real con un marco, una flecha y un cuadro explicativo. Puedes avanzar, volver, terminar o salir con Escape. El tour se adapta a ambas interfaces, conserva los campos sin guardar y restaura el foco y la posición de la página. No pulsa botones, activa la cámara, genera archivos ni escribe registros. Puede repetirse cuando sea necesario.

Consulta [las propuestas visuales y el funcionamiento del tour](docs/INTERFACE_AND_TOUR.md).

## Funciones incorporadas

- **Lector internacional:** idiomas opcionales, lectura visual y MRZ en formatos TD1, TD2 y TD3; comprobación de dígitos de control y comparación de lecturas discrepantes.
- **Identidad estructurada:** tipo y número de documento, nombre completo, nacimiento, sexo, nacionalidad, país emisor y vencimiento, cuando se detectan. También conserva campos complementarios disponibles.
- **Edad y vencimiento:** cálculo de edad y condición, identificación de menores y alerta visible de documento vencido. Los valores pueden revisarse antes de registrarlos.
- **OCR más rápido:** el motor se prepara al elegir la imagen o abrir la cámara, se reutiliza y evita repetir lecturas completas cuando hay evidencia suficiente. Si faltan datos o fallan controles, ejecuta las pasadas de recuperación.
- **Captura flexible:** archivo de imagen o cámara, giro de la fotografía, selección de idioma y reverso opcional de la misma cédula.
- **Directorio compartido:** búsqueda, fichas, edición de clientes y consulta de sus documentos.
- **Plantillas Word:** carga de `.docx`, detección de marcadores y asociación con el letrado responsable.
- **Generación y archivo:** campos rellenados con datos revisados, correcciones manuales y descarga del Word. Los reintentos conservan el mismo identificador y archivo preparado.
- **Historial:** búsqueda por cliente, identificación o plantilla y descarga bajo demanda del documento original.
- **Protección de cambios:** confirmación antes de abandonar formularios editados, conservación de correcciones durante sincronizaciones y comprobación de revisiones para evitar sobrescrituras concurrentes.

Las imágenes poco legibles, los diseños no reconocidos o las lecturas discrepantes requieren revisión humana. El OCR no garantiza precisión absoluta ni determina por sí solo la validez jurídica de un documento.

## El formato de la plantilla se respeta

Al generar un Word, se sustituye el contenido de cada tag y se conservan su fuente, tamaño, negrita, cursiva, subrayado, color y estilos heredados, además del formato de los párrafos. Dos apariciones de un mismo campo pueden tener formatos distintos en el cuerpo y en la firma.

Para etiquetas descriptivas como el tipo de documento, nacionalidad y condición:

- `{{tipo_documento}}` → `pasaporte`.
- `{{TIPO_DOCUMENTO}}` → `PASAPORTE`.
- `{{Tipo_documento}}` → `Pasaporte`.

Los nombres conservan el valor revisado, salvo que el tag esté expresamente en mayúsculas. Los identificadores, teléfonos y correos conservan su escritura exacta. Si Word fragmenta un tag en varios tramos, se usa el formato del tramo que contiene su primera letra. No se aplica negrita automáticamente ni se cambia el archivo de estilos del Word.

La generación normal conserva también la firma existente. El editor opcional de firmas solo debe activarse si quieres añadir o rediseñar ese bloque. Los Word ya archivados no se modifican: para obtener el formato actualizado hay que generar un documento nuevo desde la plantilla original.

## Uso de inteligencia artificial (IA / AI)

La IA se utiliza en dos ámbitos diferentes:

1. **Desarrollo asistido por IA:** Codex, de OpenAI, ayuda a implementar funciones, revisar código, preparar pruebas y explorar mejoras de interfaz. Sus propuestas requieren revisión y validación; el repositorio incluye comprobaciones automatizadas.
2. **Reconocimiento de documentos:** Tesseract.js utiliza modelos entrenados para reconocer caracteres. Esta lectura se ejecuta en el navegador del visitante; no se envían automáticamente las fotografías a OpenAI ni a una API de IA generativa.

La aplicación actual **no incorpora un chat de IA generativa ni genera asesoría jurídica mediante un modelo**. Los Word se construyen con plantillas y datos revisados; las verificaciones de fechas, edad y dígitos MRZ son reglas de validación del programa. Guardar clientes, imágenes opcionales y documentos sí utiliza el almacenamiento compartido de Supabase, según las opciones elegidas por el usuario.

## Acceso, datos y publicación

Se retiraron gestión de usuarios, inicio/cierre de sesión, versión HTML anterior y controles de base de datos. Los visitantes pueden crear y editar registros, archivar clientes y plantillas y usar el historial. Los respaldos, restauraciones y cuentas se administran fuera de la aplicación pública. Los archivos guardados no tienen permisos públicos de sobrescritura o borrado.

Para Legal utiliza exclusivamente el proyecto Supabase `fipcnxfxxngdjunrlbat` y las tablas `pl_`. Cotizador y financiamiento usan otro proyecto (`bcmzhicashtsdzlmqrif`).

Consulta [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): aplica las migraciones necesarias antes de publicar. GitHub Actions comprueba tipos, pruebas, compilación, PostgreSQL, navegador, OCR y Edge Function, y verifica el esquema público v3 antes del despliegue a Pages.

**El enlace público no es una barrera de acceso:** los expedientes guardados también pueden consultarse mediante la API pública. No publiques datos que no deban estar disponibles para todos los visitantes.

## Desarrollo

Requiere Node.js 22 o posterior y pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

El primer uso del OCR necesita internet para descargar el motor y sus idiomas. Guardar registros y generar documentos archivados requiere conexión a Supabase.

## Comprobaciones

```sh
pnpm lint
pnpm test
pnpm build
pnpm test:browser
pnpm test:ocr
pnpm check:functions
pnpm check:deployment
```

`PL_BROWSER_PRODUCTION=1 pnpm test:browser` ejecuta los recorridos contra el servidor compilado después de `pnpm build`.

`test:browser` arranca un servidor temporal y ejecuta Chromium con un backend simulado: valida acceso sin sesión, ambos diseños, cambios de tamaño sin pérdida de datos, el tour, correcciones durante sincronización, reintentos de archivo y contenido del Word descargado. Usa Chromium del sistema o el instalado con `pnpm exec playwright install chromium`.

`test:ocr` usa el motor real con una cédula y un pasaporte ficticios y verifica revisión, alerta de vencimiento y registro simulado. Las pruebas no crean clientes reales en Supabase. `check:functions` requiere Deno 2.7.5. `check:deployment` comprueba de forma solo lectura la compatibilidad del proyecto remoto.

Para pruebas SQL aisladas:

```sh
docker run -d --name para-legal-tests -p 127.0.0.1:55432:5432 \
  -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=para_legal_test postgres:17
pnpm test:database
```

El script crea o reinicializa únicamente una base de pruebas `*_test`, instala las migraciones y comprueba permisos, revisiones, duplicados, aprobación, archivos, sincronización, auditoría y recuperación. Las tablas `auth` y `storage` del ensayo son sustitutos mínimos para comprobar SQL/RLS; no sustituyen probar Supabase y la Edge Function desplegados. Nunca uses una conexión de producción en `TEST_DATABASE_URL`.

Las pruebas del servicio local anterior se conservan como comprobaciones de compatibilidad de respaldos; las pruebas de almacenamiento ejercitan el servicio compartido. TypeScript se ejecuta en modo estricto.

## Identidad visual y documentos

El SVG oficial está en `public/favicon.svg` y sus formas se muestran en `AppLogo`. Consulta [la paleta de marca](docs/BRAND_PALETTE.md). **Los documentos de Para Legal no llevan logo**; no se añaden membretes ni imágenes a los Word generados.
