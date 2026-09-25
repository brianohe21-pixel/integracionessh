import type { Tenant } from "../../types/index.js";
import { extractEmailDomain, formatEmailFromAddress } from "./ses-domain.js";
import { platformLogoSrc, platformSocialIconSrc } from "./platform-assets.js";

const DEFAULT_BRAND_NAME = "Integraciones SSH";
const DEFAULT_PLATFORM_DOMAIN = "integracionessh.lat";
const DEFAULT_FACEBOOK_URL = "https://www.facebook.com/integracionessh";
const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/integracionessh";
const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/@integracionessh";

type PlatformSocialLink = {
  id: "facebook" | "instagram" | "tiktok";
  label: string;
  url: string;
};

function platformSocialLinks(): PlatformSocialLink[] {
  return [
    {
      id: "facebook",
      label: "Facebook",
      url: process.env.PLATFORM_EMAIL_FACEBOOK_URL?.trim() || DEFAULT_FACEBOOK_URL,
    },
    {
      id: "instagram",
      label: "Instagram",
      url: process.env.PLATFORM_EMAIL_INSTAGRAM_URL?.trim() || DEFAULT_INSTAGRAM_URL,
    },
    {
      id: "tiktok",
      label: "TikTok",
      url: process.env.PLATFORM_EMAIL_TIKTOK_URL?.trim() || DEFAULT_TIKTOK_URL,
    },
  ];
}

function renderPlatformFooterBrandHtml(brandName: string, websiteUrl: string): string {
  const logoSrc = escapeHtml(platformLogoSrc());
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px;">
    <tr>
      <td align="center" style="background-color:#0f1014;padding:10px 18px;border-radius:4px;">
        <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
          <img src="${logoSrc}" width="64" alt="${brandName}" style="display:block;border:0;outline:none;max-width:64px;width:64px;height:auto;" />
        </a>
      </td>
    </tr>
  </table>`;
}

function renderPlatformSocialLinksHtml(): string {
  const links = platformSocialLinks()
    .map(
      (link) => `<td style="padding:0 12px;">
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.label)}" style="text-decoration:none;display:inline-block;">
          <img src="${escapeHtml(platformSocialIconSrc(link.id))}" width="24" height="24" alt="${escapeHtml(link.label)}" style="display:block;border:0;outline:none;width:24px;height:24px;" />
        </a>
      </td>`
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px;">
    <tr>${links}</tr>
  </table>`;
}

function renderPlatformSocialLinksText(): string {
  return platformSocialLinks().map((link) => `${link.label}: ${link.url}`).join("\n");
}

function extractEmailAddress(from: string): string {
  const trimmed = from.trim();
  const match = /<([^>]+)>/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}

function platformBrandName(): string {
  return process.env.PLATFORM_EMAIL_BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

function platformWebsiteUrl(): string {
  return (process.env.FRONTEND_URL ?? "https://app.integracionessh.lat").replace(/\/$/, "");
}

function platformSupportEmail(): string {
  const configured = process.env.PLATFORM_EMAIL_SUPPORT?.trim();
  if (configured) return configured;
  const from = process.env.SES_FROM_EMAIL?.trim();
  const domain = from ? extractEmailDomain(from) : DEFAULT_PLATFORM_DOMAIN;
  return domain ? `ops@${domain}` : `ops@${DEFAULT_PLATFORM_DOMAIN}`;
}

export function shouldSkipPlatformEmailTemplate(tenant: Tenant | null | undefined): boolean {
  if (!tenant) return false;
  if (tenant.plan === "reseller" || tenant.tenantKind === "reseller") return true;
  if (tenant.tenantKind === "subaccount" || tenant.parentTenantId) return true;
  return false;
}

export function isPlatformEmailSender(from: string): boolean {
  const platformFrom = process.env.SES_FROM_EMAIL?.trim();
  if (!platformFrom) return false;

  const normalizedFrom = extractEmailAddress(from).toLowerCase();
  const normalizedPlatform = extractEmailAddress(platformFrom).toLowerCase();
  if (normalizedFrom === normalizedPlatform) return true;

  const platformDomain = extractEmailDomain(platformFrom);
  const fromDomain = extractEmailDomain(normalizedFrom);
  return platformDomain === DEFAULT_PLATFORM_DOMAIN && fromDomain === platformDomain;
}

export function resolvePlatformFromAddress(from: string): string {
  return formatEmailFromAddress(extractEmailAddress(from), platformBrandName());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return paragraphs || `<p style="margin:0;color:#1f2937;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

export function appendPlatformTextFooter(text: string): string {
  const brandName = platformBrandName();
  const websiteUrl = platformWebsiteUrl();
  const supportEmail = platformSupportEmail();
  const footer = [
    "",
    "---",
    brandName,
    websiteUrl,
    renderPlatformSocialLinksText(),
    `Este es un correo automatico. Si tienes dudas, escribenos a ${supportEmail}.`,
  ].join("\n");

  if (text.includes(footer)) return text;
  return `${text.trim()}\n${footer}`;
}

export function wrapPlatformEmailHtml(contentHtml: string): string {
  const brandName = escapeHtml(platformBrandName());
  const websiteUrl = escapeHtml(platformWebsiteUrl());
  const supportEmail = escapeHtml(platformSupportEmail());

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brandName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td align="center" bgcolor="#08090b" style="background-color:#08090b;padding:28px;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
                ${renderPlatformFooterBrandHtml(brandName, websiteUrl)}
                ${renderPlatformSocialLinksHtml()}
                <p style="margin:0 0 6px;color:#9ca3af;">Este es un correo automatico de <a href="${websiteUrl}" style="color:#ffffff;text-decoration:none;">${brandName}</a>.</p>
                <p style="margin:0;color:#9ca3af;">Si tienes dudas, escribenos a <a href="mailto:${supportEmail}" style="color:#ffffff;text-decoration:none;">${supportEmail}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function applyPlatformEmailTemplate(params: {
  text: string;
  html?: string;
}): { text: string; html: string } {
  const contentHtml = params.html?.trim() ? params.html : textToHtml(params.text);
  return {
    text: appendPlatformTextFooter(params.text),
    html: wrapPlatformEmailHtml(contentHtml),
  };
}
