/**
 * @type {import('next').NextConfig}
 */
const fs = require("node:fs");
const path = require("node:path");

const rootEnvPath = path.resolve(__dirname, "../../.env");
if (!process.env.DATABASE_URL && fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

module.exports = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5.1mb",
    },
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_DEBUG_MODE: process.env.DEBUG_MODE === "true" ? "true" : "false",
  },
};
