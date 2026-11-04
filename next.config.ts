import type { NextConfig } from "next";

const seguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const config = {
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
    middlewareClientMaxBodySize: "50mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: seguranca }];
  },
} as NextConfig;

export default config;
