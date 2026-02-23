import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing the SDK package in development
  // (after npm link or workspace setup)
  transpilePackages: [],
};

export default nextConfig;
