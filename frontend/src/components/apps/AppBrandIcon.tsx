import { cn } from "@/lib/utils";

type AppBrandIconProps = {
  appId: string;
  className?: string;
};

export function AppBrandIcon({ appId, className }: AppBrandIconProps) {
  const shared = cn("h-full w-full", className);

  switch (appId) {
    case "shopify":
      return (
        <svg viewBox="0 0 48 48" className={shared} aria-hidden>
          <rect width="48" height="48" rx="12" fill="#95BF47" />
          <path
            fill="#fff"
            d="M30.8 14.2c-.1 0-2.4-.5-2.4-.5s-1.6-1.6-1.8-1.8c-.2-.2-.5-.1-.6-.1l-.8.2c-.6-1.6-1.7-2.8-3.1-2.8-3.7 0-5.5 4.6-6 7-.1 0-.3.1-.4.1l-2.7.8c-.8.3-.9.3-1 1.1 0 .1-1.6 12.4-1.6 12.4l14.2 2.5 7.7-1.7s-1.5-16.6-1.5-16.7c0-.1-.1-.1-.2-.1zm-7.1-3.1c.6 0 1.2.8 1.6 2.1l-2.7.8c.4-1.8 1.2-2.9 2.1-2.9zm-2.4 4.1 2.8-.9c.7 2 1.1 4.1.5 6.6-2-.3-4.1-.4-6.3-.2.5-2.5 1.6-4.5 3-5.5zm-1.4 9.4c.2 2.7 7.4 3.2 7.8.1 0 0-2.1-1-4.4-1.3-1.7-.2-3.4-.1-3.4 1.2z"
          />
        </svg>
      );

    case "catalog":
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <path
            fill="#25D366"
            d="M12 2C6.48 2 2 6.26 2 11.5c0 2.09.78 4.01 2.08 5.55L3 22l5.17-1.36A10.3 10.3 0 0 0 12 21c5.52 0 10-4.26 10-9.5S17.52 2 12 2z"
          />
          <path
            fill="#fff"
            d="M16.7 14.2c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.8-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.7-1.1-.6-.6-1.1-1.3-1.2-1.5-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4.1-.1 0-.3 0-.4s-.5-1.2-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.6.2 1.1.1 1.5.1.5-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3z"
          />
        </svg>
      );

    case "calendar":
      return (
        <svg viewBox="0 0 48 48" className={shared} aria-hidden>
          <path fill="#fff" d="M5 10h38v32H5z" />
          <path fill="#EA4335" d="M5 10h38v9H5z" />
          <path fill="#4285F4" d="M33 28h7v7h-7z" />
          <path fill="#34A853" d="M24 28h7v7h-7z" />
          <path fill="#FBBC04" d="M15 28h7v7h-7z" />
          <path fill="#188038" d="M24 37h7v5h-7z" />
          <path fill="#1967D2" d="M33 37h7v5h-7z" />
          <path fill="#FAD165" d="M15 37h7v5h-7z" />
          <path fill="#4285F4" d="M33 19h7v7h-7z" />
          <path fill="#FBBC04" d="M15 19h7v7h-7z" />
          <path fill="#34A853" d="M24 19h7v7h-7z" />
          <path fill="#BDBDBD" d="M14 5h4v8h-4zm16 0h4v8h-4z" />
          <path fill="#9AA0A6" d="M5 10h38v2H5z" />
        </svg>
      );

    case "payments":
      return (
        <svg viewBox="0 0 48 48" className={shared} aria-hidden>
          <rect width="48" height="48" rx="12" fill="#5B2EFF" />
          <path
            fill="#fff"
            d="M14 18.5c0-1.4 1.1-2.5 2.5-2.5h15c1.4 0 2.5 1.1 2.5 2.5v11c0 1.4-1.1 2.5-2.5 2.5h-15c-1.4 0-2.5-1.1-2.5-2.5v-11zm4.2 2.2v1.8h11.6v-1.8H18.2zm0 4.2v1.6h7.2v-1.6h-7.2z"
          />
          <circle cx="33.5" cy="30.5" r="4.2" fill="#00D4AA" />
          <path
            fill="#5B2EFF"
            d="M32.2 30.5l1.1 1.1 2.2-2.3.9.9-3.1 3.2-2-2z"
          />
        </svg>
      );

    case "ai-assistant":
      return (
        <svg viewBox="0 0 48 48" className={shared} aria-hidden>
          <defs>
            <linearGradient id="aiAssistGrad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10A37F" />
              <stop offset="1" stopColor="#1A7F64" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="12" fill="url(#aiAssistGrad)" />
          <path
            fill="#fff"
            d="M24 11c.6 0 1.1.4 1.3 1l1.5 4.3a8 8 0 0 0 5 5l4.3 1.5c.6.2 1 .7 1 1.3s-.4 1.1-1 1.3l-4.3 1.5a8 8 0 0 0-5 5l-1.5 4.3c-.2.6-.7 1-1.3 1s-1.1-.4-1.3-1l-1.5-4.3a8 8 0 0 0-5-5l-4.3-1.5c-.6-.2-1-.7-1-1.3s.4-1.1 1-1.3l4.3-1.5a8 8 0 0 0 5-5l1.5-4.3c.2-.6.7-1 1.3-1zm0 9.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z"
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" className={shared} aria-hidden>
          <rect width="24" height="24" rx="6" fill="#64748B" />
          <path
            fill="#fff"
            d="M7 8h10v2H7V8zm0 3h10v2H7v-2zm0 3h7v2H7v-2z"
          />
        </svg>
      );
  }
}
