# Lector de documentos de identidad

Se comparan lecturas del documento con realce, binarización y, cuando hace falta, imagen original. La MRZ se lee también en un recorte inferior con el alfabeto ICAO. Se comprueban los dígitos de control; las lecturas dudosas no reemplazan campos visuales etiquetados que se hayan leído correctamente. Se avisa de discrepancias.

La selección de idioma permite español, inglés, portugués, francés, alemán, italiano, ruso, árabe, chino simplificado y japonés. Las etiquetas implementadas cubren principalmente español/inglés y varias etiquetas de esos idiomas; no constituyen un catálogo de todos los diseños nacionales. Los pasaportes y cédulas con MRZ usan TD1, TD2 o TD3. Los países de la MRZ se identifican mediante los códigos ISO/ICAO, con la [atribución del conjunto de datos](DATA_ATTRIBUTIONS.md).

El reverso es opcional y debe pertenecer a la misma identidad: números, nacimiento, sexo, vencimiento o nombres incompatibles interrumpen la combinación. Las imágenes se procesan en el navegador; los modelos de Tesseract se descargan al primer uso. El reverso sirve para completar datos y no se sube como archivo independiente. La conservación de la imagen principal sigue siendo opcional.

La revisión calcula la edad y distingue MENOR (<14), JOVEN (14–17) y adulto; ambos primeros grupos son menores de 18 años. No se infiere sexo por el nombre. El documento se considera vencido desde el día siguiente a su fecha de caducidad usando la fecha de Panamá. Si no hay fecha legible, aparece “vencimiento no confirmado”, sin inventarla. Un registro vencido se puede conservar; la alerta indica que hay que verificarlo antes de realizar trámites.

El registro guarda los campos revisados: tipo, identidad, nombre, nacimiento, sexo, vencimiento, edad y condición. La vigencia y edad de la interfaz se recalculan para no depender de un estado guardado que envejezca. La revisión contra el original sigue siendo obligatoria.

## Validación

- `pnpm test`: fechas, idiomas/etiquetas, MRZ, conflictos entre caras y clasificación por edad.
- `pnpm test:ocr`: genera una cédula ficticia, ejecuta Tesseract real en Chromium, comprueba la alerta de vencimiento y captura el registro mediante una API simulada. Descarga modelos; no escribe datos en Supabase.
- `PL_BROWSER_PRODUCTION=1 pnpm test:ocr`: lo mismo sobre el servidor compilado, después de `pnpm build`.

Las comprobaciones actuales usan imágenes sintéticas de pasaporte y cédula. La precisión sobre fotos reales, reflejos, desenfoque, diseños y escrituras de todos los países requiere muestras adicionales. No se garantiza extracción completa de todos los documentos. Ante campos vacíos, avisos o diferencias, repite la fotografía o completa los datos manualmente.
