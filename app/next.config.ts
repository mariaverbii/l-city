import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    ...(process.env.REPLIT_DEV_DOMAIN
      ? [process.env.REPLIT_DEV_DOMAIN]
      : []),
  ],
};

export default nextConfig;
