import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  compress: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
