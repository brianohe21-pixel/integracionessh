"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface ShortLinkQrProps {
  url: string;
  label: string;
}

export function ShortLinkQr({ url, label }: ShortLinkQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    QRCode.toCanvas(canvas, url, { width: 160, margin: 1 }).catch((err: Error) => {
      setError(err.message);
    });
  }, [url]);

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${label.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    anchor.click();
  }

  if (error) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded-lg border border-default bg-white p-2" />
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
