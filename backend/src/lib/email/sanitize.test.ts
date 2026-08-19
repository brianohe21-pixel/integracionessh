import { sanitizeEmailHtml, stripHtmlToText } from "./sanitize.js";

describe("sanitizeEmailHtml", () => {
  it("removes scripts and keeps basic formatting", () => {
    const html = '<p>Hello</p><script>alert(1)</script><strong>World</strong>';
    const sanitized = sanitizeEmailHtml(html);
    expect(sanitized).toContain("<p>Hello</p>");
    expect(sanitized).toContain("<strong>World</strong>");
    expect(sanitized).not.toContain("script");
  });
});

describe("stripHtmlToText", () => {
  it("converts html to plain text", () => {
    expect(stripHtmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
});
