/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone for Docker, omitted for Vercel (Vercel handles it)
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  env: {
    API_URL: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
}
module.exports = nextConfig
