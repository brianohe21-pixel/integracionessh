import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderCommercialProposalPdf } from "./lib/commercial-proposal-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function buildProposalNumber(quotationId) {
  const date = new Date();
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const shortId = quotationId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `COT-${ymd}-${shortId}`;
}

const now = new Date();
const validUntil = new Date(now);
validUntil.setDate(validUntil.getDate() + 15);

const quotationId = "constructora-wa-2026";
const proposalNumber = buildProposalNumber(quotationId);

async function readAsset(relativePath) {
  try {
    return await readFile(join(root, relativePath));
  } catch {
    return undefined;
  }
}

const logoBytes = await readAsset("scripts/assets/ish-logo.png");

const pdfBytes = await renderCommercialProposalPdf({
  logoBytes,
  branding: {
    brandName: "Integraciones Software & Hardware",
    tagline: "Conectamos - Integramos - Impulsamos",
    website: "integracionessh.lat",
    whatsapp: "322 311 7078",
    primaryColor: "#1a1a1a",
  },
  proposal: {
    number: proposalNumber,
    sentAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    clientName: "Constructora",
    clientTagline: "Comercialización de proyectos de vivienda y espacios",
    clientSector: "Construcción e inmobiliario",
    objective: "WhatsApp comercial para 4 asesores y paquete SMS opcional",
    coverSubtitle: "Canal WhatsApp, equipo comercial y continuidad por SMS",
    executiveSummary:
      "Integraciones Software & Hardware presenta una solución de ventas por WhatsApp Business para la constructora. El plan cubre a 4 asesores de ventas en un inbox compartido, con captura de leads, asignación, seguimiento de visitas y CRM. WhatsApp se cobra a tarifa Meta más $20 COP por mensaje (utilidad y marketing). El SMS es un canal adicional con precio final desde $12 COP, más IVA, y baja por volumen.",
    context:
      "En constructoras, el comprador llega por pauta, referidos o sala de ventas y espera respuesta inmediata. Si el lead no se atiende en minutos, se pierde la visita. Esta propuesta centraliza WhatsApp en un canal corporativo, reparte la conversación entre 4 asesores y refuerza citas y pagos con SMS, sin depender de celulares personales ni conversaciones sueltas.",
    solutionIntro:
      "La oferta combina la plataforma Plan Pro, WhatsApp Business para el equipo comercial y SMS opcional. WhatsApp se cobra a tarifa Meta más $20 COP. El SMS tiene precio final desde $12 COP, con descuento por volumen.",
    services: [
      {
        title: "WhatsApp Business corporativo",
        badge: "Canal principal",
        description:
          "Número oficial de la constructora, plantillas de Meta, catálogo de proyectos, envío de brochures y seguimiento de conversaciones en un solo panel. El cliente habla con la marca, no con el celular de cada asesor.",
      },
      {
        title: "Inbox para 4 asesores de ventas",
        badge: "Plan Pro",
        description:
          "Cuentas para 4 asesores y 1 administrador. Asignación de leads por proyecto o por turno, historial del contacto, supervisión de carga y SLA. Nadie se lleva la conversación al WhatsApp personal.",
      },
      {
        title: "Captura y calificación de leads",
        badge: "Incluido",
        description:
          "Bot y flujos para preguntar proyecto de interés, presupuesto, forma de pago y disponibilidad de visita. El lead calificado llega al asesor con contexto. Integrable con pauta Click to WhatsApp y formularios.",
      },
      {
        title: "CRM comercial y seguimiento",
        badge: "Incluido",
        description:
          "Contactos, leads, estados de oportunidad, recordatorios de visita y métricas de conversaciones. El director comercial ve volumen, tiempos de respuesta y desempeño por asesor.",
      },
      {
        title: "Plan Pro de plataforma",
        badge: "$815.900 COP/mes",
        description:
          "5 bots, 10.000 respuestas con IA al mes, 10.000 contactos, 10 campañas, base de conocimiento y marca personalizable. Equivale a USD 199/mes. Cubre al equipo de 4 asesores sin cobro extra por puesto.",
      },
      {
        title: "WhatsApp: tarifa Meta + $20 COP",
        badge: "Por consumo",
        description:
          "Cada mensaje se cobra a la tarifa vigente de Meta más $20 COP de comisión de plataforma. Aplica para utilidad (visitas, seguimientos, documentos) y marketing (lanzamientos y campañas).",
      },
      {
        title: "SMS a precio final por volumen",
        badge: "Adicional",
        description:
          "Canal opcional para visitas, cuotas, disponibilidad y respaldo si no leen WhatsApp. El precio final comienza en $12 COP por SMS y baja cuando aumenta el volumen mensual. Se factura más IVA.",
      },
    ],
    benefits: [
      "Respuesta inmediata al interesado, 24/7 en la primera atención y con handoff al asesor.",
      "Los 4 asesores trabajan sobre el mismo número corporativo, con historial y sin perder leads.",
      "La sala de ventas agenda visitas y confirma asistencia por WhatsApp y SMS.",
      "El director comercial ve carga, tiempos de respuesta y conversiones por proyecto.",
      "El SMS llega aunque el cliente no tenga WhatsApp activo o no abra la conversación.",
      "Se deja de usar líneas personales, con menor riesgo de perder la relación al rotar asesores.",
      "Campañas de lanzamiento, disponibilidad y reactivación de bases antiguas en un solo panel.",
    ],
    scope: [
      "Alta de WhatsApp Business API y configuración del número corporativo.",
      "Creación de 4 asesores de ventas y 1 administrador, con reglas de asignación.",
      "Flujos de calificación: proyecto, presupuesto, visita a sala de ventas y entrega de información.",
      "Hasta 8 plantillas WhatsApp (bienvenida, visita, brochure, seguimiento, disponibilidad y utilidad).",
      "Carga inicial de contactos y capacitación de 2 horas al equipo comercial.",
      "Tablero de conversaciones, contactos, leads y métricas para supervisión.",
      "Activación del canal SMS con 4 plantillas (visita, recordatorio, cuota y disponibilidad).",
      "Soporte de acompañamiento durante el primer mes de operación.",
    ],
    investmentIntro:
      "La inversión fija cubre la puesta en marcha y el Plan Pro. WhatsApp y SMS se facturan por consumo real al cierre de cada mes.",
    excludedCostsIntro:
      "Los siguientes costos corren por cuenta de la constructora y no están incluidos en los valores de esta propuesta:",
    excludedCosts: [
      "Pauta digital (Meta Ads, Google Ads u otros) y producción de piezas publicitarias.",
      "Compra, portabilidad o mensualidad del número telefónico ante el operador, si aplica.",
      "Desarrollos a la medida, integraciones con ERP/CRM propios o reportes no descritos.",
      "Fotografía, renders, brochures o contenido comercial de los proyectos.",
      "Variaciones de tarifa publicadas por Meta.",
    ],
    pricingRows: [
      {
        concept: "Implementación WhatsApp + equipo comercial",
        type: "Único",
        value: "$800.000 COP",
        highlight: true,
      },
      {
        concept: "Plan Pro (4 asesores + administrador)",
        type: "Mensual",
        value: "$815.900 COP",
        highlight: true,
      },
      {
        concept: "WhatsApp (Meta + $20 COP)",
        type: "Consumo",
        value: "Utilidad $23.28 / Marketing $71.25",
        highlight: true,
      },
      {
        concept: "SMS precio final + IVA",
        type: "Consumo",
        value: "Desde $12 COP",
        highlight: true,
      },
    ],
    initialInvestmentLabel: "$800.000 COP",
    recurringPlanLabel: "Plan Pro (plataforma)",
    recurringPlanValue: "$815.900 COP/mes",
    recurringPlanNote: "No incluye consumo de WhatsApp ni SMS",
    recurringNote:
      "El Plan Pro se factura por adelantado cada 30 días. WhatsApp y SMS se liquidan al cierre del mes según consumo real.",
    volumeTables: [
      {
        title: "WhatsApp: utilidad y marketing",
        intro:
          "Precio final por mensaje = tarifa Meta Colombia más $20 COP de comisión. TRM de referencia: 4.100. Meta puede actualizar tarifas; se factura la vigente al momento del envío.",
        headers: ["Categoría", "Tarifa Meta", "Comisión", "Precio final"],
        widths: [0.24, 0.28, 0.22, 0.26],
        rows: [
          ["Utilidad", "USD 0,0008 ($3.28)", "$20 COP", "$23.28 COP"],
          ["Marketing", "USD 0,0125 ($51.25)", "$20 COP", "$71.25 COP"],
        ],
        note: "Utilidad: visitas, recordatorios y seguimiento. Marketing: lanzamientos, disponibilidad y campañas. Hasta el 30 sep 2026 el mensaje de servicio en ventana 24 h no tiene tarifa Meta; si aplica, el precio es solo la comisión de $20 COP.",
      },
      {
        title: "SMS: precio final por volumen",
        intro:
          "Precio final por SMS enviado, según volumen del mes. Al valor de la tabla se suma IVA del 19%. Una constructora con 4 asesores opera normalmente en el primer tramo.",
        headers: ["Volumen mensual", "Precio final"],
        widths: [0.62, 0.38],
        rows: [
          ["0 a 500.000 SMS", "$12.00 COP"],
          ["500.000 a 1.000.000 SMS", "$11.50 COP"],
          ["1.000.000 a 1.500.000 SMS", "$11.00 COP"],
          ["1.500.001 a 2.000.000 SMS", "$10.50 COP"],
          ["2.000.001 a 2.500.000 SMS", "$10.00 COP"],
          ["Más de 3.000.000 SMS", "$9.50 COP"],
        ],
        note: "El IVA se factura sobre el precio final. Ejemplo primer tramo: 2.000 SMS x $12.00 = $24.000 COP + IVA.",
      },
    ],
    terms: [
      "Forma de pago de la implementación: 50% al aceptar la propuesta y 50% al activar el canal y capacitar al equipo.",
      "Plan Pro: facturación mensual anticipada de $815.900 COP (USD 199).",
      "WhatsApp: tarifa Meta vigente más $20 COP por mensaje, según categoría utilidad o marketing.",
      "SMS: precio final de la tabla de volumen más IVA del 19%. El canal SMS es opcional.",
      "El tramo de SMS se calcula con el volumen del mes en curso y no es retroactivo sobre meses anteriores.",
      "Validez de la propuesta: 15 días calendario desde la fecha de emisión.",
      "Tiempo estimado de puesta en marcha: 7 a 10 días hábiles tras el anticipo y la entrega de accesos de Meta.",
      "Alcance adicional (más asesores, integraciones o flujos extra) se cotiza por separado.",
      "Los precios fijos no incluyen IVA. El IVA del SMS se factura sobre el precio final del mensaje.",
    ],
    nextSteps: [
      "Revisar y aprobar esta propuesta comercial.",
      "Confirmar aceptación, definir el número de WhatsApp y realizar el anticipo del 50%.",
      "Crear o vincular la cuenta de Meta Business y el WhatsApp Business de la constructora.",
      "Cargar proyectos, asesores y reglas de asignación; configurar plantillas WhatsApp y SMS.",
      "Capacitar a los 4 asesores y activar el canal en producción.",
    ],
    closingTitle: "Listos para ordenar las ventas por WhatsApp",
    legalNote:
      "Documento comercial sin validez fiscal. Los precios fijos no incluyen IVA salvo indicación expresa. WhatsApp se liquida como tarifa Meta más $20 COP. El SMS se factura al precio final de la tabla más IVA del 19%. Sujeto a aprobación de Meta para WhatsApp Business API y a disponibilidad de la red SMS.",
    signatory: {
      name: "Brayan Riaño",
      title: "Integraciones Software & Hardware",
    },
  },
});

const outputPath = join(root, "oferta-whatsapp-constructora.pdf");
await writeFile(outputPath, pdfBytes);

console.log(`PDF generado: ${outputPath}`);
console.log(`Numero: ${proposalNumber}`);
console.log("Inversion inicial: $800.000 COP");
console.log("Recurrente: $815.900 COP/mes + consumo WhatsApp y SMS");
