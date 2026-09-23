import { buildWaMeLink, isWaMeCompatiblePhone } from "./wa-link.js";

describe("buildWaMeLink", () => {
  it("builds links for phone numbers", () => {
    expect(buildWaMeLink("+57 300 123 4567")).toBe("https://wa.me/573001234567");
    expect(buildWaMeLink("573001234567", "Hola")).toBe(
      "https://wa.me/573001234567?text=Hola"
    );
  });

  it("rejects BSUIDs", () => {
    expect(isWaMeCompatiblePhone("CO.2268328677295906")).toBe(false);
    expect(buildWaMeLink("CO.2268328677295906")).toBeNull();
  });
});
