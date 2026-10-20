# Documentos en tres pasos

1. **Cliente:** subir una imagen o usar cámara. También se puede recuperar un cliente o ingresar datos manualmente.
2. **Revisar:** cotejar identidad, fechas y país; confirmar y continuar. Las alertas de vencimiento y las discrepancias permanecen visibles. Contacto, JSON y asociación manual se agrupan en opciones plegables.
3. **Generar Word:** elegir plantilla y letrado, completar los campos y pulsar «Generar y Descargar Word». La identidad revisada ya está seleccionada; no se cambia de sección. Las firmas están en un apartado opcional.

Clientes, plantillas, historial, ayuda y generador avanzado se encuentran en un solo menú «Herramientas». La navegación anterior sigue disponible desde ese menú para tareas administrativas.

## Lectura más rápida

- El motor se prepara mientras se revisa la imagen o se abre la cámara y se reutiliza para la lectura.
- Se elimina una decodificación y redimensión duplicada de la imagen. Se conserva el límite de 2800 píxeles en el preprocesador, sin reducir la resolución para ganar velocidad.
- Una MRZ con controles válidos permite terminar sin nuevas pasadas de imagen completa.
- Una lectura visual con nombre, número, tipo, nacimiento válido no futuro, vencimiento y sexo, y confianza del motor de al menos 90, evita repeticiones. Esto no equivale a certificar los datos. Los documentos sin vencimiento detectado siguen la recuperación automática.
- Si falta información, hay baja confianza o falla un control MRZ, continúan las pasadas de contraste y MRZ. Se compara cada confianza con su propia lectura.

Prueba orientativa en Chromium, mismo entorno, con documentos ficticios y escrituras interceptadas: la cédula pasó de tres reconocimientos a uno; del botón «Leer» a la revisión, de 3701 a 2272 ms. El pasaporte mantuvo una pasada (3202 frente a 2695 ms). Son observaciones individuales, con versiones anterior publicada y nueva local; no un benchmark estadístico ni una garantía para otros dispositivos o fotos.

Validación automatizada: controles de selección de pasadas y controles MRZ fallidos, preparación/reutilización/cancelación del motor, flujo completo de tres pasos hasta verificar el texto del Word descargado, navegación responsive y OCR real de cédula y pasaporte.

Los colores actuales se conservan a la espera de la imagen de referencia solicitada por el usuario. No se cambian el esquema de Supabase, el acceso compartido ni el logo oficial. Los Word siguen sin logos.
