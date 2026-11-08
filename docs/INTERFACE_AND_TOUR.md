# Propuestas de interfaz y tour guiado

## Comparador visual

`/designs.html` contiene tres vistas previas interactivas con la paleta azul y oro de SQP y el logo oficial:

- **A. Asistente enfocado:** una tarea a la vez, recomendado para usuarios nuevos y móviles.
- **B. Escritorio organizado:** menú lateral permanente en escritorio; se adapta a una barra en móvil.
- **C. Mesa de trabajo:** captura y datos juntos en pantallas grandes, apilados en móvil.

El comparador utiliza únicamente datos ficticios. Los botones simulan el recorrido y las búsquedas; no usa OCR, cámara, Supabase, archivos reales ni descargas. La selección cambia solo la vista previa y no impone un rediseño a los usuarios de la app. La aplicación utiliza automáticamente **B (escritorio organizado)** desde 1024 px y **A (asistente enfocado)** por debajo de ese ancho. La propuesta C permanece como referencia visual del comparador, no como modo de la app. El cambio de distribución no recarga ni reinicia los formularios.

## Tour instalado en la app

El botón **Tour guiado** de la cabecera ofrece dos recorridos:

- **Recorrer esta pantalla:** se adapta a la sección y a los controles visibles del paso actual. Incluye identificación, cámara, revisión, confirmación, guardado, letrado, plantilla, firma y generación, según corresponda.
- **Conocer las herramientas:** explica por separado el menú, clientes, plantillas, historial, ayuda y generador avanzado.

Cada explicación resalta el control real, muestra una flecha y permite avanzar, retroceder o salir. Se puede repetir y cerrar con Escape. El foco permanece dentro del diálogo; al salir se restaura el menú, el desplazamiento y el foco. No navega por otras secciones ni pulsa controles, inicia cámaras, genera archivos o guarda datos. No aparece automáticamente sobre el trabajo del usuario.

El diálogo nativo mantiene el fondo inerte. El posicionamiento se actualiza con desplazamiento, cambio de tamaño y tamaño del elemento. En pantallas bajas el texto tiene desplazamiento independiente y los controles de avance siguen visibles. Los objetivos ausentes no bloquean la salida.

## Validación

Pruebas Chromium de los tours a 375×812, 1440×960 y 812×375, con teclado, Escape, navegación hacia atrás, restauración del menú, campos sin guardar y ausencia de operaciones de escritura/cámara. Incluyen contextos vacíos y con registros ficticios. Los tres prototipos se prueban a 375 y 1440 px, con cambio de diseño, recorrido y búsqueda de ejemplos.

Se mantienen las pruebas existentes de generación y descarga Word, reintentos y revisión de identidades, así como las pruebas de OCR real. No hay nuevas dependencias ni cambios en los permisos de Supabase, en el logo oficial o en el contenido de los documentos generados.
