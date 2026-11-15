# Ampliación compatible con Hy-Tek

La portada ya incluye fotografía de natación, estadísticas ficticias identificadas y gráfica interactiva. Esta ampliación del adjunto se realizará por separado para conservar los registros y los paneles actuales.

## 1. Conservar y ampliar los registros existentes
- Reutilizar clubes, atletas, competencias, pruebas, inscripciones, resultados y parciales actuales; no crear copias paralelas.
- Añadir datos de torneo: sede, ciudad, carriles, límites individuales/relevos/totales, cuotas y puntuación por puesto.
- Añadir tipo, división y región de clubes, y condición independiente del atleta; conservar los datos existentes incompletos sin inventar fechas ni identificadores.
- Mantener códigos de club únicos por cuenta, no globales entre cuentas privadas.

## 2. Pruebas, inscripciones y relevos
- Ampliar las pruebas con sesión, modalidad de rondas, cuota y mínimas por piscina.
- Mantener las inscripciones separadas de resultados finales y parciales para no romper las exportaciones actuales.
- Incorporar piscina del tiempo de inscripción, exhibición, serie, carril y estados validados donde correspondan.
- Crear inscripciones de relevos con cuatro titulares y dos suplentes, letra del equipo y vínculo a prueba, club y competencia.
- Validar que pruebas y atletas pertenecen a la cuenta, que la prueba es de relevo y que no se repiten integrantes; comprobar coherencia de club y competencia.

## 3. Tiempos y edad
- Reutilizar la lectura existente de tiempos y agregar conversiones explícitas entre milisegundos enteros y centésimas, además de formato «NT» para inscripciones sin tiempo.
- Guardar todas las mínimas, tiempos de inscripción, finales y parciales en milisegundos enteros; cuotas y puntos pueden ser decimales.
- Añadir una función de edad exacta en una fecha de corte, con validación de fechas y sin depender de la zona horaria.
- Guardar la fecha de corte del torneo como dato adicional, sin sustituir automáticamente la regla vigente de categorías al 31 de diciembre. Su aplicación a categorías requerirá una decisión explícita posterior.

## 4. Verificación y entrega
- Probar tiempos, NT, redondeo a centésimas, cumpleaños, límites de pruebas y validación de relevos.
- Probar permisos con dos cuentas reales, rechazo de vínculos ajenos y conservación de importaciones/resultados existentes.
- Comprobar que las exportaciones individuales SD3/HY3 actuales no cambien ni incluyan finales por error.
- Esta etapa amplía la estructura y las funciones de cálculo del adjunto; no añade cobros, cronometraje en vivo ni nuevas pantallas de gestión de torneos.

## Detalles técnicos
- Migraciones aditivas sobre `clubs`, `athletes`, `meets`, `events`, `meet_entries` y `results`; nueva tabla `relay_entries` y, si es necesaria para titulares/suplentes, tabla de integrantes.
- Reutilizar `team_code`, `region_lsc`, `para_classification` y los códigos numéricos de estilo actuales mediante adaptación, evitando columnas redundantes para los nombres alternativos del adjunto.
- No crear `meet_events` ni `entries` que dupliquen `events` y `meet_entries`; no reunir inscripciones y resultados en una misma tabla.
- Propiedad mediante `owner_id`, inmutable, con permisos explícitos, RLS de administrador por cuenta y validación de relaciones. No añadir referencias nuevas a tablas administradas de autenticación.
- Conversiones y edad en funciones puras junto a las utilidades deportivas existentes, con pruebas unitarias y de aislamiento.
- No imponer de inmediato campos obligatorios ni longitudes que rechacen registros históricos; validar nuevos datos y conservar compatibilidad con la aplicación publicada.