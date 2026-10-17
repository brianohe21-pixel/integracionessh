import { describe, expect, it } from "@jest/globals";
import { formatApiUsageMessageContent } from "./usage-message-content.js";

describe("formatApiUsageMessageContent", () => {
  it("returns text content as-is", () => {
    expect(formatApiUsageMessageContent({ type: "text", text: "Hola" })).toBe("Hola");
  });

  it("serializes template name, language and components", () => {
    expect(
      formatApiUsageMessageContent({
        type: "template",
        template: {
          name: "finder_trade",
          language: "es",
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: "2026-10-16" }],
            },
          ],
        },
      })
    ).toBe(
      JSON.stringify({
        type: "template",
        name: "finder_trade",
        language: "es",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "2026-10-16" }],
          },
        ],
      })
    );
  });

  it("truncates long content", () => {
    const text = "a".repeat(5000);
    const result = formatApiUsageMessageContent({ type: "sms", text });
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBe(4001);
  });
});
