# Acceso público por enlace

La aplicación abre directamente sin cuentas, contraseñas ni gestión de usuarios. Clientes, plantillas e historial se comparten entre todos los visitantes. Cualquier visitante puede crear y editar datos, archivar clientes/plantillas y editar o eliminar registros del historial. Los archivos históricos se conservan sin permisos públicos de sobrescritura o borrado.

## Activación

1. Conserva un respaldo administrativo del proyecto antes de cambiar permisos.
2. Si ambas migraciones nuevas siguen pendientes, puedes ejecutar [SUPABASE_PUBLIC_ACCESS.sql](SUPABASE_PUBLIC_ACCESS.sql) en el [editor SQL del proyecto](https://supabase.com/dashboard/project/fipcnxfxxngdjunrlbat/sql/new). Este archivo crea también el esquema inicial si todas sus tablas están ausentes y reúne ambas migraciones nuevas; ejecútalo una sola vez después de guardar el respaldo. Si alguna ya se aplicó, ejecuta únicamente la restante. Aplica todas las migraciones en orden, incluida `20261007000100_pl_integrity_and_files.sql` y después `20261007000200_pl_public_workspace.sql`. Esta última agrega las funciones públicas y acceso a los archivos del bucket `para-legal-private`, incluidos los existentes. No modifica los permisos de otras aplicaciones ni las cuentas de Auth.
3. Ejecuta `pnpm check:deployment`: requiere esquema **3**. Publica el frontend después de la migración.
4. Verifica desde dos navegadores sin sesión: clientes y plantillas compartidos, generación y descarga del documento original. No hace falta activar Anonymous Sign-ins ni actualizar la función de gestión de usuarios para esta versión.

El frontend usa siempre la clave pública sin recuperar sesiones antiguas. Las funciones `pl_public_*` proporcionan únicamente las operaciones del espacio documental. Cuentas, métricas por usuario, auditoría, restauraciones y respaldos no se habilitan para visitantes. Las nuevas plantillas se aprueban automáticamente.

Los botones de base de datos, usuarios, estadísticas por usuario, contraseña, MFA, cerrar sesión y versión HTML anterior fueron retirados. Los respaldos y restauraciones se administran fuera de la interfaz pública.

**El enlace no es una barrera de acceso:** los datos y archivos documentales también pueden consultarse por la API pública. El acceso compartido incluye los expedientes ya existentes en este proyecto. No publiques esta versión antes de aplicar la migración; ocultar el inicio de sesión por sí solo no cambia los permisos de Supabase.
