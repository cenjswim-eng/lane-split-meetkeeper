# Idioma automático: español e inglés

## Resultado
La app ofrecerá español e inglés, elegirá el idioma al ingresar y permitirá cambiarlo manualmente. La traducción abarcará la portada y los paneles internos, no solo el menú.

## Detección y privacidad
1. Respetar primero una elección manual guardada para la cuenta o el dispositivo.
2. Si no existe una elección, usar el idioma preferido del navegador cuando sea español o inglés.
3. Usar el país aproximado únicamente como señal secundaria, si el alojamiento lo facilita; no solicitar GPS ni enviar la dirección IP a servicios externos.
4. Si no hay una señal compatible, mantener español. La ubicación no permite conocer con certeza el idioma nativo y puede variar por viajes o VPN.
5. Ofrecer siempre un selector «Español / English», también antes de iniciar sesión.

## Implementación por prioridad
1. **Base y selector:** detección automática, selección manual persistente, idioma del documento y soporte de traducciones compartido.
2. **Entrada y cuenta:** portada, WhatsApp comercial, inicio de sesión, solicitudes de acceso, navegación, perfil y mensajes de acceso suspendido o pendiente.
3. **Paneles deportivos:** resumen, atletas y fichas, club, competencias, inscripciones, importaciones, mínimas, categorías, relevos y reportes; incluir formularios, avisos y confirmaciones.
4. **Salidas:** etiquetas de PDF y Excel, resúmenes compartidos y mensajes propios de la app. Mantener intactos formatos Hy-Tek, códigos, nombres importados y datos oficiales. Mantener correos transaccionales actuales en español en esta entrega.
5. **Verificación:** recorrer las pantallas en ambos idiomas, comprobar cambio y persistencia, acceso autenticado, exportaciones y presentación en teléfono y computadora.

## Límites que se preservan
- No modificar edades, categorías, mínimas, resultados, permisos ni aislamiento de cuentas según el país.
- No traducir nombres de personas, clubes, competencias ni categorías personalizadas.
- No usar IA de pago ni consumir créditos para traducir durante el uso de la app.
- Mantener la marca y compatibilidad con Meet Manager y Team Manager.

## Detalles técnicos
- Catálogos de mensajes español/inglés en el código y proveedor de idioma compatible con TanStack Start; no sustituir texto manipulando la página ya dibujada.
- Resolver idioma inicial en una función de servidor pública que solo lea preferencias y señales de idioma, sin devolver IP ni información privada. Mantener el mismo idioma al dibujar la página y al activarla en el navegador.
- Preferencia de cuenta opcional en los ajustes existentes, conservando sus protecciones; cookie de preferencia para visitas sin sesión.
- Leer país únicamente de metadatos del alojamiento cuando existan; su ausencia no bloquea la app.
- Parametrizar textos y formatos de fecha de presentación sin cambiar cálculos deportivos ni almacenamiento en milisegundos.
- Pruebas de prioridad de selección, detección español/inglés, ausencia de ubicación, preferencia manual y persistencia entre sesiones.