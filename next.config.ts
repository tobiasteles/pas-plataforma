import type { NextConfig } from "next";

const config = {
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
    middlewareClientMaxBodySize: "50mb",
  },
} as NextConfig;

export default config;
