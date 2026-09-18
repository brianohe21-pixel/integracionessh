"use client";

import { QrCodeImage } from "@/components/ui/QrCodeImage";
import { buildQrImageUrl } from "@/lib/qr-code";

interface ShortLinkQrProps {
  url: string;
  label: string;
}

export function ShortLinkQr({ url, label }: ShortLinkQrProps) {
  const qrUrl = buildQrImageUrl(url);

  async function handleDownload() {
    const response = await fetch(qrUrl);
    if (!response.ok) return;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${label.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <QrCodeImage data={url} size={160} alt={label} />
      <button
        type="button"
        onClick={() => void handleDownload()}
        className="text-xs text-accent hover:underline"
      >
        PNG
      </button>
    </div>
  );
}
