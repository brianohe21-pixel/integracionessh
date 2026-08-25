function platformWebsiteUrl(): string {
  return (process.env.FRONTEND_URL ?? "https://app.integracionessh.lat").replace(/\/$/, "");
}

export function platformEmailAssetsBaseUrl(): string {
  const configured = process.env.PLATFORM_EMAIL_ASSETS_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const bucket = process.env.MEDIA_BUCKET?.trim();
  const region = process.env.AWS_REGION ?? "us-east-1";
  if (bucket) {
    return `https://${bucket}.s3.${region}.amazonaws.com/platform/email`;
  }

  return `${platformWebsiteUrl()}/brand`;
}

export function platformLogoSrc(): string {
  const configured = process.env.PLATFORM_EMAIL_LOGO_URL?.trim();
  if (configured) return configured;
  return `${platformEmailAssetsBaseUrl()}/logo-white-v2.jpg`;
}

export function platformSocialIconSrc(
  id: "facebook" | "instagram" | "tiktok"
): string {
  return `${platformEmailAssetsBaseUrl()}/icons/${id}-white-v3.png`;
}
