import {
  loadPlatformInlineAttachments,
  platformLogoSrc,
  platformSocialIconSrc,
  usesInlinePlatformAssets,
} from "./platform-assets.js";

describe("platform email assets", () => {
  const originalLogoUrl = process.env.PLATFORM_EMAIL_LOGO_URL;
  const originalAssetsBaseUrl = process.env.PLATFORM_EMAIL_ASSETS_BASE_URL;

  afterEach(() => {
    if (originalLogoUrl === undefined) {
      delete process.env.PLATFORM_EMAIL_LOGO_URL;
    } else {
      process.env.PLATFORM_EMAIL_LOGO_URL = originalLogoUrl;
    }
    if (originalAssetsBaseUrl === undefined) {
      delete process.env.PLATFORM_EMAIL_ASSETS_BASE_URL;
    } else {
      process.env.PLATFORM_EMAIL_ASSETS_BASE_URL = originalAssetsBaseUrl;
    }
  });

  it("uses inline cid assets by default", () => {
    delete process.env.PLATFORM_EMAIL_LOGO_URL;
    delete process.env.PLATFORM_EMAIL_ASSETS_BASE_URL;

    expect(usesInlinePlatformAssets()).toBe(true);
    expect(platformLogoSrc()).toBe("cid:platform-logo");
    expect(platformSocialIconSrc("facebook")).toBe("cid:platform-social-facebook");
  });

  it("loads inline attachments from local assets directory", () => {
    const attachments = loadPlatformInlineAttachments();

    expect(attachments).toHaveLength(4);
    expect(attachments.map((attachment) => attachment.cid)).toEqual([
      "platform-logo",
      "platform-social-facebook",
      "platform-social-instagram",
      "platform-social-tiktok",
    ]);
    expect(attachments.every((attachment) => attachment.data.length > 0)).toBe(true);
  });

  it("uses configured external asset urls when provided", () => {
    process.env.PLATFORM_EMAIL_LOGO_URL = "https://cdn.example.com/logo.jpg";
    process.env.PLATFORM_EMAIL_ASSETS_BASE_URL = "https://cdn.example.com/brand";

    expect(usesInlinePlatformAssets()).toBe(false);
    expect(platformLogoSrc()).toBe("https://cdn.example.com/logo.jpg");
    expect(platformSocialIconSrc("instagram")).toBe(
      "https://cdn.example.com/brand/icons/instagram-white-v3.png"
    );
  });
});
