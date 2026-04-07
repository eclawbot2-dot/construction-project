import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  experimental: {
    serverActions: {
      allowedOrigins: ["face.jahdev.com", "localhost:3100"],
    },
  },
};

export default nextConfig;
