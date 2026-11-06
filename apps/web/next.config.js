/**
 * @type {import('next').NextConfig}
 */
module.exports = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5.1mb",
    },
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};
