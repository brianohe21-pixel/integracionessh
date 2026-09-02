"use client";

import Image from "next/image";

interface ShortLinkQrProps {
  url: string;
  label: string;
}

function buildQrImageUrl(url: string, size = 200): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: url,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
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
      <Image
        src={qrUrl}
        alt={label}
        width={160}
        height={160}
        unoptimized
        className="rounded-lg border border-default bg-white p-2"
      />
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
