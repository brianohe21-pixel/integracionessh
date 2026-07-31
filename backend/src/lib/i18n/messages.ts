import type { BotLocale } from "./types.js";

const messages = {
  clientHandoff:
    "Un asesor te atenderá en breve. Puedes seguir escribiendo en este chat.",
  assistantUnavailable:
    "El asistente no está disponible en este momento. Configura tu API key de OpenAI en Ajustes.",
  chooseOption: "Elige una opción:",
  calendarUnavailable: "El calendario no está disponible en este momento.",
  catalogDefault: "Estos son nuestros productos disponibles:",
  orderConfirmationDefault: "¿Confirmas tu pedido?",
  catalogExploreDefault: "Explora nuestro catálogo y arma tu pedido.",
  catalogInactive: "El catálogo no está activo en este bot.",
  awaitOrderPrompt: "Agrega productos al carrito en WhatsApp y envía tu pedido cuando estés listo.",
  productsHeader: "Productos",
  catalogSection: "Catálogo",
  metaFlowCtaDefault: "Abrir formulario",
  paymentInvalidAmount: "El nodo de pago no tiene un monto válido configurado.",
  paymentDefault: "Pago",
  noAdvisorsAvailable:
    "En este momento no tenemos asesores disponibles. ¿Puedo ayudarte con algo más?",
  handoffRequestedReason: "El cliente solicitó un asesor",
  respondInSpanish: "Responde siempre en español.",
  respondInEnglish: "Always respond in English.",
  handoffToolInstruction:
    "Si el cliente necesita hablar con un asesor, usa la herramienta transfer_to_human.",
  transferToHumanDescription: "Transfiere la conversación a un asesor",
  transferToHumanReason: "Por qué el cliente necesita un asesor",
  calendarDateHint:
    "Si el cliente dijo mañana u otra fecha relativa, verifica que usaste la fecha correcta.",
  calendarTimeHint:
    "Si el cliente indica una hora, usa el startAt del slot coincidente en create_booking.",
  bookingCancelled: "Reserva cancelada. Puedes elegir otra fecha cuando quieras.",
  bookingNoDates: "No hay fechas disponibles por ahora.",
  bookingPickDate: "Elige una fecha para tu cita:",
  bookingNoSlots: "No hay horarios disponibles para esa fecha.",
  bookingPickSlot: "Elige un horario:",
  bookingConfirmYes: "Confirmar",
  bookingConfirmNo: "Cancelar",
  bookingPaymentLink: "Te enviamos un link de pago para confirmar la reserva.",
  bookingScheduledPrefix: "Tu cita fue agendada para",
  bookingScheduledPrefixEn: "Your appointment was scheduled for",
} as const;

const enMessages: Record<keyof typeof messages, string> = {
  clientHandoff:
    "An advisor will assist you shortly. You can keep writing in this chat.",
  assistantUnavailable:
    "The assistant is not available right now. Configure your OpenAI API key in Settings.",
  chooseOption: "Choose an option:",
  calendarUnavailable: "The calendar is not available at this time.",
  catalogDefault: "Here are our available products:",
  orderConfirmationDefault: "Do you confirm your order?",
  catalogExploreDefault: "Browse our catalog and build your order.",
  catalogInactive: "The catalog is not active on this bot.",
  awaitOrderPrompt: "Add products to your cart in WhatsApp and send your order when ready.",
  productsHeader: "Products",
  catalogSection: "Catalog",
  metaFlowCtaDefault: "Open form",
  paymentInvalidAmount: "The payment node does not have a valid amount configured.",
  paymentDefault: "Payment",
  noAdvisorsAvailable:
    "We don't have advisors available right now. Can I help you with anything else?",
  handoffRequestedReason: "The customer requested an advisor",
  respondInSpanish: "Responde siempre en español.",
  respondInEnglish: "Always respond in English.",
  handoffToolInstruction:
    "If the customer needs to speak with an advisor, use the transfer_to_human tool.",
  transferToHumanDescription: "Transfer the conversation to an advisor",
  transferToHumanReason: "Why the customer needs an advisor",
  calendarDateHint:
    "If the customer said tomorrow or another relative date, verify you used the correct date.",
  calendarTimeHint:
    "If the customer specifies a time, use the matching slot startAt in create_booking.",
  bookingCancelled: "Booking cancelled. You can choose another date whenever you want.",
  bookingNoDates: "No dates are available right now.",
  bookingPickDate: "Choose a date for your appointment:",
  bookingNoSlots: "No time slots are available for that date.",
  bookingPickSlot: "Choose a time:",
  bookingConfirmYes: "Confirm",
  bookingConfirmNo: "Cancel",
  bookingPaymentLink: "We sent you a payment link to confirm the booking.",
  bookingScheduledPrefix: "Tu cita fue agendada para",
  bookingScheduledPrefixEn: "Your appointment was scheduled for",
};

export type SystemMessageKey = keyof typeof messages;

export function getSystemMessage(key: SystemMessageKey, locale: BotLocale): string {
  if (locale === "en") return enMessages[key];
  return messages[key];
}
