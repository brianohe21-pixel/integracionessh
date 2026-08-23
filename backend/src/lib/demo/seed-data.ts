const FIRST_NAMES = [
  "Laura",
  "Carlos",
  "María",
  "Andrés",
  "Sofía",
  "Diego",
  "Valentina",
  "Juan",
  "Camila",
  "Felipe",
  "Daniela",
  "Santiago",
  "Isabella",
  "Mateo",
  "Paula",
  "Nicolás",
  "Andrea",
  "Sebastián",
  "Juliana",
  "Tomás",
];

const LAST_NAMES = [
  "Gómez",
  "Ruiz",
  "López",
  "Pérez",
  "Torres",
  "Ramírez",
  "Vargas",
  "Castro",
  "Mendoza",
  "Herrera",
  "Rojas",
  "Silva",
  "Morales",
  "Ortiz",
  "Navarro",
];

const CONTACT_TAGS = [
  ["vip"],
  ["nuevo"],
  ["recurrente"],
  ["oferta"],
  ["soporte"],
  ["mayorista"],
  ["ecommerce"],
  ["retail"],
  ["newsletter"],
  ["reactivacion"],
];

const USER_MESSAGES = [
  "Hola, quiero información sobre sus productos.",
  "¿Tienen envío gratis hoy?",
  "Necesito rastrear mi pedido #45821.",
  "¿Cuál es el horario de atención?",
  "Quiero hablar con un asesor humano.",
  "¿Tienen descuento para compras al por mayor?",
  "Me interesa el plan enterprise.",
  "¿Pueden enviarme el catálogo completo?",
  "Tengo un problema con mi última compra.",
  "¿Aceptan pagos con tarjeta?",
];

const ASSISTANT_MESSAGES = [
  "Con gusto te ayudo. Tenemos ofertas de hasta 30% esta semana.",
  "Sí, el envío es gratis en compras superiores a $150.000.",
  "Estoy revisando tu pedido, en un momento te confirmo el estado.",
  "Atendemos de lunes a sábado de 8:00 a.m. a 8:00 p.m.",
  "Te conecto con un asesor para ayudarte de inmediato.",
  "Para compras mayoristas tenemos tarifas especiales. ¿Cuántas unidades necesitas?",
  "El plan enterprise incluye voz, contact center y automatizaciones avanzadas.",
  "Aquí tienes el catálogo destacado de NovaRetail.",
  "Lamento el inconveniente. Voy a escalar tu caso con prioridad.",
  "Sí, aceptamos tarjeta, PSE y pagos en línea.",
];

const ADVISOR_MESSAGES = [
  "Hola, soy tu asesor. Revisé tu caso y ya tengo una solución.",
  "Te comparto la cotización actualizada en este momento.",
  "Quedó agendado el seguimiento para mañana a las 10:00 a.m.",
  "Confirmo que tu pedido saldrá hoy en la tarde.",
];

const OPPORTUNITY_TITLES = [
  "Pedido corporativo Q1",
  "Renovación plan anual",
  "Implementación omnicanal",
  "Licencias enterprise",
  "Soporte premium",
  "Campaña Black Friday",
  "Integración CRM",
  "Prueba piloto",
  "Expansión regional",
  "Renovación contrato",
  "Upsell contact center",
  "Migración WhatsApp API",
];

const CAMPAIGN_NAMES = [
  "Promoción invierno",
  "Lanzamiento colección",
  "Reactivación clientes",
  "Cyber Monday",
  "Encuesta satisfacción",
  "Catálogo primavera",
];

const BULK_JOB_TEMPLATES = [
  "catalogo_novedades",
  "promo_invierno",
  "recordatorio_carrito",
  "bienvenida_clientes",
  "oferta_flash",
  "encuesta_nps",
  "lanzamiento_producto",
  "seguimiento_cotizacion",
];

const AUTOMATION_NAMES = [
  "Saludo primer mensaje",
  "Handoff por palabra clave",
  "Recordatorio carrito abandonado",
  "Etiqueta cliente VIP",
  "Respuesta fuera de horario",
  "Seguimiento post compra",
];

const SALES_TASK_TITLES = [
  "Llamar para confirmar cotización",
  "Enviar propuesta comercial",
  "Agendar demo del producto",
  "Seguimiento negociación",
  "Validar datos de facturación",
  "Confirmar cierre del mes",
];

const MACRO_TITLES = [
  "Saludo inicial",
  "Estado de pedido",
  "Escalar a supervisor",
  "Despedida cordial",
];

export function demoPersonName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]!;
  return `${first} ${last}`;
}

export function demoContactTags(index: number): string[] {
  return CONTACT_TAGS[index % CONTACT_TAGS.length] ?? ["demo"];
}

export function demoUserMessage(index: number): string {
  return USER_MESSAGES[index % USER_MESSAGES.length]!;
}

export function demoAssistantMessage(index: number): string {
  return ASSISTANT_MESSAGES[index % ASSISTANT_MESSAGES.length]!;
}

export function demoAdvisorMessage(index: number): string {
  return ADVISOR_MESSAGES[index % ADVISOR_MESSAGES.length]!;
}

export function demoOpportunityTitle(index: number): string {
  return OPPORTUNITY_TITLES[index % OPPORTUNITY_TITLES.length]!;
}

export function demoCampaignName(index: number): string {
  return CAMPAIGN_NAMES[index % CAMPAIGN_NAMES.length]!;
}

export function demoBulkTemplate(index: number): string {
  return BULK_JOB_TEMPLATES[index % BULK_JOB_TEMPLATES.length]!;
}

export function demoAutomationName(index: number): string {
  return AUTOMATION_NAMES[index % AUTOMATION_NAMES.length]!;
}

export function demoSalesTaskTitle(index: number): string {
  return SALES_TASK_TITLES[index % SALES_TASK_TITLES.length]!;
}

export function demoMacroTitle(index: number): string {
  return MACRO_TITLES[index % MACRO_TITLES.length]!;
}

export const DEMO_EPOCH = new Date("2026-01-15T12:00:00.000Z");

export function daysAgo(days: number): string {
  const date = new Date(DEMO_EPOCH);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

export function hoursAgo(days: number, hours: number): string {
  const date = new Date(daysAgo(days));
  date.setUTCHours(date.getUTCHours() - hours);
  return date.toISOString();
}

export function minutesAgo(days: number, minutes: number): string {
  const date = new Date(daysAgo(days));
  date.setUTCMinutes(date.getUTCMinutes() - minutes);
  return date.toISOString();
}
