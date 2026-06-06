import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID ?? "",
    NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID:
      process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "",
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
