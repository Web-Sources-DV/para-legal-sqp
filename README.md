# SQP PARA LEGAL

Aplicación React para leer imágenes de pasaportes, cédulas, DNI y carnets, revisar los datos del cliente y rellenar plantillas Word propias.

## Ejecutar

Requiere Node.js 20 o posterior.

```sh
npm install
npm run dev
```

Abre http://localhost:3000. El motor local usa Tesseract y descarga sus recursos de idioma en el primer uso. Para OCR asistido, configura `GEMINI_API_KEY` en un archivo `.env` del servidor. Nunca pongas esa clave en variables `VITE_*` ni en el navegador.

```sh
npm run lint
npm test
npm run build
npm start
```

`npm run build:web` genera exclusivamente la app estática para GitHub Pages. Pages permite el OCR local; el OCR asistido necesita un servidor. La versión HTML anterior es una aplicación independiente y no incorpora estas correcciones de React.

## Flujo

1. Sube una imagen JPG, PNG, WEBP o BMP de hasta 15 MB, toma una foto o ingresa datos manualmente.
2. Revisa y corrige los campos. Lo que no se leyó queda vacío; nunca se generan identidades ficticias. Para actualizar un cliente, selecciónalo explícitamente.
3. Carga una plantilla `.docx` propia de hasta 3 MB con campos como `{{nombre}}`, `{{nombres}}`, `{{numero_identidad}}`, `{{nacionalidad}}`, `{{tipo_documento}}`, `{{abogado_nombre}}` y `{{abogado_cedula}}`. También se admiten paréntesis y corchetes. Los campos deben estar completos antes de generar.
4. Genera Word. Se conservan los elementos del documento y se archiva el archivo exacto para descargarlo desde el historial, incluso si después cambias los datos del cliente o eliminas la plantilla.

La vista de texto representa el contenido extraído de la plantilla; no simula su paginación. El bloque de firmas se modifica solo si activas la opción correspondiente. Requiere un párrafo con `ACEPTO PODER` y `OTORGO PODER`, seguido del nombre y de una línea de identificación; las estructuras complejas deben conservarse en la plantilla. Los botones del simulador cambian únicamente la vista, nunca el nombre real generado.

## Datos y respaldos

Los datos están en `localStorage` de este navegador, sin sincronización en la nube. Exporta respaldos desde Base de Datos. Una restauración valida todos los registros antes de escribir; si se agota el espacio, revierte la operación. El historial almacena archivos Word y puede llenar el espacio disponible. El respaldo contiene datos personales y archivos: guárdalo en un lugar privado.

Los perfiles de letrados son los que ya venían en el repositorio. Confirma sus nombres y credenciales antes de usar documentos reales.

## Próximas mejoras

- Escaneo por ambas caras y combinación de campos, rotación y recorte; soporte explícito de PDF y HEIC.
- Validación de dígitos MRZ y pruebas con imágenes de documentos de cada país, usando datos ficticios.
- Almacenamiento en IndexedDB para archivos grandes y, si necesitas varios usuarios, autenticación y una base de datos con acceso por usuario.
- Catálogo editable de letrados, campos obligatorios por plantilla y vista previa paginada de Word/PDF.
- Pruebas reales de cámara en Android/iPhone y OCR asistido con una clave configurada.

## Verificación

Las pruebas incluyen asignación de campos, edición de valores, OCR sin datos inventados, sustitución de marcadores divididos entre fragmentos de Word, conservación de imágenes y enlaces, generación del archivo, firmas y restauración ante fallos de almacenamiento. La cámara física y el proveedor externo requieren verificación adicional en el dispositivo y servidor de destino.
