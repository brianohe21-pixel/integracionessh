import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { InlineEmailAttachment } from "./platform-email-mime.js";

type PlatformSocialIconId = "facebook" | "instagram" | "tiktok";

type PlatformInlineAsset = {
  cid: string;
  fileName: string;
  contentType: string;
};

const PLATFORM_LOGO_ASSET: PlatformInlineAsset = {
  cid: "platform-logo",
  fileName: "logo-white-v2.jpg",
  contentType: "image/jpeg",
};

const PLATFORM_SOCIAL_ICON_ASSETS: Record<PlatformSocialIconId, PlatformInlineAsset> = {
  facebook: {
    cid: "platform-social-facebook",
    fileName: "icons/facebook-white-v3.png",
    contentType: "image/png",
  },
  instagram: {
    cid: "platform-social-instagram",
    fileName: "icons/instagram-white-v3.png",
    contentType: "image/png",
  },
  tiktok: {
    cid: "platform-social-tiktok",
    fileName: "icons/tiktok-white-v3.png",
    contentType: "image/png",
  },
};

function platformWebsiteUrl(): string {
  return (process.env.FRONTEND_URL ?? "https://app.integracionessh.lat").replace(/\/$/, "");
}

function resolveEmailAssetsDir(): string {
  const candidates = [
    path.join(process.cwd(), "src/lib/email/assets"),
    path.join(process.cwd(), "dist/email/assets"),
    path.join(process.cwd(), "email/assets"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, PLATFORM_LOGO_ASSET.fileName))) {
      return candidate;
    }
  }

  throw new Error("Platform email assets directory not found");
}

export function usesInlinePlatformAssets(): boolean {
  return (
    !process.env.PLATFORM_EMAIL_LOGO_URL?.trim() &&
    !process.env.PLATFORM_EMAIL_ASSETS_BASE_URL?.trim()
  );
}

export function platformEmailAssetsBaseUrl(): string {
  const configured = process.env.PLATFORM_EMAIL_ASSETS_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  return `${platformWebsiteUrl()}/brand`;
}

export function platformLogoSrc(): string {
  const configured = process.env.PLATFORM_EMAIL_LOGO_URL?.trim();
  if (configured) return configured;
  if (usesInlinePlatformAssets()) return `cid:${PLATFORM_LOGO_ASSET.cid}`;
  return `${platformEmailAssetsBaseUrl()}/logo-white-v2.jpg`;
}

export function platformSocialIconSrc(id: PlatformSocialIconId): string {
  if (usesInlinePlatformAssets()) return `cid:${PLATFORM_SOCIAL_ICON_ASSETS[id].cid}`;
  return `${platformEmailAssetsBaseUrl()}/icons/${id}-white-v3.png`;
}

export function loadPlatformInlineAttachments(): InlineEmailAttachment[] {
  const assetsDir = resolveEmailAssetsDir();
  const assets = [PLATFORM_LOGO_ASSET, ...Object.values(PLATFORM_SOCIAL_ICON_ASSETS)];

  return assets.map((asset) => ({
    cid: asset.cid,
    filename: path.basename(asset.fileName),
    contentType: asset.contentType,
    data: readFileSync(path.join(assetsDir, asset.fileName)),
  }));
}
