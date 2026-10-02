# SQP PARA LEGAL

Escaneo local de identidades con Tesseract, revisión de datos y generación de plantillas Word. La web se publica en GitHub Pages; las cuentas y datos compartidos están en Supabase.

## Usuarios y permisos

| Perfil | Escaneo, clientes y plantillas | Historial, base de datos y HTML anterior | Gestión de datos protegidos | Usuarios y estadísticas |
|---|---|---|---|---|
| Usuario | Sí | No | No | No |
| Administrador | Sí | Solo consulta y descarga | No | No |
| Daryl Villa | Sí | Sí | Sí | Sí |

La cuenta principal es una identidad Auth existente, vinculada a un perfil `owner` en la base de datos. El nombre visible no concede permisos. Solo puede haber un propietario; la aplicación no puede degradarlo ni desactivarlo. Las cuentas desactivadas pierden acceso a datos inmediatamente por RLS; la interfaz revisa el perfil cada 20 segundos y al volver a la ventana.

Daryl administra usuarios desde **Usuarios**: habilita cuentas con contraseña inicial de al menos 12 caracteres, cambia nombres y roles y activa/desactiva accesos. Si el correo ya pertenece a Auth en el proyecto compartido, conserva su contraseña original. No se envían invitaciones automáticamente. Cada usuario puede cambiar su contraseña desde la cabecera.

## Publicación y primer acceso

1. Fusiona la propuesta después de revisar sus comprobaciones. GitHub Actions instala el lockfile, ejecuta TypeScript y las pruebas y publica la web.
2. Daryl inicia sesión con el correo de su cuenta principal y su contraseña existente de Supabase. No se crea ni publica una contraseña predeterminada.
3. En **Base de Datos**, Daryl puede migrar los datos del navegador anterior o importar un respaldo JSON. El proceso descarga primero los datos locales y confirma el reemplazo de los datos compartidos. Usa el mismo navegador donde estaban guardados. Los usuarios y las estadísticas se conservan.
4. La carga inicial del HTML antiguo, y cualquier reemplazo posterior, corresponde exclusivamente a Daryl desde **Base de Datos → Reemplazar archivo HTML anterior**. El archivo ya no se sirve como recurso público en el despliegue. Los administradores pueden descargarlo cuando Daryl lo cargue. El código histórico del repositorio público y las copias descargadas previamente siguen existiendo; esta versión no puede revocar esas copias.
5. Configura en Supabase **Authentication → URL Configuration** la URL de Para Legal entre las Redirect URLs permitidas, sin quitar las URLs de otras aplicaciones del proyecto. Es necesario para la recuperación por correo. Para desarrollo, añade `http://localhost:3000/`.

El proyecto Supabase reutilizado es SQP-Financing. Las nuevas tablas tienen el prefijo `pl_`; las tablas anteriores `sqp_` no se modifican. Auth es compartido, pero los perfiles, permisos y el almacenamiento de sesión de Para Legal son independientes. Una cuenta existente sin perfil activo `pl_profiles` no puede entrar.

## Uso semanal

Solo Daryl ve **Estadísticas**. El uso se mide por documentos generados y registrados correctamente, desde el lunes a las 00:00 hasta el siguiente lunes, hora de Panamá. La gráfica muestra documentos por día; el ranking divide los documentos de cada usuario entre el total semanal. Incluye semanas anteriores y usuarios con cero documentos. La fecha y el usuario se asignan en el servidor, los registros duplicados no suman dos veces, y borrar/restaurar historial no borra ni inventa actividad.

## Desarrollo

Requiere Node.js 22 o posterior y pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm start
```

Abre `http://localhost:3000`. El SDK usa únicamente una clave pública de Supabase en el navegador. La clave privilegiada permanece en la Edge Function `para-legal-users`; no la copies al frontend ni al repositorio.

El OCR funciona sin Gemini ni claves de IA. La primera carga necesita internet para descargar Tesseract y sus idiomas. El análisis de imagen se realiza en el navegador; al guardar, los datos del cliente, su imagen y los documentos generados se almacenan en Supabase con acceso por roles. No hay modo de escritura sin conexión: si falla la conexión, la app muestra el error.

## Base de datos y verificación

Las migraciones de `supabase/migrations` contienen las tablas, RLS, funciones de registro/restauración y contadores atómicos. La asignación inicial del propietario se realiza por una conexión administrativa contra la identidad Auth confirmada; nunca se asigna a partir de metadatos editables del usuario ni se incluye su correo en la migración.

`tests/database-permissions.sql` verifica los roles contra Supabase en una transacción que termina en rollback. Requiere la cuenta principal y otra identidad Auth sin perfil de Para Legal. Comprueba lectura restringida, rechazo de restauración, ausencia de escalado de roles, desactivación, registro idempotente, contadores, restauración y conservación de estadísticas.

Las pruebas de Node comprueban interfaz por roles, semanas y porcentajes, asignación de campos, generación Word y compatibilidad de respaldos locales. La compilación verifica frontend y servidor. El inicio de sesión completo debe verificarse con la contraseña privada del propietario; no se simuló una sesión real. La cámara y precisión OCR sobre documentos reales requieren pruebas en el dispositivo.

El asesor de seguridad no reportó fallos de RLS en las tablas nuevas. El proyecto ya tiene desactivada la protección contra contraseñas filtradas; habilítala desde Authentication si el plan lo permite. Consulta la [guía oficial de seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

