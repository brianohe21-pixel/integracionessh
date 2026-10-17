import { buildInteractiveListPayload } from "./flows.js";

describe("buildInteractiveListPayload", () => {
  it("builds a WhatsApp list interactive payload with descriptions", () => {
    const body = buildInteractiveListPayload({
      phoneNumberId: "123",
      to: "+573001112233",
      accessToken: "token",
      bodyText: "¿Cómo te podemos ayudar?",
      buttonText: "Opciones",
      sectionTitle: "Menú",
      headerText: "Sistecredito",
      footerText: "Toca un elemento",
      rows: [
        {
          id: "client",
          title: "Soy un cliente",
          description: "Consulta tu saldo, pagos y más.",
        },
        {
          id: "credit",
          title: "Solicitar mi crédito",
          description: "Solicita tu cupo solo con tu cédula.",
        },
      ],
    });

    expect(body.type).toBe("interactive");
    expect(body.interactive).toMatchObject({
      type: "list",
      body: { text: "¿Cómo te podemos ayudar?" },
      header: { type: "text", text: "Sistecredito" },
      footer: { text: "Toca un elemento" },
      action: {
        button: "Opciones",
        sections: [
          {
            title: "Menú",
            rows: [
              {
                id: "client",
                title: "Soy un cliente",
                description: "Consulta tu saldo, pagos y más.",
              },
              {
                id: "credit",
                title: "Solicitar mi crédito",
                description: "Solicita tu cupo solo con tu cédula.",
              },
            ],
          },
        ],
      },
    });
  });

  it("truncates fields to WhatsApp limits and caps rows at 10", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `row-${i}-${"x".repeat(250)}`,
      title: "T".repeat(40),
      description: "D".repeat(100),
    }));
    const body = buildInteractiveListPayload({
      phoneNumberId: "123",
      to: "573001112233",
      accessToken: "token",
      bodyText: "B".repeat(1100),
      buttonText: "ButtonTooLongForWhatsApp",
      rows,
    });
    const interactive = body.interactive as {
      body: { text: string };
      action: { button: string; sections: Array<{ rows: Array<{ id: string; title: string; description?: string }> }> };
    };
    expect(interactive.body.text).toHaveLength(1024);
    expect(interactive.action.button).toHaveLength(20);
    expect(interactive.action.sections[0].rows).toHaveLength(10);
    expect(interactive.action.sections[0].rows[0].id).toHaveLength(200);
    expect(interactive.action.sections[0].rows[0].title).toHaveLength(24);
    expect(interactive.action.sections[0].rows[0].description).toHaveLength(72);
  });
});
