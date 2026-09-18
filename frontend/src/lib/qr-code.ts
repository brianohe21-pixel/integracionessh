export function buildQrImageUrl(data: string, size = 200): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}
