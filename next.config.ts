import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the local database) ships WebAssembly and must load from node_modules, not the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
