import { buildQrImageUrl } from "@/lib/qr-code";
import { cn } from "@/lib/utils";

interface QrCodeImageProps {
  data: string;
  size?: number;
  alt: string;
  className?: string;
}

export function QrCodeImage({ data, size = 200, alt, className }: QrCodeImageProps) {
  if (!data.trim()) return null;

  return (
    <img
      src={buildQrImageUrl(data, size)}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-lg border border-default bg-white p-2", className)}
    />
  );
}
