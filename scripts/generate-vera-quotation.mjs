import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildQuotationNumber } from "../backend/dist/lib/quotations/pdf.js";
import { renderCommercialProposalPdf } from "./lib/commercial-proposal-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const now = new Date();
const validUntil = new Date(now);
validUntil.setDate(validUntil.getDate() + 15);

const quotationId = "vera-global-2026";
const proposalNumber = buildQuotationNumber(quotationId);
const initialInvestmentCents = 100_000_000;

const logoPath = join(root, "scripts/assets/ish-logo.png");
let logoBytes;
try {
  logoBytes = await readFile(logoPath);
} catch {
  logoBytes = undefined;
}

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
    clientName: "Vera Global Solutions",
    clientTagline: "Soluciones integrales en aseo, agua e industriales",
    clientSector: "Aseo, agua e industria",
    objective: "Marketplace B2B, automatizacion comercial y presencia digital",
    executiveSummary:
      "Integraciones Software & Hardware presenta a Vera Global Solutions una propuesta integral para digitalizar sus ventas y la atencion al cliente. La solucion combina un marketplace B2B personalizado, la plataforma de automatizacion con inteligencia artificial, mensajeria por WhatsApp y presencia profesional en Facebook, permitiendo escalar operaciones comerciales con menor esfuerzo manual.",
    context:
      "Su empresa opera en sectores de alto volumen y demanda de respuesta rapida: aseo, agua e insumos industriales. Hoy sus clientes esperan cotizar, consultar disponibilidad y realizar pedidos por canales digitales. Esta propuesta responde a esa necesidad con una plataforma lista para vender, atender y dar seguimiento comercial de forma automatizada.",
    services: [
      {
        title: "Marketplace B2B a la medida",
        badge: "Desarrollo",
        description:
          "Catalogo digital de productos, carrito de compras, gestion de pedidos y pagos integrados con WhatsApp Commerce y pasarelas de pago de su preferencia. Panel de administracion para su equipo y capacitacion inicial de 2 horas.",
      },
      {
        title: "Plan Starter Integraciones Software & Hardware",
        badge: "USD 59/mes",
        description:
          "Plataforma en la nube con 2 bots, 2.000 respuestas con IA al mes, 60 minutos de voz, 2.000 contactos, 500 pedidos mensuales y hasta 2 catalogos activos.",
      },
      {
        title: "Automatizacion por WhatsApp",
        badge: "$30 COP/msg",
        description:
          "Atencion automatizada, confirmacion de pedidos, campañas y notificaciones. Precio por mensaje saliente segun consumo real, ideal para escalar sin costos fijos elevados.",
      },
      {
        title: "Facebook Business y pagina profesional",
        badge: "Cortesia",
        description:
          "Creacion de cuenta Business, configuracion de pagina con informacion de la empresa, imagen de portada y publicacion de bienvenida para fortalecer su presencia digital.",
      },
      {
        title: "Perfil de negocio en Google",
        badge: "Cortesia",
        description:
          "Creacion y configuracion del perfil en Google Business: datos de contacto, horarios, ubicacion, categoria del negocio e imagenes para aparecer en Google Maps y busquedas locales.",
      },
      {
        title: "SEO para busquedas integrales",
        badge: "Cortesia",
        description:
          "Optimizacion basica para busquedas en Google: palabras clave del sector, metadatos, descripciones de productos y estructura orientada a mejorar la visibilidad organica del marketplace.",
      },
    ],
    benefits: [
      "Centralice pedidos y consultas en un solo canal digital, reduciendo perdida de oportunidades.",
      "Atienda clientes 24/7 con respuestas inteligentes y derivacion a asesores cuando sea necesario.",
      "Exhiba su portafolio de productos de forma profesional y facil de actualizar.",
      "Fortalezca la confianza de marca con presencia en Facebook, Google y comunicacion coherente.",
      "Mejore su visibilidad en busquedas de Google con perfil de negocio y SEO basico incluidos.",
      "Escale ventas sin aumentar proporcionalmente el equipo de atencion.",
      "Obtenga metricas de conversaciones, pedidos y desempeno comercial en tiempo real.",
    ],
    scope: [
      "Carga inicial de hasta 50 productos en el marketplace.",
      "Flujos de pedido y confirmacion por WhatsApp.",
      "Configuracion de bots, catalogo y panel de administracion.",
      "Capacitacion basica al equipo (2 horas).",
      "Creacion de pagina de Facebook (cortesia).",
      "Creacion de perfil de negocio en Google (cortesia).",
      "SEO basico para busquedas integrales (cortesia).",
    ],
    excludedCostsIntro:
      "Los siguientes costos corren por cuenta de Vera Global Solutions y no estan incluidos en los valores de esta propuesta:",
    excludedCosts: [
      "Compra y renovacion anual del dominio web.",
      "Servicio de alojamiento (hosting) del marketplace y servicios asociados.",
      "Meta/WhatsApp Business API, numeracion telefonica y consumo de mensajes.",
      "Comisiones y tarifas de pasarelas de pago (Wompi, PayU, Stripe, etc.).",
      "Publicidad digital pagada (Google Ads, Meta Ads y similares).",
      "Certificados SSL, correos corporativos y otros servicios de terceros.",
      "Fotografia profesional, contenido o material grafico especializado.",
      "Cualquier otro costo operativo o licencia de terceros requerida para la operacion.",
    ],
    pricingRows: [
      {
        concept: "Marketplace B2B (desarrollo e implementacion)",
        type: "Unico",
        value: "$1.000.000 COP",
        highlight: true,
      },
      {
        concept: "Plan Starter Integraciones Software & Hardware",
        type: "Mensual",
        value: "USD 59",
        highlight: true,
      },
      {
        concept: "Facebook Business + pagina profesional",
        type: "Unico",
        value: "Cortesia",
      },
      {
        concept: "Perfil de negocio en Google",
        type: "Unico",
        value: "Cortesia",
      },
      {
        concept: "SEO para busquedas integrales",
        type: "Unico",
        value: "Cortesia",
      },
      {
        concept: "Mensajes WhatsApp",
        type: "Consumo",
        value: "$30 COP / mensaje",
      },
    ],
    initialInvestmentLabel: "$1.000.000 COP",
    recurringPlanLabel: "Plan Starter (mensual)",
    recurringPlanValue: "USD 59/mes",
    recurringPlanNote: "No incluido en la inversion inicial",
    recurringNote:
      "La suscripcion del Plan Starter (USD 59/mes) se factura por adelantado cada 30 dias. Los mensajes de WhatsApp se facturan segun consumo mensual. El total inicial corresponde unicamente al desarrollo del marketplace.",
    terms: [
      "Forma de pago del marketplace: 50% al aceptar la propuesta y 50% al entregar el proyecto.",
      "Plan Starter: facturacion mensual anticipada en USD 59.",
      "Validez de la propuesta: 15 dias calendario desde la fecha de emision.",
      "Alcance adicional (productos extra, integraciones o modulos) se cotiza por separado.",
      "Tiempos de entrega estimados: 3 a 4 semanas tras confirmacion y pago inicial.",
      "Soporte post-implementacion incluido durante el primer mes.",
    ],
    nextSteps: [
      "Revisar y aprobar esta propuesta comercial.",
      "Firmar aceptacion y realizar el anticipo del 50%.",
      "Levantamiento de requerimientos y definicion del catalogo inicial.",
      "Desarrollo, pruebas y capacitacion del equipo.",
      "Entrega del marketplace y activacion del Plan Starter.",
    ],
    signatory: {
      name: "Brayan Riaño",
      title: "Integraciones Software & Hardware",
    },
  },
});

const outputPath = join(root, "cotizacion-vera-global-solutions.pdf");
await writeFile(outputPath, pdfBytes);

console.log(`PDF generado: ${outputPath}`);
console.log(`Numero: ${proposalNumber}`);
console.log(
  `Inversion inicial: $${(initialInvestmentCents / 100).toLocaleString("es-CO")} COP + USD 59/mes`
);
