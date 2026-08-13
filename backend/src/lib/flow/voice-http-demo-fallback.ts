export function isDemoModeEnabled(variables: Record<string, string>): boolean {
  const value = variables.demo_mode?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes" || value === "si";
}

function readApiBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function shouldUseDemoFallback(
  demoMode: boolean,
  ok: boolean,
  body: unknown,
  toolName: string
): boolean {
  if (!demoMode) return false;
  if (!ok) return true;

  const record = readApiBody(body);
  if (!record) return false;
  if (record.success === false) return true;

  const data = record.data;
  if (toolName === "autocomplete_street" && Array.isArray(data) && data.length === 0) {
    return true;
  }

  const error = typeof record.error === "string" ? record.error.toLowerCase() : "";
  if (error.includes("not found") || error.includes("no encontr")) return true;

  return false;
}

function pickText(args: Record<string, unknown>, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function pickVariable(variables: Record<string, string>, key: string, fallback: string): string {
  const value = variables[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildDemoToolResponse(
  toolName: string,
  args: Record<string, unknown>,
  variables: Record<string, string> = {}
): Record<string, unknown> {
  const city = pickVariable(variables, "default_city", "Lima");
  const currency = pickVariable(variables, "default_currency", "PEN");
  const phoneCountryCode = pickVariable(variables, "default_phone_country_code", "51");
  const query = pickText(args, "q", "Javier Prado");
  const placeId = pickText(args, "place_id", "demo-place-001");
  const tripId = pickText(args, "trip_id", "9001");
  const customerId = pickText(
    args,
    "customer_id",
    pickVariable(variables, "default_customer_id", "demo-customer-001")
  );

  const demoDriver = {
    driver_name: "Juan Pérez",
    vehicle: {
      brand: "Toyota",
      model: "Corolla",
      color: "Amarillo",
      plate: "ABC-123",
    },
  };

  switch (toolName) {
    case "lookup_customer":
      return {
        success: true,
        demo: true,
        data: {
          id: customerId,
          name: "Cliente demostración",
          phone_country_code: pickText(args, "phone_country_code", phoneCountryCode),
          phone_number: pickText(args, "phone_number", "987654321"),
          active: true,
        },
      };
    case "autocomplete_street":
      return {
        success: true,
        demo: true,
        data: [
          {
            place_id: "demo-place-001",
            main_text: query,
            secondary_text: city,
          },
        ],
      };
    case "resolve_street":
      return {
        success: true,
        demo: true,
        data: {
          place_id: placeId,
          location: {
            lat: -12.0464,
            lng: -77.0428,
            main_text: query,
            secondary_text: city,
          },
        },
      };
    case "create_offer":
      return {
        success: true,
        demo: true,
        data: {
          offers: [
            {
              id: "demo-offer-001",
              company_id: pickVariable(variables, "company_id", "12345"),
              customer_id: customerId,
              price: 2850,
              currency,
              eta_minutes: 7,
              service_type: { id: 1, name: "Taxi estándar" },
            },
          ],
          payment_methods: [{ id: 1, code: "cash", name: "Efectivo" }],
        },
      };
    case "create_trip":
      return {
        success: true,
        demo: true,
        data: {
          id: 9001,
          status: "PENDING",
          customer_id: customerId,
          ...demoDriver,
          origin: {
            main_text: pickText(args, "origin_main_text", "Origen"),
            secondary_text: city,
          },
          destination: {
            main_text: pickText(args, "destination_main_text", "Destino"),
            secondary_text: city,
          },
        },
      };
    case "get_trip":
      return {
        success: true,
        demo: true,
        data: {
          id: Number(tripId) || 9001,
          status: "IN_PROGRESS",
          customer_id: customerId,
          ...demoDriver,
          origin: { main_text: "Plaza San Martín", secondary_text: "Centro" },
          destination: { main_text: "Larcomar", secondary_text: "Miraflores" },
        },
      };
    case "list_active_trips":
      return {
        success: true,
        demo: true,
        data: [
          {
            id: 9001,
            status: "IN_PROGRESS",
            customer_id: customerId,
            driver_name: demoDriver.driver_name,
            vehicle: demoDriver.vehicle,
          },
        ],
      };
    case "cancel_trip":
      return {
        success: true,
        demo: true,
        data: {
          id: Number(tripId) || 9001,
          status: "CANCELLED",
          customer_id: customerId,
        },
      };
    default:
      return {
        success: true,
        demo: true,
        data: { message: "Respuesta de demostración" },
      };
  }
}
