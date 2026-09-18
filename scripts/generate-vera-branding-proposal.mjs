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

const quotationId = "vera-branding-2026";
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
    clientName: "Vera Global Solutions",
    clientTagline: "Soluciones integrales en aseo, agua e industriales",
    clientSector: "Aseo, agua e industria",
    objective: "Identidad de marca y aplicaciones corporativas",
    coverSubtitle: "Identidad visual y aplicaciones de marca",
    coverLogoMaxHeight: 148,
    executiveSummary:
      "Integraciones Software & Hardware presenta a Vera Global Solutions un paquete cerrado de identidad visual. El alcance cubre el diseño del logo y sus versiones, el manual de marca, papelería, uniformes y piezas para redes sociales, con archivos listos para producción e impresión. Toda la propuesta se entrega como un único proyecto de marca, con inversión fija de $1.000.000 COP.",
    context:
      "Vera Global Solutions opera en sectores de aseo, agua e insumos industriales, donde la confianza y la presentación profesional marcan la diferencia frente a competidores. Esta propuesta construye una identidad coherente para aplicar en tarjetas, uniformes, documentos y canales digitales, de modo que cada punto de contacto refuerce la misma marca.",
    solutionIntro:
      "El paquete reúne las piezas esenciales para lanzar o renovar la marca de Vera Global Solutions, con entregables de diseño listos para uso interno, impresión y publicación.",
    services: [
      {
        title: "Logo e identidad visual",
        badge: "Incluido",
        description:
          "Logo principal, isotipo, versiones horizontal y vertical, variantes en blanco y negro, y archivos finales en PNG, JPG, PDF y SVG para uso digital e impresión.",
      },
      {
        title: "Manual de identidad",
        badge: "Incluido",
        description:
          "Guía de marca con paleta de colores, tipografías, usos correctos e incorrectos, márgenes, tamaños mínimos y ejemplos de aplicación sobre fondos claros y oscuros.",
      },
      {
        title: "Tarjetas de presentación",
        badge: "Incluido",
        description:
          "Diseño de frente y reverso, medidas estándar de impresión, sangrado y archivo listo para imprenta en PDF de alta resolución.",
      },
      {
        title: "Camisetas y uniformes",
        badge: "Incluido",
        description:
          "Diseño de camiseta, ubicación del logo en frente y espalda, y mockup para visualizar el resultado antes de producir el uniforme.",
      },
      {
        title: "Papelería corporativa",
        badge: "Incluido",
        description:
          "Hoja membrete, firma de correo electrónico y sobre o documento corporativo, con versiones listas para imprimir y para uso digital.",
      },
      {
        title: "Kit de redes sociales",
        badge: "Incluido",
        description:
          "Foto de perfil, portada y plantilla básica para publicaciones, alineadas con la paleta, tipografía y estilo definidos en el manual.",
      },
    ],
    benefits: [
      "Una marca única, reconocible y profesional en todos los puntos de contacto.",
      "Archivos organizados y listos para imprimir, publicar o compartir con proveedores.",
      "Criterios claros de uso para que el equipo interno aplique la marca sin improvisar.",
      "Presencia coherente en papelería, uniformes y redes sociales desde el primer día.",
      "Ahorro de tiempo en futuras piezas, porque el sistema visual ya queda definido.",
      "Imagen alineada con el posicionamiento de Vera Global Solutions en aseo, agua e industria.",
    ],
    scope: [
      "Propuesta de logo con hasta 2 rondas de ajustes sobre el concepto aprobado.",
      "Logo principal, isotipo, versiones horizontal y vertical, y variantes en blanco y negro.",
      "Entrega de archivos en PNG, JPG, PDF y SVG.",
      "Manual de identidad: paleta, tipografías, usos correctos/incorrectos, márgenes y tamaños.",
      "Tarjeta de presentación frente y reverso, lista para impresión.",
      "Diseño de camiseta/uniforme con ubicación de logo frente/espalda y mockup de visualización.",
      "Hoja membrete, firma de correo y sobre o documento corporativo.",
      "Foto de perfil, portada y plantilla básica para publicaciones en redes sociales.",
      "Sesión de entrega digital con explicación de archivos y recomendaciones de uso.",
    ],
    investmentIntro:
      "El valor corresponde a un paquete cerrado de identidad de marca. Los montos por rubro son de referencia interna del paquete y no se comercializan por separado a estos precios.",
    excludedCostsIntro:
      "Los siguientes costos no hacen parte de esta oferta y, de requerirse, se cotizan o asumen por separado:",
    excludedCosts: [
      "Impresión física de tarjetas, hojas, sobres u otros materiales.",
      "Confección, bordado o producción de camisetas y uniformes (esta oferta cubre diseño y mockup).",
      "Registro de marca ante la SIC u otras entidades.",
      "Fotografía de producto, sesiones fotográficas o bancos de imagen de pago.",
      "Aplicaciones adicionales no descritas en esta propuesta.",
      "Pauta publicitaria en redes, buscadores u otros canales.",
      "Desarrollo web, hosting, dominio o papelería física extra.",
    ],
    pricingRows: [
      {
        concept: "Logo (isotipo, versiones y archivos)",
        type: "Único",
        value: "$350.000 COP",
        highlight: true,
      },
      {
        concept: "Manual de identidad",
        type: "Único",
        value: "$200.000 COP",
      },
      {
        concept: "Tarjetas de presentación",
        type: "Único",
        value: "$120.000 COP",
      },
      {
        concept: "Camisetas y uniformes",
        type: "Único",
        value: "$130.000 COP",
      },
      {
        concept: "Papelería corporativa",
        type: "Único",
        value: "$100.000 COP",
      },
      {
        concept: "Kit de redes sociales",
        type: "Único",
        value: "$100.000 COP",
      },
    ],
    initialInvestmentLabel: "$1.000.000 COP",
    terms: [
      "Paquete cerrado de identidad de marca por $1.000.000 COP.",
      "Forma de pago: 50% al aceptar la propuesta y 50% contra entrega de archivos finales.",
      "Validez de la propuesta: 15 días calendario desde la fecha de emisión.",
      "Incluye 2 rondas de ajustes sobre el concepto de logo aprobado.",
      "Tiempo estimado de entrega: 2 a 3 semanas después del anticipo y del brief inicial.",
      "Alcance adicional (piezas extra, animaciones, empaque u otras aplicaciones) se cotiza por separado.",
    ],
    nextSteps: [
      "Revisar y aprobar esta propuesta comercial.",
      "Confirmar aceptación y realizar el anticipo del 50%.",
      "Completar el brief de marca: referentes, colores, tono y usos prioritarios.",
      "Presentar propuesta de logo y definir el concepto a desarrollar.",
      "Producir manual, papelería, uniforme y kit digital, y entregar el paquete final.",
    ],
    closingTitle: "Listos para construir la identidad de su marca",
    legalNote:
      "Documento comercial sin validez fiscal. Los precios no incluyen IVA salvo indicación expresa. El alcance se limita a diseño y archivos digitales listos para producción; la impresión o confección física no está incluida.",
    signatory: {
      name: "Brayan Riaño",
      title: "Integraciones Software & Hardware",
    },
  },
});

const outputPath = join(root, "oferta-identidad-vera-global-solutions.pdf");
await writeFile(outputPath, pdfBytes);

console.log(`PDF generado: ${outputPath}`);
console.log(`Numero: ${proposalNumber}`);
console.log("Inversion: $1.000.000 COP");
