import { applyWhatsAppTextFormat } from "./whatsapp-text-format";

describe("applyWhatsAppTextFormat", () => {
  it("wraps selection with bold markers", () => {
    expect(applyWhatsAppTextFormat("hola mundo", 5, 10, "bold")).toEqual({
      text: "hola *mundo*",
      selectionStart: 6,
      selectionEnd: 11,
    });
  });

  it("unwraps bold when markers are already present", () => {
    expect(applyWhatsAppTextFormat("hola *mundo*", 5, 12, "bold")).toEqual({
      text: "hola mundo",
      selectionStart: 5,
      selectionEnd: 10,
    });
  });

  it("unwraps bold when markers sit outside the selection", () => {
    expect(applyWhatsAppTextFormat("hola *mundo*", 6, 11, "bold")).toEqual({
      text: "hola mundo",
      selectionStart: 5,
      selectionEnd: 10,
    });
  });

  it("applies monospace triple backticks", () => {
    expect(applyWhatsAppTextFormat("code", 0, 4, "monospace")).toEqual({
      text: "```code```",
      selectionStart: 3,
      selectionEnd: 7,
    });
  });

  it("prefixes lines as an ordered list", () => {
    expect(applyWhatsAppTextFormat("uno\ndos", 0, 7, "ordered")).toEqual({
      text: "1. uno\n2. dos",
      selectionStart: 0,
      selectionEnd: 13,
    });
  });

  it("toggles unordered list prefixes off", () => {
    expect(applyWhatsAppTextFormat("- uno\n- dos", 0, 11, "unordered")).toEqual({
      text: "uno\ndos",
      selectionStart: 0,
      selectionEnd: 7,
    });
  });

  it("prefixes a quote block", () => {
    expect(applyWhatsAppTextFormat("nota", 0, 4, "quote")).toEqual({
      text: "> nota",
      selectionStart: 0,
      selectionEnd: 6,
    });
  });
});
