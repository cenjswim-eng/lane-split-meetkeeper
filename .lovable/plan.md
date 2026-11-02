# Cerrar seguridad de dependencias y separación de datos por cuenta

## Estado verificado hoy
- **Dependencias:** el análisis actual no encuentra vulnerabilidades conocidas en las 65 dependencias de producción. Las detectadas antes (zod, seroval, js-yaml, source-map-js, entities) ya se corrigieron con las actualizaciones anteriores. No queda ninguna crítica ni alta.
- **Archivo .env:** solo contiene el identificador del proyecto, la dirección del servidor y la clave publicable (`sb_publishable_…`), que están hechas para usarse en el navegador. No contiene secretos: la clave de servicio no aparece.
- **Aislamiento en la base de datos:** las 12 tablas deportivas y del club tienen protección por filas activa, regla "solo registros propios" y guardia que impide cambiar o falsificar el dueño. Todos los registros actuales pertenecen al dueño (ninguno sin dueño).
- **Problema encontrado (prioridad 1):** la regla de los archivos privados del club está mal escrita. Compara el código del club con el *nombre del club* en lugar de con la carpeta del archivo. En la práctica bloquea subir, abrir y borrar documentos del club para **todas** las cuentas, incluido el dueño. No filtra datos, pero rompe "Mi club" y la limpieza de archivos al borrar.

## Pasos por prioridad

1. **Corregir la regla de archivos del club**
   - Reemplazar la regla para que compare la carpeta del archivo (`storage.objects.name`) con un club propio de quien la usa.
   - Riesgo: bajo. Los archivos ya guardados quedan visibles de nuevo solo para su dueño.

2. **Prueba de aislamiento con dos cuentas temporales** (sin tocar los datos del dueño)
   - Ejecutar la prueba existente de clubes privados: crea dos cuentas de prueba con correos `@example.com`. Cada una crea equipo, club, atleta con el mismo código, competencia, resultado, parcial, documento PDF e integrante.
   - Comprueba que cada cuenta ve solo lo suyo, que no puede leer, editar, insertar ni descargar lo ajeno, y que importar la misma competencia da registros distintos.
   - Comprueba también que "Borrar mis datos" en la cuenta A no afecta a la cuenta B.
   - Al final elimina solo las filas, archivos y cuentas de prueba, filtrando por su propio identificador. Nunca se borra nada del dueño.
   - Antes y después contaré los registros del dueño (atletas, competencias, resultados, clubes, documentos) para confirmar que no cambian.
   - Esta prueba necesita la clave de servicio del servidor. Si el entorno no la tiene, haré lo mismo creando las dos cuentas por el registro de la app y aprobándolas desde el panel del dueño.

3. **Revisión de rutas de importación y borrado**
   - Importación Hy-Tek, Access y documentos del club: confirmar que las búsquedas de atletas y competencias solo encuentran registros de la propia cuenta. Ya ocurre así por la protección de filas; lo confirmaré con la prueba del paso 2 importando el mismo archivo en las dos cuentas.
   - Borrado: confirmar que solo limpia las carpetas de los clubes propios.

4. **Seguridad general**
   - Repetir el análisis de dependencias y el de seguridad de la base de datos después del cambio. Marcar como resueltos los hallazgos que queden corregidos.
   - Actualizar la hoja de ruta: cerrar las tareas de "Separar por cuenta" y "Revisar seguridad".

## Detalles técnicos
- Nueva migración con `DROP POLICY "private club files" ON storage.objects` y una política nueva: `bucket_id='club-documents' AND has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.owner_id=auth.uid() AND c.id::text = split_part(storage.objects.name,'/',1))`. Va calificada explícitamente para evitar que `name` se resuelva a `clubs.name`.
- Se añade al test de integración una aserción positiva de subida y descarga del archivo propio. Ya existe en `private-clubs.integration.test.ts` y hoy fallaría.
- Las funciones de importación y borrado son SECURITY INVOKER, así que la protección de filas las limita a la cuenta que las llama.
