import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: [
    "192.168.43.240",
    "*.trycloudflare.com",
    "*.pinggy.link",
    "*.a.pinggy.io",
    "*.lhr.life",
    "*.localhost.run"
  ]
};

export default nextConfig;
