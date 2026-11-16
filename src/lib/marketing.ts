import { z } from 'zod';
export const SITE_URL = 'https://swimlanecoach.app';
export const campaignSchema = z.object({ utm_source:z.string().max(100).optional(),utm_medium:z.string().max(100).optional(),utm_campaign:z.string().max(100).optional(),utm_term:z.string().max(100).optional(),utm_content:z.string().max(100).optional() });
export const contactSchema=z.object({name:z.string().trim().min(2).max(120),club:z.string().trim().min(2).max(160),country:z.string().trim().min(2).max(80),email:z.email().max(254),consent:z.literal(true),campaign:campaignSchema.default({})});
export function campaignFromSearch(search:string){const params=new URLSearchParams(search);return campaignSchema.parse(Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].flatMap(k=>{const v=params.get(k);return v?[[k,v.slice(0,100)]]:[]})));}
export const faq = [
 ['¿Qué archivos puedo importar?','Resultados HY3, SD3, CL2 y ZIP; configuración de eventos EV3/HYV; documentos Access Jet 4.0 (.mdb) y PDF. Revisa siempre la vista previa antes de confirmar. Un archivo de eventos no contiene los resultados de los atletas.'],
 ['¿Swim Lane Coach reemplaza Meet Manager?','Complementa el trabajo del entrenador con importación, seguimiento y reportes. Exporta inscripciones SD3 para revisarlas en Meet Manager; la aceptación del archivo se comprueba en ese programa. No es un producto oficial de Hy-Tek.'],
 ['¿Puedo probarlo sin registrarme?','Sí. La demo pública es gratuita, de solo lectura y usa exclusivamente datos ficticios. El acceso con datos de tu club requiere una cuenta aprobada.'],
 ['¿Cómo solicito acceso y pago?','Consulta los planes por WhatsApp, acuerda importe y medio de pago y crea tu cuenta. El dueño revisa la solicitud antes de activar el acceso. No hay cobro automático en esta página.'],
 ['¿Cuánto cuesta?','El precio, la duración y las condiciones se confirman directamente por WhatsApp según las necesidades del club.'],
 ['¿Las mínimas son oficiales?','Las mínimas oficiales proceden del documento que importa el entrenador. Puedes revisar las filas, registrar la fuente y vigencia y seleccionar la versión activa; no inventamos tiempos oficiales.'],
 ['¿Cómo se asigna la categoría?','Por la edad al 31 de diciembre del año de competencia, con categorías personalizables por cuenta. La comparación de mínimas también considera sexo, prueba, temporada y piscina.'],
 ['¿Son lo mismo puntos AQUA y puntos del torneo?','No. AQUA expresa la valoración de una marca; los puntos del torneo dependen de su sistema de premiación. La app distingue ambos y utiliza los puntos AQUA disponibles en los resultados.'],
 ['¿Puedo usarlo en el teléfono?','Sí. Puedes explorar fichas, generar y previsualizar PDF, descargar archivos o usar el menú de compartir del teléfono cuando esté disponible.'],
 ['¿Quién puede ver los registros y reportes?','Cada cuenta accede a sus propios registros. Un reporte se comparte únicamente con confirmación del entrenador, mediante una copia seleccionada y un enlace con vigencia y revocación; quien lo reciba podrá leer esa copia.']
] as const;
export const testimonials: {name:string;club:string;quote:string;logo?:string}[]=[];
