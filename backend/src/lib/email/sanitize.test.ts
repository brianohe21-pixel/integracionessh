import { sanitizeEmailHtml, stripHtmlToText } from "./sanitize.js";

describe("sanitizeEmailHtml", () => {
  it("removes scripts and keeps basic formatting", () => {
    const html = '<p>Hello</p><script>alert(1)</script><strong>World</strong>';
    const sanitized = sanitizeEmailHtml(html);
    expect(sanitized).toContain("<p>Hello</p>");
    expect(sanitized).toContain("<strong>World</strong>");
    expect(sanitized).not.toContain("script");
  });

  it("styles links for email clients", () => {
    const sanitized = sanitizeEmailHtml('<a href="https://example.com">Ver más</a>');
    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).toContain("text-decoration:underline");
    expect(sanitized).toContain("color:#2563eb");
  });
});

describe("stripHtmlToText", () => {
  it("converts html to plain text", () => {
    expect(stripHtmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
});
