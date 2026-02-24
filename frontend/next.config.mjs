/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages
  output: 'export',
  // Repo name as base path (served at username.github.io/aztec-agentic-privacy)
  basePath: '/aztec-agentic-privacy',
  // Required for static export: trailing slashes ensure proper routing
  trailingSlash: true,
  // Disable image optimization (not available in static export)
  images: {
    unoptimized: true,
  },
  // Allow importing the SDK package in development
  // (after npm link or workspace setup)
  transpilePackages: [],
};

export default nextConfig;
