# Paleta visual SQP

Colores extraídos del SVG proporcionado por el usuario:

| Color | Valor | Uso |
| --- | --- | --- |
| Azul corporativo | `#065687` | Cabecera, paneles y foco del teclado |
| Dorado | `#E5BF29` | Acciones principales y selección |
| Oro mate | `#9E8D47` | Borde de cabecera |
| Oro suave | `#B7A658` | Marco del logo |

Los fondos marfil y blancos mantienen las pantallas ligeras. Las tintas derivadas de azul y oro permiten jerarquías coherentes: el oro original se reserva para superficies y detalles; los textos pequeños sobre blanco usan tonos de oro más oscuros. Los botones dorados usan texto azul oscuro y los degradados se mantienen claros.

Contraste de los pares principales: blanco sobre azul corporativo 7,81:1; azul oscuro sobre dorado 6,85:1; texto oro oscuro sobre blanco 5,39:1. El foco combina contorno azul con un halo blanco para distinguirse también sobre paneles oscuros. Estas comprobaciones no constituyen una auditoría integral de accesibilidad.

Los mensajes de error, documento vencido, advertencia y operación correcta conservan sus colores semánticos. El logo oficial y los documentos Word no se modifican. Los acentos de marca se definen con tokens `brand` en `src/index.css`, separados de los colores de estado.

Verificado con compilación, TypeScript y cinco recorridos de navegador, incluidos el flujo completo hasta descargar e inspeccionar el Word y la navegación a 375, 768, 1024 y 1440 px. Se revisan visualmente capturas móviles y de escritorio.
